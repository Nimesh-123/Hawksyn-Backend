// ════════════════════════════════════════════════════════════
// HAWKSYN — Step 5: Report Generation
// POST /api/v1/runs/:runId/report/generate
// ════════════════════════════════════════════════════════════

const { db }       = require('../models/index.model.js');
const { callLLM }  = require('../../utils/evaluationHelpers.js');
const clockService = require('../services/clockService.js');
const { buildReportHtml } = require('../templates/reportTemplate.js');
const { generatePdfFromHtml } = require('../services/pdfService.js');
const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────────────────
// RAG HELPER — getGoldStandardExamples
// DB se top-rated (5-star) reports fetch karta hai taaki
// AI ko few-shot context mil sake aur better reports generate ho.
// ─────────────────────────────────────────────────────────
async function getGoldStandardExamples(caseId, intentId, limit = 3) {
    try {
        const examples = await db.Ras.find({
            artifactType:  'FINAL_REPORT',
            status:        'FINAL',
            qualityRating: 5,
            'artifactJson.caseId':   caseId,
            'artifactJson.intentId': intentId
        })
        .sort({ qualityRatedAt: -1 })
        .limit(limit)
        .lean();

        return examples.map(ex => anonymizeReport(ex.artifactJson));
    } catch (err) {
        console.warn('[RAG] Could not fetch Gold Standard examples:', err.message);
        return []; // Non-blocking — report generation jari rahega
    }
}

// PII anonymization taaki Gold Standard data safe rahe
function anonymizeReport(reportJson) {
    try {
        let str = JSON.stringify(reportJson);
        // Names (e.g., "Rahul Sharma") → CANDIDATE_NAME
        str = str.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, 'CANDIDATE_NAME');
        // Emails
        str = str.replace(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, 'candidate@example.com');
        // Phone numbers
        str = str.replace(/\b(\+91[\-\s]?)?[6-9]\d{9}\b/g, 'XXXXXXXX');
        return JSON.parse(str);
    } catch {
        return {}; // Parse fail ho toh empty return karo
    }
}


