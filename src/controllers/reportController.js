// ════════════════════════════════════════════════════════════
// HAWKSYN — Step 5: Report Generation
// POST /api/v1/runs/:runId/report/generate
// ════════════════════════════════════════════════════════════

const { db }       = require('../models/index.model.js');
const { callLLM }  = require('../../utils/evaluationHelpers.js');

// ─────────────────────────────────────────────────────────
// HELPER 1 — buildPlaceholderMap
// Sab placeholder values ek jagah assemble karta hai
// ─────────────────────────────────────────────────────────
function buildPlaceholderMap(profileSnapshot, answersMap, questionsMap, integrityPack) {

    // MCQ answers ke liye option label resolve karo
    const answerLabelMap = {};
    for (const [questionId, data] of Object.entries(answersMap)) {
        const { value: answerValue, label: savedLabel } = 
            typeof data === 'object' ? data : { value: data, label: null };

        if (savedLabel) {
            answerLabelMap[questionId] = savedLabel;
            continue;
        }

        const q = questionsMap[questionId];
        if (q && q.questionType === 'MCQ' && Array.isArray(q.optionsJson)) {
            const numericAnswer = Number(answerValue);
            // Match by score (numeric) OR match by label (string)
            const opt = q.optionsJson.find(o => 
                Number(o.score) === numericAnswer || 
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

    return {
        CURRENT_ROLE:      currentRole,
        EXPERIENCE_YEARS:  String(experienceYears),
        SKILLS:            skills,
        CURRENT_COMPANY:   profileSnapshot.current_company || profileSnapshot.work?.experience?.[0]?.company || 'Not provided',
        DOMAIN:            profileSnapshot.domain          || profileSnapshot.parsedData?.domain || 'Not provided',
        AI_EXPOSURE:       answerLabelMap['Q_AI_ROLE_EXPOSURE_V1']   || 'Not answered',
        FINANCIAL_RUNWAY:  answerLabelMap['Q_FINANCIAL_RUNWAY_V1']   || 'Not answered',
        ROLE_UNIQUENESS:   answerLabelMap['Q_ROLE_UNIQUENESS_V1']    || 'Not answered',
        COMPANY_AI_POLICY: answerLabelMap['Q_COMPANY_AI_POLICY_V1'] || 'Not answered',
        ACCURACY_SCORE:    String(integrityPack.accuracy?.score  || 0),
        ACCURACY_BAND:     integrityPack.accuracy?.band           || 'UNKNOWN',
        RED_FLAGS:         redFlagsSummary,
        CONTRADICTIONS:    contradictionsSummary,
        TOTAL_PENALTY:     String(integrityPack.accuracy?.totalPenalty || 0)
    };
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
function checkAnchors(section, integrityPack) {
    const coverageResults = integrityPack.coverage?.results || [];

    const missingInternal = (section.requiredInternalAnchorsJson || []).filter(anchor => {
        const result = coverageResults.find(c => c.anchor === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    const missingExternal = (section.requiredExternalAnchorsJson || []).filter(anchor => {
        const result = coverageResults.find(c => c.anchor === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    return {
        allCovered:  missingInternal.length === 0 && missingExternal.length === 0,
        allMissing:  [...missingInternal, ...missingExternal]
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

        // ── D. Load answers from RAS (Step 3 output) ──
        const answersRas = await db.Ras.find({
            runId: runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            status: 'FINAL'
        });
        const answersMap = {};
        answersRas.forEach(record => {
            (record.artifactJson?.answers || []).forEach(a => {
                // Store both value and label for mapping robustness
                answersMap[a.questionId] = { value: a.answerValue, label: a.answerLabel };
            });
        });

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

        // ── H. Load questions for answer label resolution ──
        const questionIds  = Object.keys(answersMap);
        const questionDocs = await db.Questions.find({
            questionId: { $in: questionIds }
        });
        const questionsMap = {};
        for (const q of questionDocs) questionsMap[q.questionId] = q;

        // ── I. Build shared placeholder map ──
        const placeholders = buildPlaceholderMap(
            profileSnapshot,
            answersMap,
            questionsMap,
            integrityPack
        );

        // ── J. Process each section in PARALLEL — ⚡ FAST MODE ⚡ ──
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
            const anchorCheck = checkAnchors(section, integrityPack);
            if (!anchorCheck.allCovered) {
                sectionOut.missingAnchors = anchorCheck.allMissing;

                if (section.fallbackPolicy === 'ESCALATE') {
                    sectionOut.status  = 'ESCALATED';
                    sectionOut.content = `Human review required. Missing evidence: ${anchorCheck.allMissing.join(', ')}.`;
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
            let filledUserPrompt = fillPrompt(prompt.userPrompt, placeholders);

            // Add degraded note if anchors missing
            if (sectionOut.degraded) {
                filledUserPrompt += `\n\n[NOTE: Some evidence is unavailable — Missing: ${anchorCheck.allMissing.join(', ')}. Acknowledge this gap explicitly in your response.]`;
            }

            // J4. Call LLM
            try {
                console.time(`Section_${section.sectionId}`);
                let llmText = await callLLM({
                    modelFamily:  prompt.modelFamily,
                    systemPrompt: prompt.systemPrompt,
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
