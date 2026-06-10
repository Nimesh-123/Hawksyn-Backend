const { db } = require('../../models/index.model.js');
const notificationService = require('../../services/notificationService');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { calculateAICost } = require('../admin/helpers/aiCostHelper.js');
const { callLLM } = require('./helpers/evaluationHelpers.js');
const clockService = require('../../services/clockService.js');
const { buildReportHtml } = require('./templates/reportTemplateV2.js');
const { generatePdfFromHtml } = require('../../services/pdfService.js');
const s3Service = require('../../../utils/s3');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { getChatSettings } = require('../../../utils/configHelper.js');

const {
    anonymizeReport,
    getDeepValue,
    buildPlaceholderMap,
    fillPrompt,
    checkAnchors,
    applyCertaintyCap,
    extractVerdict,
    getGoldStandardExamples
} = require('./helpers/reportHelpers.js');



exports.generateReport = async (req, res) => {
    console.time("Report_Gen");
    const startTime = Date.now();
    
    let isDisconnected = req.isBackgroundProcess === true;
    
    const handleDisconnect = (reason) => {
        if (!isDisconnected) {
            console.log(`[Report-Gen] Client disconnected (${reason}) for runId: ${req.params.runId}. Process will complete in background.`);
            isDisconnected = true;
        }
    };

    req.on('close', () => handleDisconnect('req.close'));
    req.on('aborted', () => handleDisconnect('req.aborted'));
    req.socket.on('close', () => handleDisconnect('socket.close'));

    try {
        const { runId } = req.params;

        // 1. Data Loading (Run, Integrity, Signals, Profile)
        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        const rasArtifacts = await db.Ras.find({ runId });
        const integrityRas = rasArtifacts.find(r => r.artifactType === 'INTEGRITY_PACK');
        const signalsRas = rasArtifacts.find(r => r.artifactType === 'EXTERNAL_SIGNALS_CAPTURED');
        const profileRas = rasArtifacts.find(r => r.artifactType === 'PROFILE_CONFIRMED');
        const allObjectiveRas = rasArtifacts.filter(r => r.stepNo === 3 && r.artifactType === 'OBJECTIVE_INPUTS_CAPTURED');

        const profileSnapshot = run.cvSnapshot?.parsedData || profileRas?.artifactJson || {};

        // RELENTLESS NORMALIZATION: Surface the 'identity', 'work', or 'inferred' block
        let depth = 0;
        let pSnap = profileSnapshot;
        while (depth < 3 && pSnap && !pSnap.identity && !pSnap.work && !pSnap.inferred) {
            if (pSnap.confirmedProfile) pSnap = pSnap.confirmedProfile;
            else if (pSnap.structured) pSnap = pSnap.structured;
            else if (pSnap.data) pSnap = pSnap.data;
            else break;
            depth++;
        }

        // Merge sub-blocks into root for easy access
        let normalizedProfile = { ...pSnap };
        if (pSnap.identity) normalizedProfile = { ...normalizedProfile, ...pSnap.identity };
        if (pSnap.work) normalizedProfile = { ...normalizedProfile, ...pSnap.work };
        if (pSnap.inferred) normalizedProfile = { ...normalizedProfile, ...pSnap.inferred };
        if (pSnap.personalInfo) normalizedProfile = { ...normalizedProfile, ...pSnap.personalInfo };
        if (pSnap.seniority) normalizedProfile = { ...normalizedProfile, ...pSnap.seniority };
        if (pSnap.employment) normalizedProfile = { ...normalizedProfile, ...pSnap.employment };

        if (!integrityRas) return res.status(400).json({ success: false, message: 'Integrity Audit missing.' });

        const integrityPack = integrityRas.artifactJson;
        const externalSignals = signalsRas?.artifactJson?.signals?.signals 
            || signalsRas?.artifactJson?.signals 
            || null;

        const externalCoverage = signalsRas?.artifactJson?.coverage || [];

        const rasAnswers = allObjectiveRas.flatMap(r => r.artifactJson?.answers || []);
        const questionDocs = await db.Questions.find({ questionId: { $in: rasAnswers.map(a => a.questionId) } });
        const questionsMap = {};
        for (const q of questionDocs) questionsMap[q.questionId] = q;

        // 2. Load Configuration (ELR, Sections, Prompts, OST Contracts)
        const [elr, sections, promptDocs, ostDocs, playbook] = await Promise.all([
            db.EvaluationLibraryRegistry.findOne({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] }, isActive: true }),
            db.DecisionAssuranceSections.find({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] }, isActive: true }).sort({ sectionOrder: 1 }),
            db.PromptConfigRegistry.find({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] }, isActive: true }),
            db.ObjectiveScoringTaxonomy.find({ caseId: run.caseId, isActive: true }),
            db.Playbooks.findOne({ caseId: run.caseId, intentId: run.intentId, isActive: true })
        ]);

        if (!sections.length) return res.status(404).json({ success: false, message: 'No sections configured.' });

        const promptsMap = {};
        for (const p of promptDocs) promptsMap[p.sectionId] = p;

        const ostMap = {};
        for (const o of ostDocs) ostMap[o.sectionId] = o;

                // 3. Build RAG & Mapping Context
        // ─── HELPER: MCQ answer text fetch ───────────────────────────────────────
        function getAnswerText(rasAnswers, questionId, questionsMap) {
            const ans = rasAnswers.find(a => a.questionId === questionId);
            if (!ans) return 'Not answered';

            // New JSON structure support
            if (ans.answerLabel) return ans.answerLabel;
            if (ans.answerValue) return ans.answerValue;
            if (ans.answerText) return ans.answerText;

            // Legacy format fallback
            const q = questionsMap[questionId];
            if (!q) return 'Not answered';
            const optMap = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
            return optMap[ans.selectedOption?.toLowerCase()] || 'Not answered';
        }

        // ─── HELPER: MCQ option → numeric score ──────────────────────────────────
        function getOptionScore(rasAnswers, questionId, scoreMap) {
            const ans = rasAnswers.find(a => a.questionId === questionId);
            if (!ans) return null;

            // Legacy: selectedOption letter
            const option = ans.selectedOption?.toLowerCase();
            if (option && scoreMap[option] !== undefined) return scoreMap[option];

            // New format: optionsJson array se match karo
            const q = questionsMap[questionId];
            if (!q) return null;

            const label = (ans.answerLabel || ans.answerValue || '').toLowerCase().trim();

            if (Array.isArray(q.optionsJson)) {
                const matched = q.optionsJson.find(o => {
                    const optText = (o.opt || '').toLowerCase().trim();
                    if (!optText || !label) return false;
                    return optText === label || optText.includes(label) || label.includes(optText);
                });
                if (matched) {
                    const letter = matched.id?.toLowerCase();
                    if (letter && scoreMap[letter] !== undefined) return scoreMap[letter];
                    if (matched.score !== undefined) return matched.score;
                }
            }

            // Fallback: camelCase fields
            const opts = {
                a: (q.optionA || '').toLowerCase().trim(),
                b: (q.optionB || '').toLowerCase().trim(),
                c: (q.optionC || '').toLowerCase().trim(),
                d: (q.optionD || '').toLowerCase().trim()
            };
            for (const [letter, text] of Object.entries(opts)) {
                if (text && label && (label === text || text.includes(label) || label.includes(text))) return scoreMap[letter] ?? null;
            }

            console.warn(`[VLT] No match: Q=${questionId} label="${label}"`);
            return null;
        }

        // ─── HELPER: constraint band label ───────────────────────────────────────
        function getConstraintBand(score) {
            if (score >= 80) return 'STRONG';
            if (score >= 60) return 'MODERATE';
            if (score >= 40) return 'FRAGILE';
            return 'CRITICAL';
        }

        // ─── HELPER: format external signal as human-readable object ─────────────
        function formatSignalHuman(signalsRas, signalId) {
            const raw = signalsRas?.artifactJson?.signals?.signals?.[signalId] 
                     || signalsRas?.artifactJson?.signals?.[signalId];
            if (!raw) return { value: 'Not collected', confidence: 'N/A', summary: 'Signal not available.' };
            return {
                value:      raw.index_value || raw.value || 'MEDIUM',
                confidence: raw.confidence  || 'MEDIUM',
                summary:    raw.rationale   || raw.summary || 'No rationale available.'
            };
        }

        // ─── STEP A: Compute constraint scores from MCQ answers ──────────────────
        function computeConstraintScores(rasAnswers, questionsMap) {
            const S = (qId, map) => getOptionScore(rasAnswers, qId, map);

            const Q1  = S('Q_RO_001', { a:100, b:75, c:50, d:0   });
            const Q2  = S('Q_RO_002', { a:100, b:75, c:50, d:0   });
            const Q3  = S('Q_RO_003', { a:0,   b:50, c:75, d:100 });
            const Q4  = S('Q_RO_004', { a:0,   b:50, c:75, d:100 });
            const Q5  = S('Q_RO_005', { a:100, b:75, c:25, d:0   });
            const Q6  = S('Q_RO_006', { a:0,   b:50, c:75, d:100 });
            const Q7  = S('Q_RO_007', { a:0,   b:25, c:75, d:100 });
            const Q8  = S('Q_RO_008', { a:0,   b:25, c:75, d:100 });
            const Q9  = S('Q_RO_009', { a:100, b:75, c:50, d:0   });
            const Q10 = S('Q_RO_010', { a:0,   b:25, c:75, d:100 });

            const answered = [Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,Q9,Q10].filter(v => v !== null).length;
            if (answered === 0) {
                console.log('[VLT] No MCQ answers found — constraint engine skipped');
                return null;
            }

            const d = (v) => v ?? 50;

            const C1 = Math.round((d(Q1)*1.5 + d(Q2)*1.5 + d(Q5)*0.8 + d(Q9)*1.0 + d(Q10)*0.5) / 5.3);
            const C2 = Math.round((d(Q3)*1.5 + d(Q7)*1.3 + d(Q8)*1.4 + d(Q6)*0.8) / 5.0);
            const C3 = Math.round((d(Q5)*1.5 + d(Q9)*1.3) / 2.8);
            const C4 = Math.round((d(Q4)*1.7 + d(Q10)*1.4) / 3.1);
            const C5 = Math.round((d(Q6)*1.5 + d(Q8)*1.2 + d(Q4)*0.8) / 3.5);
            const C6 = Math.round((d(Q7)*1.5 + d(Q8)*1.5 + d(Q3)*1.0) / 4.0);
            const C7 = Math.round((d(Q9)*1.8 + d(Q1)*1.0 + d(Q2)*0.8) / 3.6);

            const composite = Math.round((C1*1.5 + C2*1.5 + C3*1.0 + C4*1.5 + C5*1.0 + C6*1.0 + C7*1.5) / 9.0);
            const verdict   = composite >= 75 ? 'PROCEED' : composite >= 50 ? 'PAUSE' : 'STOP';

            console.log(`[VLT] Constraint scores computed: C1=${C1} C2=${C2} C3=${C3} C4=${C4} C5=${C5} C6=${C6} C7=${C7} → Composite=${composite} → ${verdict}`);

            return { C1, C2, C3, C4, C5, C6, C7, composite, verdict, answeredCount: answered,
                C1_band: getConstraintBand(C1), C2_band: getConstraintBand(C2),
                C3_band: getConstraintBand(C3), C4_band: getConstraintBand(C4),
                C5_band: getConstraintBand(C5), C6_band: getConstraintBand(C6),
                C7_band: getConstraintBand(C7)
            };
        }

        // ─── STEP B: Detect contradictions ───────────────────────────────────────
        function detectContradictions(rasAnswers, questionsMap) {
            const A = (qId) => getAnswerText(rasAnswers, qId, questionsMap).toLowerCase();
            const q1=A('Q_RO_001'), q2=A('Q_RO_002'), q3=A('Q_RO_003');
            const q5=A('Q_RO_005'), q6=A('Q_RO_006'), q7=A('Q_RO_007');
            const q8=A('Q_RO_008'), q9=A('Q_RO_009'), q10=A('Q_RO_010');

            const raw1=getAnswerText(rasAnswers,'Q_RO_001',questionsMap);
            const raw5=getAnswerText(rasAnswers,'Q_RO_005',questionsMap);
            const raw7=getAnswerText(rasAnswers,'Q_RO_007',questionsMap);
            const raw8=getAnswerText(rasAnswers,'Q_RO_008',questionsMap);
            const raw9=getAnswerText(rasAnswers,'Q_RO_009',questionsMap);

            const triggered = [];

            if ((q5.includes('tense') || q5.includes('let go') || q5.includes('uncertain') || q5.includes('cautious') || q5.includes('cost pressure'))
             && (q9.includes('struggle for months') || q9.includes('few months with proper'))) {
                triggered.push({
                    rf_label:  'Blind Safety Risk',
                    rf_id:     'CONTR_RO_001',
                    severity:  'CRITICAL',
                    content:   `You appear to believe your role is secure despite clear company instability signals.\n\nEvidence: Your company mood answer was "${raw5}" yet you indicated "${raw9}" when asked how quickly you could be replaced. These two answers directly contradict each other.\n\nCost: Overconfidence in job security at an unstable company is the highest-risk blind spot in this audit. People who hold this belief are statistically more likely to be caught unprepared when restructuring happens.`
                });
            }

            if ((q1.includes('most of my work') || q1.includes('about half'))
             && q9.includes('struggle for months')) {
                triggered.push({
                    rf_label:  'Replaceability Denial Risk',
                    rf_id:     'CONTR_RO_003',
                    severity:  'HIGH',
                    content:   `You believe you are difficult to replace despite doing predominantly process-driven work.\n\nEvidence: You answered "${raw1}" for daily task routine, yet assessed your replaceability as "${raw9}". Process-driven work is the category most rapidly being automated.\n\nCost: This belief delays necessary action. By the time the gap becomes visible in hiring signals, the window to act has typically already closed.`
                });
            }

            if ((q7.includes('completed a course') || q7.includes('certification'))
             && (q8.includes('cannot remember') || q8.includes('more than a year'))) {
                triggered.push({
                    rf_label:  'Performative Learning Risk',
                    rf_id:     'CONTR_RO_004',
                    severity:  'HIGH',
                    content:   `You believe completing a course counts as active upskilling.\n\nEvidence: You answered "${raw7}" for recent learning, but "${raw8}" for when you last applied new knowledge at work. A certificate without applied practice does not change your actual skill profile.\n\nCost: Employers and technical interviewers can detect the gap between certificate and practice within the first 15 minutes of a technical screen.`
                });
            }

            if ((q2.includes('4 to 7') || q2.includes('more than 7'))
             && (q3.includes('all of them') || q3.includes('minor gaps'))) {
                triggered.push({
                    rf_label:  'Silent Obsolescence Risk',
                    rf_id:     'CONTR_RO_005',
                    severity:  'HIGH',
                    content:   `You believe your skills have no significant gaps after years in the same role.\n\nEvidence: You indicated staying in the same type of work for an extended period while simultaneously stating your skills are mostly current. Years of same-role experience without visible skill gaps is a classic pre-obsolescence pattern.\n\nCost: The gap exists — it is just not yet visible in hiring signals. By the time it becomes visible, it will require 12–18 months to close.`
                });
            }

            if (q6.includes('actively exploring')
             && (q8.includes('cannot remember') || q8.includes('more than a year'))) {
                triggered.push({
                    rf_label:  'Surface Transition Risk',
                    rf_id:     'CONTR_RO_006',
                    severity:  'MEDIUM',
                    content:   `You are actively exploring external opportunities but have not applied new skills recently.\n\nEvidence: Your networking and exploration activity (Q6) is not matched by recent skill application (Q8). Exploring without building is a surface-level transition — you will be screened out at the technical stage.\n\nCost: External conversations raise expectations that your current skill portfolio may not yet support.`
                });
            }

            console.log(`[CDT] Contradictions triggered: ${triggered.length}`);
            return triggered;
        }

        const constraintScores = computeConstraintScores(rasAnswers, questionsMap);
        const triggeredContradictions = detectContradictions(rasAnswers, questionsMap);

        const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const recheckDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

        // Fetch ExtractedCV for roles & compute experience before placeholders
        const extractedCV = await db.ExtractedCV.findOne({ candidate_id: run.userId.toString() });
        const rawParsed = run.cvSnapshot?.parsedData || {};

        const experienceList = (extractedCV?.roles && extractedCV.roles.length > 0) ? extractedCV.roles.map(r => ({
                            title: r.role_metadata?.title || 'Unknown Role',
                            company: r.role_metadata?.company || 'Unknown Company',
                            duration: `${r.role_metadata?.start_date || ''} to ${r.role_metadata?.end_date || 'Present'}`,
                            description: (r.base_aeus || []).map(ae => ae.raw_text || '').join('\n'),
                            duration_months: r.role_metadata?.duration_months || 24
                        }))
                     : (rawParsed.work?.experience || normalizedProfile.work?.experience || rawParsed.employment?.history || normalizedProfile.employment?.history || []);

        let expYears = 'N/A';
        if (extractedCV?.normalized_metrics?.total_experience_years) {
            expYears = parseFloat(Number(extractedCV.normalized_metrics.total_experience_years).toFixed(1));
        } else if (extractedCV?.precomputed_stats?.total_experience_months) {
            expYears = parseFloat((extractedCV.precomputed_stats.total_experience_months / 12).toFixed(1));
        } else if (rawParsed.work?.totalYears) {
            expYears = parseFloat(Number(rawParsed.work.totalYears).toFixed(1));
        } else if (normalizedProfile.totalYears) {
            expYears = parseFloat(Number(normalizedProfile.totalYears).toFixed(1));
        } else if (normalizedProfile.experienceYears) {
            expYears = parseFloat(Number(normalizedProfile.experienceYears).toFixed(1));
        } else if (rawParsed.total_experience_years) {
            expYears = parseFloat(Number(rawParsed.total_experience_years).toFixed(1));
        } else if (experienceList.length > 0) {
            expYears = parseFloat((experienceList.reduce((acc, r) => acc + (r.duration_months || 24), 0) / 12).toFixed(1)) || (experienceList.length * 2);
        }

        normalizedProfile.totalExperienceYears = expYears;

        const placeholders = buildPlaceholderMap(
            normalizedProfile,
            rasAnswers,
            questionsMap,
            integrityRas?.artifactJson || {},
            signalsRas?.artifactJson || {}
        );

        if (constraintScores) {
            placeholders.C1_SCORE = constraintScores.C1; placeholders.C1_STATUS = constraintScores.C1_band;
            placeholders.C2_SCORE = constraintScores.C2; placeholders.C2_STATUS = constraintScores.C2_band;
            placeholders.C3_SCORE = constraintScores.C3; placeholders.C3_STATUS = constraintScores.C3_band;
            placeholders.C4_SCORE = constraintScores.C4; placeholders.C4_STATUS = constraintScores.C4_band;
            placeholders.C5_SCORE = constraintScores.C5; placeholders.C5_STATUS = constraintScores.C5_band;
            placeholders.C6_SCORE = constraintScores.C6; placeholders.C6_STATUS = constraintScores.C6_band;
            placeholders.C7_SCORE = constraintScores.C7; placeholders.C7_STATUS = constraintScores.C7_band;
            placeholders.COMPOSITE_SCORE = constraintScores.composite;
            placeholders.CONSTRAINT_SCORES_ALL = JSON.stringify({
                C1: { score: constraintScores.C1, band: constraintScores.C1_band, name: 'Role Automation Exposure' },
                C2: { score: constraintScores.C2, band: constraintScores.C2_band, name: 'Skill Relevance' },
                C3: { score: constraintScores.C3, band: constraintScores.C3_band, name: 'Company Stability' },
                C4: { score: constraintScores.C4, band: constraintScores.C4_band, name: 'Financial Resilience' },
                C5: { score: constraintScores.C5, band: constraintScores.C5_band, name: 'Transition Readiness' },
                C6: { score: constraintScores.C6, band: constraintScores.C6_band, name: 'Learning Velocity' },
                C7: { score: constraintScores.C7, band: constraintScores.C7_band, name: 'Internal Role Uniqueness' },
            });
        } else {
            placeholders.CONSTRAINT_SCORES_ALL = 'MCQ not completed — constraint scores unavailable';
        }

        placeholders.CONTRADICTION_LIST_WITH_SEVERITY = triggeredContradictions.length > 0
            ? JSON.stringify(triggeredContradictions) : '[]';
        placeholders.CONTRADICTION_COUNT = triggeredContradictions.length;

        // DRO activation from contradictions + constraint scores
        const behaviouralDROs = [];
        if (triggeredContradictions.length > 0) {
            triggeredContradictions.forEach(c => {
                behaviouralDROs.push({ name: c.rf_label, severity: c.severity });
            });
        }
        // Constraint-based DRO activation
        if (constraintScores) {
            if (constraintScores.C2 < 50) behaviouralDROs.push({ name: 'Passive Learning Risk', severity: constraintScores.C2 < 30 ? 'CRITICAL' : 'HIGH' });
            if (constraintScores.C6 < 50) behaviouralDROs.push({ name: 'Learning Transfer Absence Risk', severity: constraintScores.C6 < 30 ? 'CRITICAL' : 'HIGH' });
            if (constraintScores.C7 < 50) behaviouralDROs.push({ name: 'Internal Replaceability Risk', severity: 'HIGH' });
            if (constraintScores.C3 < 50) behaviouralDROs.push({ name: 'Company Instability Risk', severity: constraintScores.C3 < 30 ? 'CRITICAL' : 'HIGH' });
            if (constraintScores.C5 < 30) behaviouralDROs.push({ name: 'Market Isolation Risk', severity: 'HIGH' });
        }

        // BSI pre-compute
        const bsiWeights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2 };
        const bsiSum = behaviouralDROs.reduce((acc, d) => acc + (bsiWeights[d.severity] || 2), 0);
        const bsiMax = behaviouralDROs.length * 4;
        const bsiScore = bsiMax > 0 ? Math.round((bsiSum / bsiMax) * 100) : 0;

        placeholders.DRO_BEHAVIOURAL_RISK_LIST = JSON.stringify(behaviouralDROs);
        placeholders.BSI_SCORE = bsiScore;
        placeholders.BSI_PRE_COMPUTED = bsiScore; // LLM ko override karne se rokne ke liye

        placeholders.LABOUR_MARKET_SIGNAL    = JSON.stringify(formatSignalHuman(signalsRas, 'EST_LM_001'));
        placeholders.INDUSTRY_SIGNAL         = JSON.stringify(formatSignalHuman(signalsRas, 'EST_IND_002'));
        placeholders.COMPANY_SIGNAL          = JSON.stringify(formatSignalHuman(signalsRas, 'EST_CO_003'));
        placeholders.AI_DEMAND_SIGNAL        = JSON.stringify(formatSignalHuman(signalsRas, 'EST_TECH_004'));
        placeholders.REGULATORY_SIGNAL       = JSON.stringify(formatSignalHuman(signalsRas, 'EST_REG_005'));

        placeholders.RECHECK_DATE = recheckDate;
        placeholders.RUN_DATE     = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
        placeholders.INTENT       = run.intentId === 'RO' ? 'Role Elimination Risk' : 
                                     run.intentId === 'INT_ROLE_RISK_EXIT_READINESS' ? 'Role Risk and Exit Readiness' : run.intentId;
        placeholders.ACTIVE_INTENT = placeholders.INTENT;

        const goldExamples = await getGoldStandardExamples(db, run.caseId, run.intentId, 3);
        const goldContextBlock = goldExamples.length > 0
            ? `\n\n--- GOLD STANDARD EXAMPLES (${goldExamples.length}) ---\n` +
            goldExamples.map((ex, i) => `[Ex ${i + 1}]\n${JSON.stringify(ex.sections?.map(s => ({ id: s.sectionId, content: s.content })) || ex, null, 2)}`).join('\n\n')
            : "";

        // 4. Batched Generation of Sections (Stable Processing)
        const reportSections = [];
        const batchSize = 3;
        for (let i = 0; i < sections.length; i += batchSize) {
            const batch = sections.slice(i, i + batchSize);
            console.log(`[Report-Gen] Processing batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(sections.length / batchSize)}...`);

            const batchPromises = batch.map(async (section) => {
                const prompt = promptsMap[section.sectionId];
                const ostConfig = ostMap[section.sectionId];
                const sectionOut = {
                    sectionId: section.sectionId,
                    sectionName: section.sectionName,
                    sectionType: section.sectionType,
                    sectionOrder: section.sectionOrder,
                    promptVersion: prompt?.promptVersion || 1,
                    status: 'PENDING',
                    ostMetadata: ostConfig ? {
                        primaryOutputType: ostConfig.primaryOutputType,
                        chartType: ostConfig.chartType,
                        chartLibrary: ostConfig.chartLibrary,
                        frontendRenderSpec: ostConfig.frontendRenderSpec,
                        wordLimit: ostConfig.wordLimit,
                        scientificReference: ostConfig.scientificReference
                    } : null
                };

                const anchorCheck = checkAnchors(section, integrityPack, externalCoverage);
                if (!anchorCheck.allCovered && section.fallbackPolicy === 'ESCALATE') {
                    sectionOut.status = 'ESCALATED';
                    sectionOut.content = "Missing required evidence anchors.";
                    return sectionOut;
                }

                if (!prompt) {
                    sectionOut.status = 'SKIPPED';
                    return sectionOut;
                }

                const sectionPlaceholders = { ...placeholders };
                if (prompt.evidencePlaceholdersJson) {
                    for (const [phKey, ref] of Object.entries(prompt.evidencePlaceholdersJson)) {
                        if (ref && typeof ref === 'object') {
                            if (ref.source === 'answers' && ref.questionId) {
                                sectionPlaceholders[phKey] = placeholders[ref.questionId] || 'N/A';
                            } else if (ref.source === 'signals' || ref.source === 'externalSignals') {
                                if (ref.signalId) {
                                    const sigRef = externalSignals?.[ref.signalId];
                                    sectionPlaceholders[phKey] = sigRef ? String(sigRef[ref.field || 'value'] || 'N/A') : 'N/A';
                                }
                            } else if (ref.source === 'integrity' && ref.path) {
                                sectionPlaceholders[phKey] = String(getDeepValue(integrityPack, ref.path) || 'N/A');
                            }
                            continue;
                        }
                        if (typeof ref === 'string') {
                            if (ref.startsWith('Q_')) {
                                sectionPlaceholders[phKey] = placeholders[ref] || 'N/A';
                            } else if (ref.startsWith('integrityPack.')) {
                                sectionPlaceholders[phKey] = String(getDeepValue(integrityPack, ref.replace('integrityPack.', '')) || 'N/A');
                            } else if (ref.startsWith('externalSignals.')) {
                                sectionPlaceholders[phKey] = String(getDeepValue(externalSignals, ref.replace('externalSignals.', '')) || 'N/A');
                            } else {
                                const deepVal = getDeepValue(normalizedProfile, ref);
                                sectionPlaceholders[phKey] = (deepVal !== undefined && deepVal !== null) ? String(deepVal) : (placeholders[ref] || 'N/A');
                            }
                        }
                    }
                }

                try {
                    let userPrompt = fillPrompt(prompt.userPrompt, sectionPlaceholders);
                    if (!anchorCheck.allCovered) userPrompt += `\n[NOTE: Missing evidence: ${[...anchorCheck.missingInternal, ...anchorCheck.missingExternal].join(', ')}]`;

                    const ostContract = ostMap[section.sectionId]?.llmJsonContract;

                    // Clean the evidence package so the LLM doesn't see internal identifiers
                    const cleanEvidence = { ...placeholders };
                    for (const key of Object.keys(cleanEvidence)) {
                        if (
                            /^(EST|CONTR|RF|DRO|CONS|Q|C\d)_/i.test(key) ||
                            key.endsWith('_VALUE') ||
                            key.endsWith('_RATIONALE') ||
                            key.endsWith('_CONFIDENCE') ||
                            key === 'CONFIRMED_PROFILE' ||
                            key === 'CV_AEUS' ||
                            key === 'CONSTRAINT_SCORES_ALL'
                        ) {
                            delete cleanEvidence[key];
                        }
                    }

                    const systemPromptBase = (prompt.systemPrompt || '') +
                        (ostContract ? `\n\nCRITICAL OUTPUT FORMAT — RETURN ONLY VALID JSON MATCHING THIS SCHEMA EXACTLY:\n${ostContract}\nDo not wrap in markdown. Do not add extra keys. Return only the JSON object.\n` : '') +
                        "\n\n--- COMPREHENSIVE EVIDENCE PACKAGE (all data for this person) ---\n" +
                        JSON.stringify(cleanEvidence, null, 2) +
                        "\n\nSTRICT GROUNDING RULES — violating any rule = section failure:\n" +
                        "1. Use ONLY the evidence package as source of truth. No general knowledge.\n" +
                        "2. Do not say data is missing if it is present in the package above.\n" +
                        "3. NEVER output internal identifiers in user-facing text. This includes: EST_LM_001, ESTCO003VALUE, CONTR_RO_001, DRO_RO_004, C1_SCORE, C1STATUS, C2STATUS, C3STATUS, C4STATUS, C5STATUS, C6STATUS, C7STATUS, CONS_RO_*, VLT_*, CONSTRAINTSCORES_ALL, INTROLERISKEXITREADINESS, or ANY pattern matching ALL_CAPS_WITH_UNDERSCORES. Convert everything to plain English.\n" +
                        "4. RISK NAMES — use only these exact labels: Task Routineness Risk | Active Automation Risk | Skill Addition Lag Risk | Economic Obsolescence Risk | Financial Runway Risk | Company Instability Risk | Market Isolation Risk | Passive Learning Risk | Learning Transfer Absence Risk | Internal Replaceability Risk | Salary Dependency Risk | Transition Flexibility Absence Risk | Blind Safety Risk | False Resilience Risk | Replaceability Denial Risk | Performative Learning Risk | Silent Obsolescence Risk | Surface Transition Risk | Awareness Without Action Risk | Structural Collapse Risk | Trapped Professional Risk\n" +
                        "5. MCQ ANSWERS: Q1_ANSWER through Q10_ANSWER are CONFIRMED direct user responses. Never label them UNVERIFIED.\n" +
                        "6. DIRECT ADDRESS: Always write 'you' and 'your'. Never write 'the user', 'the candidate', or any role title in third person.\n" +
                        "7. NO COACHING LANGUAGE: No Pro-Tips, no motivational phrases. Banned: 'Pro-Tip:', 'It is recommended', 'You should consider', 'Continuous learning is crucial'.\n" +
                        "8. OPENING RULE: Never open a section by listing what data is missing. Start with what is confirmed.\n" +
                        "9. DATES: For any rerun or expiry date, use exactly this value: " + recheckDate + ". Never use 2025 dates.\\n" +
                        "10. SIGNAL NAMES: Never write 'Tier 1', 'EST_LM_001', 'ESTCO003VALUE' etc. Write 'Labour Market Index', 'Company Restructuring Signal' etc.\\n" +
                        "11. SECTION SEC_RO_010 ONLY: task_rows mein actual work activities likhni hain (e.g. 'Writing API endpoints', 'Code review', 'Database query optimization') — DRO risk names task categories NAHI hain. DRO names sirf Section 7, 13, 21, 25 mein use hote hain.\\n" +
                        "12. GR LANGUAGE: Strictly follow GR Language guidelines. Use professional, objective, and neutral tone throughout. Avoid local slang or overly conversational idioms.\\n" +
                        "13. VERDICT ALIGNMENT: Your data projections must strictly align with the VERDICT (e.g. if PAUSE, do NOT show increasing demand/salary bands in Section 10).\\n" +
                        "14. NO 'MAYBE' FOR EMPLOYERS: In Section 18, strictly output 'YES' or 'NO' for each employer type. NEVER use 'MAYBE'.\\n" +
                        "15. HYPER-PERSONALIZATION: The Uncomfortable Truth (Section 2) MUST specifically attack a weakness found in the candidate's actual CV, Skills, or Domain. No generic statements.\\n" +
                        "16. PLAYBOOK ALIGNMENT: Focus the analysis on the generic professional dimensions, constraints, and MCQ answers evaluated by the system. Do NOT make specific technical skills (e.g. Java, Python, coding) the center of the report. The report must evaluate general career resilience and role risks, not technical proficiency.\\n" +
                        "17. STRICT FORMATTING: NEVER output long paragraphs. All descriptive text, explanations, and insights MUST be formatted as short, concise bullet points to ensure high readability.";

                    let llmResult = await callLLM({
                        modelFamily: prompt.modelFamily,
                        forceProvider: 'Gemini',
                        systemPrompt: systemPromptBase,
                        userPrompt,
                        temperature: prompt.temperature || 0.3,
                        maxTokens: prompt.maxTokens || 1500
                    });

                    // >>> ADVERSARIAL LAYER <<<
                    if (playbook && playbook.adversarialMirrorEnabled) {
                        const challengerPrompt = `Challenge the following claims using the provided EVIDENCE PACKAGE. Identify logical gaps, contradictions, or over-optimistic conclusions.\n\nPRIMARY TEXT:\n${llmResult.text}`;

                        const challengerResult = await callLLM({
                            modelFamily: prompt.modelFamily,
                            systemPrompt: systemPromptBase + "\n\nROLE: You are the Adversarial Challenger.",
                            userPrompt: challengerPrompt,
                            temperature: 0.5,
                            maxTokens: prompt.maxTokens || 1500
                        });

                        const mergerPrompt = `Merge the PRIMARY DRAFT and the ADVERSARIAL CRITIQUE into a professional, highly balanced final section output. Ensure it reads cohesively.\n\nPRIMARY DRAFT:\n${llmResult.text}\n\nADVERSARIAL CRITIQUE:\n${challengerResult.text}`;

                        const mergerResult = await callLLM({
                            modelFamily: prompt.modelFamily,
                            systemPrompt: systemPromptBase + "\n\nROLE: You are the Consolidator.",
                            userPrompt: mergerPrompt,
                            temperature: 0.3,
                            maxTokens: prompt.maxTokens || 1500
                        });

                        // Combine token usage
                        llmResult.text = mergerResult.text;
                        if (llmResult.usageMetadata && challengerResult.usageMetadata && mergerResult.usageMetadata) {
                            llmResult.usageMetadata.promptTokens += challengerResult.usageMetadata.promptTokens + mergerResult.usageMetadata.promptTokens;
                            llmResult.usageMetadata.completionTokens += challengerResult.usageMetadata.completionTokens + mergerResult.usageMetadata.completionTokens;
                            llmResult.usageMetadata.totalTokens += challengerResult.usageMetadata.totalTokens + mergerResult.usageMetadata.totalTokens;
                        }
                        llmResult.duration = (llmResult.duration || 0) + (challengerResult.duration || 0) + (mergerResult.duration || 0);
                    }
                    // >>> END ADVERSARIAL LAYER <<<

                    // Post-processing Sanitization
                    let sanitizedText = llmResult.text
                        .replace(/EST[A-Z0-9_]+VALUE/gi, '')
                        .replace(/EST[A-Z0-9_]+_?RATIONALE/gi, '')
                        .replace(/EST[A-Z0-9_]+_?CONFIDENCE/gi, '')
                        .replace(/EXTERNALSIGNALS[,\s]*/gi, '')
                        .replace(/\bC([1-7])STATUS\b/g, (_, n) => {
                            const names = ['','Automation Exposure','Skill Relevance','Company Stability',
                                           'Financial Resilience','Transition Readiness','Learning Velocity','Role Uniqueness'];
                            return names[parseInt(n)] + ' status';
                        })
                        .replace(/\bCONSTRAINTSCORES_ALL\b/gi, 'constraint scores')
                        .replace(/\bCONSTRAINT_SCORES_ALL\b/gi, 'constraint scores')
                        .replace(/DRO_RO_\d{3}/gi, '')
                        .replace(/CONTR_RO_\d{3}/gi, '')
                        .replace(/RF_RO_\d{3}/gi, '')
                        .replace(/INTROLERISKEXITREADINESS/gi, 'Role Risk and Exit Readiness')
                        .replace(/INT_ROLE_RISK_EXIT_READINESS/gi, 'Role Risk and Exit Readiness')
                        .replace(/INT_ROLE_RISK_REALITY_CHECK/gi, 'Role Risk and Exit Readiness')
                        .replace(/Tier\s*[12]\s*(?:Data\s*Refresh|Signal[s]?)/gi, 'External Signal Update Required')
                        .replace(/TIER_[12]/gi, '')
                        .replace(/^.*Pro[\s-]?Tip\s*:.*$/gim, '')
                        .replace(/(?:Mandatory Re-run|Expires)(?:\*\*|__)?:\s*(?:\*\*)?\s*(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}|\d{2} [A-Za-z]+ \d{4})/gi,
                            (match) => match.split(':')[0] + ': ' + recheckDate)
                        .replace(/Generation failed\./gi, '[Section pending human auditor review]')
                        .trim();

                    sectionOut.content = applyCertaintyCap(sanitizedText, prompt.certaintyCapPercent || 85, integrityPack.accuracy?.band);
                    sectionOut.status = anchorCheck.allCovered ? 'COMPLETE' : 'DEGRADED';
                    sectionOut.tokenUsage = llmResult.usageMetadata;
                    sectionOut.duration = llmResult.duration;
                    return sectionOut;
                } catch (llmErr) {
                    console.error(`[Report-Gen] SECTION FAILURE (${section.sectionId}):`, llmErr.message);
                    sectionOut.status = 'LLM_ERROR';
                    sectionOut.content = 'Generation failed.';
                    return sectionOut;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            reportSections.push(...batchResults);
        }


        // 5. Final Assembly & Aggregation
        const totalDuration = (Date.now() - startTime) / 1000;
        const totalTokenUsage = reportSections.reduce((acc, s) => {
            if (s.tokenUsage) {
                acc.promptTokens += s.tokenUsage.promptTokens;
                acc.completionTokens += s.tokenUsage.completionTokens;
                acc.totalTokens += s.tokenUsage.totalTokens;
            }
            return acc;
        }, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });

        const verdict = integrityPack.verdict || 'PAUSE';
        const finalReport = {
            runId, caseId: run.caseId, intentId: run.intentId,
            sections: reportSections,
            verdict: constraintScores?.verdict || integrityPack.verdict || 'PAUSE',
            compositeScore: constraintScores?.composite || integrityPack.compositeScore || 0,
            constraintScores: constraintScores ? [
                { constraintId: 'CONS_RO_001', constraintName: 'Role Automation Exposure (C1)',    score: constraintScores.C1, band: constraintScores.C1_band, weight: 1.5 },
                { constraintId: 'CONS_RO_002', constraintName: 'Skill Relevance and Depreciation (C2)', score: constraintScores.C2, band: constraintScores.C2_band, weight: 1.5 },
                { constraintId: 'CONS_RO_003', constraintName: 'Company and Role Stability (C3)',  score: constraintScores.C3, band: constraintScores.C3_band, weight: 1.0 },
                { constraintId: 'CONS_RO_004', constraintName: 'Financial Resilience (C4)',        score: constraintScores.C4, band: constraintScores.C4_band, weight: 1.5 },
                { constraintId: 'CONS_RO_005', constraintName: 'Transition Readiness (C5)',        score: constraintScores.C5, band: constraintScores.C5_band, weight: 1.0 },
                { constraintId: 'CONS_RO_006', constraintName: 'Learning Velocity (C6)',           score: constraintScores.C6, band: constraintScores.C6_band, weight: 1.0 },
                { constraintId: 'CONS_RO_007', constraintName: 'Internal Role Uniqueness (C7)',    score: constraintScores.C7, band: constraintScores.C7_band, weight: 1.5 }
            ] : (integrityPack.constraints?.results || []),
            confidence:   integrityPack.confidence || 'MEDIUM',
            accuracyScore: integrityPack.accuracy?.score || 0,
            accuracyBand:  integrityPack.accuracy?.band || 'FULL',
            bsiScore:      bsiScore,
            bsiBand:       bsiScore < 30 ? 'LOW' : bsiScore < 70 ? 'MEDIUM' : 'HIGH',
            redFlags:      integrityPack.redFlags?.triggered || [],
            warnings:      integrityPack.warnings || [],
            tokenUsage:    totalTokenUsage,
            totalDuration: `${totalDuration.toFixed(2)}s`,
            generatedAt:   new Date()
        };

        // Experience logic moved up to before buildPlaceholderMap

        const userDoc = await db.User.findById(run.userId);
        
        let candidateName = extractedCV?.header?.name 
                           || extractedCV?.candidate_name 
                           || rawParsed.identity?.fullName 
                           || rawParsed.identity?.name 
                           || normalizedProfile.fullName 
                           || normalizedProfile.name;

        if (!candidateName || candidateName.toLowerCase() === 'user' || candidateName.toLowerCase() === 'candidate') {
            candidateName = userDoc?.name || userDoc?.fullName || userDoc?.email?.split('@')[0] || 'Candidate';
        }

        const templateProfile = {
            fullName: candidateName,
            name: candidateName,

            experience: experienceList,
            totalExperienceYears: expYears,

            skills: {
                technical: rawParsed.composition?.skills?.technical
                        || normalizedProfile.composition?.skills?.technical
                        || [],
                languagesSpoken: rawParsed.composition?.languagesSpoken
                              || rawParsed.composition?.skills?.languagesSpoken
                              || []
            },

            education: rawParsed.composition?.education
                    || normalizedProfile.composition?.education
                    || []
        };


        
        // 6. Persistence & Lifecycle
        const reportRasId = `RAS_RPT_${Date.now()}`;
        await db.Ras.create({
            rasId: reportRasId, runId, stepNo: 5, status: 'FINAL',
            artifactType: 'FINAL_REPORT', artifactJson: finalReport
        });

        // --- Immutable S3 Snapshots ---
        let reportPdfUrl = null;
        try {
            // 1. JSON Snapshot
            await s3Service.uploadJsonSnapshot(finalReport, 'snapshots', `RPT_${runId}`);

            // 2. PDF Report
            // Helper to get readable names
            const caseNameMap = { 'CASE_ROLE_OBSOLESCENCE': 'Role Obsolescence Risk' };
            const intentNameMap = {
                'INT_ROLE_RISK_REALITY_CHECK': 'Role Reality Check',
                'INT_ROLE_RISK_EXIT_READINESS': 'Role Risk and Exit Readiness',
                'INT_ROLE_RISK_SURVIVAL_PLAN': 'Role Survival Plan',
                'RO': 'Role Elimination Risk'
            };

            const html = buildReportHtml({
                report: finalReport,
                runId, generatedAt: new Date(),
                accuracyBand: finalReport.accuracyBand,
                role: normalizedProfile.currentRoleTitle
                   || normalizedProfile.roleTitle
                   || normalizedProfile.identity?.currentRoleTitle
                   || 'Professional',
                profile: templateProfile,
                caseName: caseNameMap[run.caseId] || run.caseId,
                intentName: intentNameMap[run.intentId] || run.intentId
            });
            const pdfBuffer = await generatePdfFromHtml(html, {
                displayHeaderFooter: false,
                marginBottom: '0px',
                marginTop: '0px',
                marginLeft: '0px',
                marginRight: '0px'
            });
            const s3Result = await s3Service.uploadFile(
                pdfBuffer,
                `reports/Report_${runId}.pdf`,
                'application/pdf'
            );
            if (s3Result.success) reportPdfUrl = s3Result.url;

        } catch (s3Err) {
            console.error('[Report-S3] Automation Failed:', s3Err.message);
        }

        const settings = await getChatSettings();
        const freeDays = settings?.freeDaysAfterHawkRun || 7;
        const chatExpiryDate = new Date();
        chatExpiryDate.setDate(chatExpiryDate.getDate() + freeDays);

        await db.Runs.updateOne({ runId }, {
            $set: {
                verdict,
                finalReport,
                reportPdfUrl,
                status: 'REPORT_COMPLETE',
                chatExpiryDate,
                completedAt: new Date()
            }
        });

        // Update User document with the expiry date
        await db.User.findByIdAndUpdate(run.userId, { $set: { chatExpiryDate } });

        await createAuditLog(req, 'REPORT_GENERATED', run.userId, {
            runId,
            verdict: finalReport.verdict,
            compositeScore: finalReport.compositeScore,
            duration: finalReport.totalDuration
        });
        clockService.refreshClocksAfterCase(run.userId, runId);

        // Trigger Final Notification
        notificationService.notifyProcessingSuccess(runId, isDisconnected);

        console.timeEnd("Report_Gen");
        
        if (isDisconnected) {
            console.log(`[Report-Gen] Client was disconnected. Skipping HTTP response for runId: ${runId}`);
            return;
        }

        return res.status(200).json({
            success: true,
            data: {
                verdict,
                report: finalReport,
                cost: calculateAICost(finalReport.modelFamily || 'Anthropic-Haiku', finalReport.tokenUsage),
                chatSupport: {
                    isFreeActive: true,
                    freeWindowDays: freeDays,
                    expiryDate: chatExpiryDate,
                    displayMessage: `Expert support is FREE until ${new Date(chatExpiryDate).toLocaleDateString()}.`
                }
            }
        });

    } catch (error) {
        console.error('[Report Engine Error]', error.message);

        // Securely log critical report engine error (Observability D56)
        try {
            const { runId } = req.params;
            const currentRun = await db.Runs.findOne({ runId });

            await db.AuditLog.create({
                action: 'PROCESSING_FAILED',
                userId: currentRun?.userId || null,
                severity: 'CRITICAL',
                metadata: {
                    runId,
                    engineStep: 'REPORT_ENGINE',
                    errorDetails: error.message,
                    timestamp: new Date()
                }
            });

            await db.Runs.updateOne({ runId }, {
                $set: {
                    status: 'PROCESSING_FAILED',
                    failureStep: 'REPORT_GENERATION',
                    failureReason: error.message
                }
            });

            notificationService.notifyProcessingFailure(runId, 'REPORT_GENERATION', error.message);
        } catch (logErr) {
            console.error('[Report Engine Error] Safe logging failed:', logErr.message);
        }

        if (isDisconnected) {
            console.log(`[Report-Gen] Client was disconnected during error. Skipping HTTP error response for runId: ${req.params.runId}`);
            return;
        }
        return res.status(500).json({ success: false, message: `Report generation failed: ${error.message}`, error: error.message });
    }
};