// ─────────────────────────────────────────────────────────
// HELPER 0 — getDeepValue
// Profile snapshot (e.g., identity.currentRole) se deep value nikalta hai
// ─────────────────────────────────────────────────────────
function getDeepValue(obj, path) {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// ─────────────────────────────────────────────────────────
// HELPER 1 — buildPlaceholderMap
// Global placeholders (common to all reports)
// ─────────────────────────────────────────────────────────
function buildPlaceholderMap(profileSnapshot, rasAnswers, questionsMap, integrityPack, externalSignals) {

    // MCQ answers ke liye option label resolve karo
    const answerLabelMap = {};
    for (const ans of (rasAnswers || [])) {
        const { answerValue, answerLabel, questionId } = ans;

        if (answerLabel) {
            answerLabelMap[questionId] = answerLabel;
            continue;
        }

        const q = questionsMap[questionId];
        if (q && q.questionType === 'MCQ' && Array.isArray(q.optionsJson)) {
            const numericValue = Number(answerValue);
            // Match by score (numeric) OR match by label (string)
            const opt = q.optionsJson.find(o => 
                Number(o.score) === numericValue || 
                String(o.opt).toLowerCase() === String(answerValue).toLowerCase()
            );
            
            answerLabelMap[questionId] = opt ? opt.opt : String(answerValue);
        } else {
            answerLabelMap[questionId] = String(answerValue ?? '');
        }
    }

    // Role development
    const currentRole = profileSnapshot.current_role 
        || profileSnapshot.identity?.currentRole 
        || profileSnapshot.identity?.fullName 
        || 'Not provided';

    const experienceYears = profileSnapshot.experience_years 
        || profileSnapshot.work?.totalYearsExperience 
        || (profileSnapshot.work?.experience?.[0]?.duration)
        || 'Not provided';

    // Red flags summary
    const redFlagsSummary = (integrityPack.redFlags?.triggered || [])
        .map(rf => `${rf.redFlagName} (${rf.severityBand})`)
        .join(', ') || 'None';

    // Contradictions summary
    const contradictionsSummary = (integrityPack.contradictions?.triggered || [])
        .map(c => c.contradictionName)
        .join(', ') || 'None';

    // Skills
    const skills = Array.isArray(profileSnapshot.skills)
        ? profileSnapshot.skills.join(', ')
        : (profileSnapshot.skills || 'Not provided');

    const baseMap = {
        CURRENT_ROLE:      currentRole,
        EXPERIENCE_YEARS:  String(experienceYears),
        SKILLS:            skills,
        CURRENT_COMPANY:   profileSnapshot.current_company || profileSnapshot.work?.experience?.[0]?.company || 'Not provided',
        DOMAIN:            profileSnapshot.domain          || profileSnapshot.parsedData?.domain || 'Not provided',
        ACCURACY_SCORE:    String(integrityPack.accuracy?.score  || 0),
        ACCURACY_BAND:     integrityPack.accuracy?.band           || 'UNKNOWN',
        RED_FLAGS:         redFlagsSummary,
        CONTRADICTIONS:    contradictionsSummary,
        TOTAL_PENALTY:     String(integrityPack.accuracy?.totalPenalty || 0),
        // ── External Signal Placeholders (Doc Step 5) ──
        'MARKET_DEMAND_SIGNAL':    externalSignals?.marketDemandSignal?.value    || 'NOT_AVAILABLE',
        'MARKET_DEMAND_RATIONALE': externalSignals?.marketDemandSignal?.rationale || 'No market data available.',
        'AI_DISPLACEMENT_RISK':    externalSignals?.aiDisplacementRisk?.value     || 'NOT_AVAILABLE',
        'AI_DISPLACEMENT_RATIONALE': externalSignals?.aiDisplacementRisk?.rationale || 'No AI risk data available.',
        'INDUSTRY_HIRING_TREND':   externalSignals?.industryHiringTrend?.value    || 'NOT_AVAILABLE',
        'AUTOMATION_OVERLAP':      String(externalSignals?.automationOverlapScore?.value ?? 'NOT_AVAILABLE'),
        'SIGNAL_DATA_QUALITY':     externalSignals?.dataQuality                   || 'INSUFFICIENT',
        'ANALYST_NOTE':            externalSignals?.analystNote                   || 'Insufficient market data for this profile.',
    };

    // Case 1 Legacy Support (Maintain backward compatibility)
    baseMap['AI_EXPOSURE']       = answerLabelMap['Q_AI_ROLE_EXPOSURE_V1']   || 'Not answered';
    baseMap['FINANCIAL_RUNWAY']  = answerLabelMap['Q_FINANCIAL_RUNWAY_V1']   || 'Not answered';
    baseMap['ROLE_UNIQUENESS']   = answerLabelMap['Q_ROLE_UNIQUENESS_V1']    || 'Not answered';
    baseMap['COMPANY_AI_POLICY'] = answerLabelMap['Q_COMPANY_AI_POLICY_V1'] || 'Not answered';

    // All available question answers (indexed by ID)
    for (const [qId, label] of Object.entries(answerLabelMap)) {
        baseMap[qId] = label;
    }

    return baseMap;
}

// ─────────────────────────────────────────────────────────
// HELPER 2 — fillPrompt
// {{PLACEHOLDER}} ko real values se replace karta hai
// ─────────────────────────────────────────────────────────
function fillPrompt(template, placeholders) {
    let result = template;
    for (const [key, val] of Object.entries(placeholders)) {
        result = result.replaceAll(`{{${key}}}`, val ?? 'Not provided');
    }
    return result;
}

// ─────────────────────────────────────────────────────────
// HELPER 3 — checkAnchors
// Section ke required anchors coverage check karta hai
// ─────────────────────────────────────────────────────────
function checkAnchors(section, integrityPack, externalCoverage) {
    const internalAnchors = section.requiredInternalAnchorsJson || [];
    const externalAnchors = section.requiredExternalAnchorsJson || [];

    // Internal anchors → check integrityPack coverage
    const internalResults = integrityPack.coverage?.results || [];
    const missingInternal = internalAnchors.filter(anchor => {
        const result = internalResults.find(c => c.anchor === anchor || c.anchorName === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    // External anchors → check externalCoverage (signals RAS)
    // externalCoverage comes from EXTERNAL_SIGNALS_CAPTURED RAS artifact
    const missingExternal = externalAnchors.filter(anchor => {
        const result = (externalCoverage || []).find(c => c.anchor === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    return {
        allCovered:      missingInternal.length === 0 && missingExternal.length === 0,
        missingInternal,
        missingExternal
    };
}

// ─────────────────────────────────────────────────────────
// HELPER 4 — applyCertaintyCap
// Overconfident language ko soften karta hai
// ─────────────────────────────────────────────────────────
function applyCertaintyCap(text, capPercent, accuracyBand) {
    if (capPercent < 85 || ['LOW', 'VERY_LOW'].includes(accuracyBand)) {
        text = text
            .replace(/\bdefinitely\b/gi,    'likely')
            .replace(/\bcertainly\b/gi,     'probably')
            .replace(/\bwill definitely\b/gi, 'may')
            .replace(/\bguaranteed\b/gi,    'expected')
            .replace(/\bwithout doubt\b/gi, 'likely');
    }

    if (['LOW', 'VERY_LOW'].includes(accuracyBand)) {
        text = `[Limited data confidence — Accuracy Band: ${accuracyBand}]\n\n` + text;
    }

    return text;
}

// ─────────────────────────────────────────────────────────
// HELPER 5 — extractVerdict
// LLM response se PROCEED/PAUSE/ABORT nikalta hai
// ─────────────────────────────────────────────────────────
function extractVerdict(text) {
    const upper = text.toUpperCase();
    if (upper.includes('ABORT'))   return 'ABORT';
    if (upper.includes('PROCEED')) return 'PROCEED';
    if (upper.includes('PAUSE'))   return 'PAUSE';
    return 'PAUSE'; // safe default
}

// ════════════════════════════════════════════════════════════
// MAIN CONTROLLER — generateReport
// POST /api/v1/runs/:runId/report/generate
// ════════════════════════════════════════════════════════════
exports.generateReport = async (req, res) => {
    console.time("Report_Generation_Total");
    const startTime = Date.now();
    try {
        const { runId } = req.params;

        // ── A. Load Run ──
        const run = await db.Runs.findOne({ runId });
        if (!run)
            return res.status(404).json({ success: false, message: 'Run not found' });

        // ── Load Case File (Doc Step 6 output) ──
        const caseFile = await db.CaseFile.findOne({
            runId,
            status: 'LOCKED'
        });

        // Log if Case File missing (non-blocking — report still generates)
        if (!caseFile) {
            console.warn(`[Report] No locked CaseFile for run ${runId}. Proceeding without it.`);
        }

        // ── B. Load integrityPack from RAS (Step 4 output) ──
        const integrityRas = await db.Ras.findOne({
            runId,
            artifactType: 'INTEGRITY_PACK',
            status:       'FINAL'
        });

        if (!integrityRas)
            return res.status(400).json({
                success: false,
                message: 'Integrity Engine not completed. Run Step 4 first.'
            });

        const integrityPack = integrityRas.artifactJson;

        // ── Load External Signals (Doc Step 5 output) ──
        const signalsRas = await db.Ras.findOne({
            runId,
            artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
            status:       'FINAL'
        });
        const externalSignals = signalsRas?.artifactJson?.signals || null;
        const externalCoverage = signalsRas?.artifactJson?.coverage || [];

        // ── C. Load profileSnapshot from RAS (Step 2 output) or Run (fallback) ──
        const profileRas = await db.Ras.findOne({
            runId,
            artifactType: 'PROFILE_CONFIRMED',
            status:       'FINAL'
        });

        const profileSnapshot = profileRas?.artifactJson?.confirmedProfile
            || profileRas?.artifactJson?.profile
            || profileRas?.artifactJson?.parsedData
            || run.cvSnapshot?.parsedData // ✅ Fallback to Run document
            || profileRas?.artifactJson
            || {};

        // ── D. Load all answers from RAS (all batches) ──
        const allObjectiveRas = await db.Ras.find({
            runId: runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            status: 'FINAL'
        });

        // Merge all batches into single answers array
        const rasAnswers = allObjectiveRas.flatMap(r => r.artifactJson?.answers || []);
        
        // Build questionsMap for label lookup
        const questionIds = rasAnswers.map(a => a.questionId);
        const questionDocs = await db.Questions.find({
            questionId: { $in: questionIds }
        });
        const questionsMap = {};
        for (const q of questionDocs) questionsMap[q.questionId] = q;

        // ── E. Load ELR ──
        const elr = await db.EvaluationLibraryRegistry.findOne({
            caseId:           run.caseId,
            intentId:         run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive:         true
        });
        if (!elr)
            return res.status(404).json({ success: false, message: 'ELR not found' });

        // ── F. Load sections in order ──
        const sections = await db.DecisionAssuranceSections.find({
            caseId:   run.caseId,
            intentId: run.intentId,
            isActive: true
        }).sort({ sectionOrder: 1 });

        if (!sections.length)
            return res.status(404).json({ success: false, message: 'No report sections configured' });

        // ── G. Load all prompts into map ──
        const promptDocs = await db.PromptConfigRegistry.find({
            caseId:   run.caseId,
            intentId: run.intentId,
            isActive: true
        });
        const promptsMap = {};
        for (const p of promptDocs) promptsMap[p.sectionId] = p;

        // ── I. Build shared placeholder map ──
        const placeholders = buildPlaceholderMap(
            profileSnapshot,
            rasAnswers,
            questionsMap,
            integrityPack,
            externalSignals
        );

        // ── I2. RAG — Fetch Gold Standard Examples (once, before section loop) ──
        // Ye examples admin-rated 5-star reports hain jo AI ko better context dete hain.
        const goldExamples = await getGoldStandardExamples(run.caseId, run.intentId, 3);
        const goldContextBlock = goldExamples.length > 0
            ? `\n\n--- GOLD STANDARD EXAMPLES (Admin-Approved, ${goldExamples.length} reports) ---\n` +
              `These are real, high-quality reports from similar assessments. Use them as quality benchmarks for tone, depth, and structure:\n\n` +
              goldExamples.map((ex, i) => `[Example ${i + 1}]\n${JSON.stringify(ex.sections?.map(s => ({ id: s.sectionId, content: s.content })) || ex, null, 2)}`).join('\n\n') +
              `\n--- END OF EXAMPLES ---\n`
            : ''; // Koi Gold Standard nahi hai — normal mode mein chalo

        if (goldExamples.length > 0) {
            console.log(`[RAG] Injecting ${goldExamples.length} Gold Standard example(s) for ${run.caseId}/${run.intentId}`);
        } else {
            console.log('[RAG] No Gold Standard examples found — generating without RAG context.');
        }

        const sectionPromises = sections.map(async (section) => {
            const sectionOut = {
                sectionId:     section.sectionId,
                sectionName:   section.sectionName,
                sectionType:   section.sectionType,
                sectionOrder:  section.sectionOrder,
                status:        'PENDING',
                content:       null,
                degraded:      false,
                missingAnchors: []
            };

            // J1. Anchor check
            const anchorCheck = checkAnchors(section, integrityPack, externalCoverage);
            if (!anchorCheck.allCovered) {
                const missing = [...anchorCheck.missingInternal, ...anchorCheck.missingExternal];
                sectionOut.missingAnchors = missing;

                if (section.fallbackPolicy === 'ESCALATE') {
                    sectionOut.status  = 'ESCALATED';
                    sectionOut.content = `Human review required. Missing evidence: ${missing.join(', ')}.`;
                    return sectionOut;
                }

                // DEGRADE — flag karo, continue karo
                sectionOut.degraded = true;
            }

            // J2. Load prompt for this section
            const prompt = promptsMap[section.sectionId];
            if (!prompt) {
                sectionOut.status  = 'SKIPPED';
                sectionOut.content = `No prompt configured for section ${section.sectionId}.`;
                return sectionOut;
            }

            // J3. Fill prompt with real values
            const sectionPlaceholders = { ...placeholders };

            // Dynamic Evidence Placeholder Resolution
            if (prompt.evidencePlaceholdersJson && typeof prompt.evidencePlaceholdersJson === 'object') {
                for (const [phKey, evidenceRef] of Object.entries(prompt.evidencePlaceholdersJson)) {
                    // Resolve from Answers (Already in global placeholders as qId)
                    if (evidenceRef.startsWith('Q_')) {
                        sectionPlaceholders[phKey] = placeholders[evidenceRef] || 'Not answered';
                    }
                    // Resolve from Profile Snapshot (e.g., identity.currentRole)
                    else if (evidenceRef.includes('.') && !evidenceRef.startsWith('INTEGRITY.')) {
                        sectionPlaceholders[phKey] = getDeepValue(profileSnapshot, evidenceRef) || 'Not provided';
                    }
                    // Resolve from Integrity Results (Already available in global but specifically mapped here)
                    else if (evidenceRef === 'INTEGRITY.score') sectionPlaceholders[phKey] = placeholders['ACCURACY_SCORE'];
                    else if (evidenceRef === 'INTEGRITY.band')  sectionPlaceholders[phKey] = placeholders['ACCURACY_BAND'];
                    else if (evidenceRef === 'INTEGRITY.redFlags') sectionPlaceholders[phKey] = placeholders['RED_FLAGS'];
                    else if (evidenceRef === 'INTEGRITY.contradictions') sectionPlaceholders[phKey] = placeholders['CONTRADICTIONS'];
                }
            }

            let filledUserPrompt = fillPrompt(prompt.userPrompt, sectionPlaceholders);

            // Add degraded note if anchors missing
            if (sectionOut.degraded) {
                const missing = [...anchorCheck.missingInternal, ...anchorCheck.missingExternal];
                filledUserPrompt += `\n\n[NOTE: Some evidence is unavailable — Missing: ${missing.join(', ')}. Acknowledge this gap explicitly in your response.]`;
            }

            // J4. Call LLM — with RAG Gold Standard context injected into system prompt
            try {
                console.time(`Section_${section.sectionId}`);
                // Append gold standard examples to system prompt (only if available)
                const enrichedSystemPrompt = prompt.systemPrompt + goldContextBlock;

                let llmText = await callLLM({
                    modelFamily:  prompt.modelFamily,
                    systemPrompt: enrichedSystemPrompt,
                    userPrompt:   filledUserPrompt,
                    temperature:  prompt.temperature || 0.3,
                    maxTokens:    prompt.maxTokens   || 600
                });
                console.timeEnd(`Section_${section.sectionId}`);

                // J5. Apply certainty cap
                llmText = applyCertaintyCap(
                    llmText,
                    prompt.certaintyCapPercent || 85,
                    integrityPack.accuracy?.band || 'MEDIUM'
                );

                sectionOut.content = llmText;
                sectionOut.status  = sectionOut.degraded ? 'DEGRADED' : 'COMPLETE';
                return sectionOut;

            } catch (llmErr) {
                console.error(`[Report] LLM error — ${section.sectionId}:`, llmErr.message);
                sectionOut.status  = 'LLM_ERROR';
                sectionOut.content = 'Section generation failed. Please retry.';
                return sectionOut;
            }
        });

        const reportSections = await Promise.all(sectionPromises);

        // ── K. Extract verdict from completed sections ──
        const verdictSection = reportSections.find(s => s.sectionType === 'VERDICT');
        let verdict = null;
        if (verdictSection && (verdictSection.status === 'COMPLETE' || verdictSection.status === 'DEGRADED')) {
            verdict = extractVerdict(verdictSection.content);
        }

        // ── K. Build final report ──
        const finalReport = {
            runId,
            caseId:            run.caseId,
            intentId:          run.intentId,
            playbookVersionId: run.playbookVersionId,
            sections:          reportSections,
            verdict:           verdict || 'PAUSE',
            accuracyScore:     integrityPack.accuracy?.score     || 0,
            accuracyBand:      integrityPack.accuracy?.band      || 'UNKNOWN',
            warnings:          integrityPack.warnings            || [],
            redFlags:          integrityPack.redFlags?.triggered || [],
            hasTerminalFailure: integrityPack.hasTerminalFailure || false,
            requiresEscalation: integrityPack.requiresEscalation || false,
            generatedAt:       new Date()
        };

        // ── L. Save as RAS artifact ──
        const reportRasId = `RAS_RPT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        await db.Ras.create({
            rasId:           reportRasId,
            runId,
            stepNo:          5,
            artifactType:    'FINAL_REPORT',
            artifactVersion: 1,
            artifactJson:    finalReport,
            status:          'FINAL'
        });

        // ── M. Update Run status ──
        await db.Runs.updateOne(
            { runId },
            {
                $set: {
                    verdict: verdict || 'PAUSE',
                    finalReport: finalReport,
                    status:  'REPORT_COMPLETE'
                }
            }
        );

        // ✅ NEW: Trigger Case Recalibration (30-Day Upgrade)
        // This resets clocks to 'Live' for 30 days per 'The Four Clocks Recalibration Logic'
        clockService.refreshClocksAfterCase(run.userId, runId);

        const duration = (Date.now() - startTime) / 1000;
        console.timeEnd("Report_Generation_Total");
        console.log(`[Report] Generated in ${duration}s for Run: ${runId}`);

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId:   reportRasId,
                verdict: verdict || 'PAUSE',
                report:  finalReport,
                duration: `${duration}s`,
                message: 'Report generated successfully.'
            }
        });

    } catch (error) {
        console.error('[Report Generation Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// API 6 — GET /api/v1/runs/:runId/report/download
// Generates and downloads the PDF report.
// ─────────────────────────────────────────────────────────
exports.downloadReport = async (req, res) => {
    try {
        const { runId } = req.params;
        const reportRas = await db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' });
        if (!reportRas) return res.status(404).json({ success: false, message: 'Report not found' });

        const userProfile = await db.UserProfile.findOne({ userId: req.user.id });
        const profile = userProfile?.confirmedProfile || {};

        const html = buildReportHtml({
            report: reportRas.artifactJson,
            runId,
            generatedAt: reportRas.createdAt,
            verdict: reportRas.artifactJson.verdict,
            accuracyScore: reportRas.artifactJson.accuracyScore,
            accuracyBand: reportRas.artifactJson.accuracyBand,
            role: profile.identity?.currentRoleTitle || profile.current_role || 'Professional'
        });

        const pdfBuffer = await generatePdfFromHtml(html);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Hawksyn_Report_${runId}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        return res.send(pdfBuffer);
    } catch (err) {
        console.error('[DownloadReport] Error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────
// API 7 — POST /api/v1/runs/:runId/report/email
// Generates PDF and sends via NodeMailer.
// ─────────────────────────────────────────────────────────
exports.sendReportEmail = async (req, res) => {
    try {
        const { runId } = req.params;
        const user = await db.User.findById(req.user.id);
        const reportRas = await db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' });
        if (!reportRas) return res.status(404).json({ success: false, message: 'Report not found' });

        const userProfile = await db.UserProfile.findOne({ userId: req.user.id });
        const profile = userProfile?.confirmedProfile || {};

        // 1. Generate PDF
        const html = buildReportHtml({
            report: reportRas.artifactJson,
            runId,
            generatedAt: reportRas.createdAt,
            verdict: reportRas.artifactJson.verdict,
            accuracyScore: reportRas.artifactJson.accuracyScore,
            accuracyBand: reportRas.artifactJson.accuracyBand,
            role: profile.identity?.currentRoleTitle || profile.current_role || 'Professional'
        });
        const pdfBuffer = await generatePdfFromHtml(html);

        // 2. Transporter Setup
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // 3. Send Email
        await transporter.sendMail({
            from: `"Hawksyn" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `Your Hawksyn Decision Assurance Report — ${runId}`,
            text: `Hi ${user.name || 'Professional'},\n\nYour career risk assessment report is ready. Please find the attached PDF report.\n\nBest regards,\nTeam Hawksyn`,
            attachments: [
                {
                    filename: `Hawksyn_Report_${runId}.pdf`,
                    content: pdfBuffer
                }
            ]
        });

        return res.status(200).json({ success: true, message: `Report emailed successfully to ${user.email}` });
    } catch (err) {
        console.error('[EmailReport] Error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};