exports.downloadReport = async (req, res) => {
    try {
        const { runId } = req.params;
        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        const [reportRas, userProfile] = await Promise.all([
            db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' }),
            db.UserProfile.findOne({ userId: run.userId })
        ]);

        if (!reportRas) return res.status(404).json({ success: false, message: 'Report not found' });

        const caseNameMap = { 'CASE_ROLE_OBSOLESCENCE': 'Role Obsolescence Risk' };
        const intentNameMap = {
            'INT_ROLE_RISK_REALITY_CHECK': 'Role Reality Check',
            'INT_ROLE_RISK_EXIT_READINESS': 'Role Risk and Exit Readiness',
            'INT_ROLE_RISK_SURVIVAL_PLAN': 'Role Survival Plan',
            'RO': 'Role Elimination Risk'
        };

        const rawParsed = userProfile?.originalParsedData?.structured || run.cvSnapshot?.parsedData || {};
        const normalizedProfile = userProfile?.confirmedProfile || {};
        const experienceList = rawParsed.work?.experience || normalizedProfile.work?.experience || rawParsed.employment?.history || normalizedProfile.employment?.history || [];
        
        let expYears = 'N/A';
        if (rawParsed.work?.totalYears) {
            expYears = rawParsed.work.totalYears;
        } else if (experienceList.length > 0) {
            expYears = experienceList.length * 2;
        }
        
        const mergedProfile = {
            ...normalizedProfile,
            fullName: rawParsed.identity?.fullName || rawParsed.identity?.name || normalizedProfile.fullName || 'Candidate',
            experience: experienceList,
            totalExperienceYears: expYears
        };

        const html = buildReportHtml({
            report: reportRas.artifactJson,
            runId, generatedAt: reportRas.createdAt,
            accuracyBand: reportRas.artifactJson.accuracyBand,
            role: normalizedProfile.identity?.currentRoleTitle || normalizedProfile.currentRoleTitle || 'Professional',
            profile: mergedProfile,
            caseName: caseNameMap[run.caseId] || run.caseId,
            intentName: intentNameMap[run.intentId] || run.intentId
        });

        const pdfBuffer = await generatePdfFromHtml(html, {
            displayHeaderFooter: false,
            marginBottom: '0px',
            marginTop: '0px',
            marginLeft: '0px',
            marginRight: '0px'
        });
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=Report_${runId}.pdf` });
        return res.send(pdfBuffer);
    } catch (err) {
        return res.status(500).json({ success: false, message: `Report download failed: ${err.message}`, error: err.message });
    }
};

exports.sendReportEmail = async (req, res) => {
    try {
        const { runId } = req.params;
        const run = await db.Runs.findOne({ runId }).populate('userId');
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
        
        const user = run.userId;
        const [reportRas, userProfile] = await Promise.all([
            db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' }),
            db.UserProfile.findOne({ userId: user._id })
        ]);

        if (!reportRas) return res.status(404).json({ success: false, message: 'Report not found' });

        const rawParsed = userProfile?.originalParsedData?.structured || run.cvSnapshot?.parsedData || {};
        const normalizedProfile = userProfile?.confirmedProfile || {};
        const experienceList = rawParsed.work?.experience || normalizedProfile.work?.experience || rawParsed.employment?.history || normalizedProfile.employment?.history || [];
        
        let expYears = 'N/A';
        if (rawParsed.work?.totalYears) {
            expYears = rawParsed.work.totalYears;
        } else if (experienceList.length > 0) {
            expYears = experienceList.length * 2;
        }
        
        const mergedProfile = {
            ...normalizedProfile,
            fullName: rawParsed.identity?.fullName || rawParsed.identity?.name || normalizedProfile.fullName || 'Candidate',
            experience: experienceList,
            totalExperienceYears: expYears
        };

        const html = buildReportHtml({
            report: reportRas.artifactJson,
            runId, generatedAt: reportRas.createdAt,
            accuracyBand: reportRas.artifactJson.accuracyBand,
            role: normalizedProfile.identity?.currentRoleTitle || normalizedProfile.currentRoleTitle || 'Professional',
            profile: mergedProfile
        });
        const pdfBuffer = await generatePdfFromHtml(html, {
            displayHeaderFooter: false,
            marginBottom: '0px',
            marginTop: '0px',
            marginLeft: '0px',
            marginRight: '0px'
        });

        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'Gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
            from: `"Hawksyn" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `Hawksyn Report — ${runId}`,
            text: `Hi ${user.name},\n\nYour report is ready. Attached is the PDF.`,
            attachments: [{ filename: `Report_${runId}.pdf`, content: pdfBuffer }]
        });

        return res.status(200).json({ success: true, message: "Email sent." });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Email sending failed: ${err.message}`, error: err.message });
    }
};

exports.refreshReportSection = async (req, res) => {
    try {
        const { runId } = req.params;
        const { sectionId } = req.body;

        if (!runId || !sectionId) return res.status(400).json({ success: false, message: 'runId and sectionId are required.' });

        // 1. Load Data
        const [run, reportArtifact, prompt, ost] = await Promise.all([
            db.Runs.findOne({ runId }),
            db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' }),
            db.PromptConfigRegistry.findOne({ sectionId, isActive: true }), // Find latest active prompt
            db.ObjectiveScoringTaxonomy.findOne({ sectionId, isActive: true }) // Find latest active contract
        ]);

        if (!run) return res.status(404).json({ success: false, message: 'Run not found.' });
        if (!reportArtifact) return res.status(404).json({ success: false, message: 'Final report artifact not found.' });
        if (!prompt) return res.status(404).json({ success: false, message: 'Active prompt for this section not found.' });

        const finalizedReport = reportArtifact.artifactJson;
        const sectionIndex = finalizedReport.sections.findIndex(s => s.sectionId === sectionId);
        if (sectionIndex === -1) return res.status(404).json({ success: false, message: 'Section not found in the report.' });

        const oldSectionData = finalizedReport.sections[sectionIndex];

        // 2. Load Context (Same as generation)
        const rasArtifacts = await db.Ras.find({ runId });
        const signalsRas = rasArtifacts.find(r => r.artifactType === 'EXTERNAL_SIGNALS_CAPTURED');
        const integrityRas = rasArtifacts.find(r => r.artifactType === 'INTEGRITY_PACK');
        const profileRas = rasArtifacts.find(r => r.artifactType === 'PROFILE_CONFIRMED');
        const allObjectiveRas = rasArtifacts.filter(r => r.stepNo === 3 && r.artifactType === 'OBJECTIVE_INPUTS_CAPTURED');

        const profileSnapshot = profileRas?.artifactJson || {};
        const integrityPack = integrityRas?.artifactJson || {};
        const rasAnswers = allObjectiveRas.flatMap(r => r.artifactJson?.answers || []);

        const questionDocs = await db.Questions.find({ questionId: { $in: rasAnswers.map(a => a.questionId) } });
        const questionsMap = {};
        for (const q of questionDocs) questionsMap[q.questionId] = q;

        const placeholders = buildPlaceholderMap(profileSnapshot, rasAnswers, questionsMap, integrityPack, signalsRas?.artifactJson || {});

        // 3. Re-generate Section
        const userPrompt = fillPrompt(prompt.userPrompt, placeholders);

        console.log(`[REFRESH] Section: ${sectionId} | Prompt Version: ${prompt.promptVersion}`);

        const llmResult = await callLLM({
            modelFamily: prompt.modelFamily,
            systemPrompt: (prompt.systemPrompt || '') + (ost?.llmJsonContract ? `\n\nCRITICAL OUTPUT FORMAT (JSON ONLY):\n${ost.llmJsonContract}` : ''),
            userPrompt,
            temperature: 0.3
        });

        // 4. Update Report Artifact
        const newSectionData = {
            ...oldSectionData,
            content: llmResult.text || llmResult,
            promptVersion: prompt.promptVersion,
            ostMetadata: ost ? {
                primaryOutputType: ost.primaryOutputType,
                chartType: ost.chartType,
                chartLibrary: ost.chartLibrary,
                frontendRenderSpec: ost.frontendRenderSpec,
                wordLimit: ost.wordLimit,
                scientificReference: ost.scientificReference
            } : oldSectionData.ostMetadata,
            refreshedAt: new Date()
        };

        finalizedReport.sections[sectionIndex] = newSectionData;

        // 5. Audit Log
        await db.AuditLog.create({
            action: 'REPORT_SECTION_REFRESH',
            userId: req.user?._id,
            metadata: {
                runId,
                sectionId,
                oldContent: oldSectionData.content,
                newContent: newSectionData.content,
                promptVersion: prompt.promptVersion,
                timestamp: new Date()
            }
        });

        await db.Ras.updateOne({ runId, artifactType: 'FINAL_REPORT' }, { $set: { artifactJson: finalizedReport } });
        await db.Runs.updateOne({ runId }, { $set: { finalReport: finalizedReport } });

        return res.status(200).json({
            success: true,
            message: `Section ${sectionId} refreshed successfully.`,
            updatedSection: newSectionData
        });

    } catch (error) {
        console.error('[RefreshSection] Error:', error);
        return res.status(500).json({ success: false, message: `Section refresh failed: ${error.message}`, error: error.message });
    }
};
