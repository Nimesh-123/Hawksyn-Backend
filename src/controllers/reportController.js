const { db } = require('../models/index.model.js');
const { callLLM } = require('../../utils/evaluationHelpers.js');
const clockService = require('../services/clockService.js');
const { buildReportHtml } = require('../templates/reportTemplate.js');
const { generatePdfFromHtml } = require('../services/pdfService.js');
const nodemailer = require('nodemailer');

const {
    anonymizeReport,
    getDeepValue,
    buildPlaceholderMap,
    fillPrompt,
    checkAnchors,
    applyCertaintyCap,
    extractVerdict,
    getGoldStandardExamples
} = require('../../utils/reportHelpers.js');



/**
 * API — Generate Assessment Report (Step 6)
 */
exports.generateReport = async (req, res) => {
    console.time("Report_Gen");
    const startTime = Date.now();
    try {
        const { runId } = req.params;

        // 1. Data Loading (Run, Integrity, Signals, Profile)
        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        const [integrityRas, signalsRas, profileRas, allObjectiveRas] = await Promise.all([
            db.Ras.findOne({ runId, artifactType: 'INTEGRITY_PACK', status: 'FINAL' }),
            db.Ras.findOne({ runId, artifactType: 'EXTERNAL_SIGNALS_CAPTURED', status: 'FINAL' }),
            db.Ras.findOne({ runId, artifactType: 'PROFILE_CONFIRMED', status: 'FINAL' }),
            db.Ras.find({ runId, stepNo: 3, artifactType: 'OBJECTIVE_INPUTS_CAPTURED', status: 'FINAL' })
        ]);

        if (!integrityRas) return res.status(400).json({ success: false, message: 'Integrity Audit missing.' });

        const integrityPack = integrityRas.artifactJson;
        const externalSignals = signalsRas?.artifactJson?.signals || null;
        const externalCoverage = signalsRas?.artifactJson?.coverage || [];

        const profileSnapshot = profileRas?.artifactJson?.confirmedProfile
            || profileRas?.artifactJson?.profile
            || profileRas?.artifactJson?.parsedData
            || run.cvSnapshot?.parsedData || {};

        const rasAnswers = allObjectiveRas.flatMap(r => r.artifactJson?.answers || []);
        const questionDocs = await db.Questions.find({ questionId: { $in: rasAnswers.map(a => a.questionId) } });
        const questionsMap = {};
        for (const q of questionDocs) questionsMap[q.questionId] = q;

        // 2. Load Configuration (ELR, Sections, Prompts)
        const [elr, sections, promptDocs] = await Promise.all([
            db.EvaluationLibraryRegistry.findOne({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] }, isActive: true }),
            db.DecisionAssuranceSections.find({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] }, isActive: true }).sort({ sectionOrder: 1 }),
            db.PromptConfigRegistry.find({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] }, isActive: true })
        ]);

        if (!sections.length) return res.status(404).json({ success: false, message: 'No sections configured.' });

        const promptsMap = {};
        for (const p of promptDocs) promptsMap[p.sectionId] = p;

        // 3. Build RAG & Mapping Context
        const placeholders = buildPlaceholderMap(profileSnapshot, rasAnswers, questionsMap, integrityPack, externalSignals);
        const goldExamples = await getGoldStandardExamples(db, run.caseId, run.intentId, 3);
        const goldContextBlock = goldExamples.length > 0
            ? `\n\n--- GOLD STANDARD EXAMPLES (${goldExamples.length}) ---\n` +
            goldExamples.map((ex, i) => `[Ex ${i + 1}]\n${JSON.stringify(ex.sections?.map(s => ({ id: s.sectionId, content: s.content })) || ex, null, 2)}`).join('\n\n')
            : '';

        // 4. Section-wise Generation Pipeline (Parallel Execution via Semaphore)
        const reportSections = await Promise.all(sections.map(async (section) => {
            const sectionOut = {
                sectionId: section.sectionId,
                sectionName: section.sectionName,
                sectionType: section.sectionType,
                sectionOrder: section.sectionOrder,
                status: 'PENDING'
            };

            const anchorCheck = checkAnchors(section, integrityPack, externalCoverage);
            if (!anchorCheck.allCovered && section.fallbackPolicy === 'ESCALATE') {
                sectionOut.status = 'ESCALATED';
                sectionOut.content = "Missing required evidence anchors.";
                return sectionOut;
            }

            const prompt = promptsMap[section.sectionId];
            if (!prompt) {
                sectionOut.status = 'SKIPPED';
                return sectionOut;
            }

            // Resolve Dynamic Evidence for this section
            const sectionPlaceholders = { ...placeholders };
            if (prompt.evidencePlaceholdersJson) {
                for (const [phKey, ref] of Object.entries(prompt.evidencePlaceholdersJson)) {
                    if (ref.startsWith('Q_')) sectionPlaceholders[phKey] = placeholders[ref] || 'N/A';
                    else if (ref.includes('.') && !ref.startsWith('INTEGRITY.')) sectionPlaceholders[phKey] = getDeepValue(profileSnapshot, ref) || 'N/A';
                }
            }

            try {
                let userPrompt = fillPrompt(prompt.userPrompt, sectionPlaceholders);
                if (!anchorCheck.allCovered) userPrompt += `\n[NOTE: Missing evidence: ${[...anchorCheck.missingInternal, ...anchorCheck.missingExternal].join(', ')}]`;

                const llmResult = await callLLM({
                    modelFamily: prompt.modelFamily,
                    systemPrompt: (prompt.systemPrompt || '') + goldContextBlock,
                    userPrompt,
                    temperature: prompt.temperature || 0.3,
                    maxTokens: prompt.maxTokens || 800
                });

                sectionOut.content = applyCertaintyCap(llmResult.text, prompt.certaintyCapPercent || 85, integrityPack.accuracy?.band);
                sectionOut.status = anchorCheck.allCovered ? 'COMPLETE' : 'DEGRADED';
                sectionOut.tokenUsage = llmResult.usageMetadata;
                sectionOut.duration = llmResult.duration;
                return sectionOut;
            } catch (llmErr) {
                console.error(`[Report-Gen] CRITICAL SECTION FAILURE (${section.sectionId}):`, llmErr.message);
                sectionOut.status = 'LLM_ERROR';
                sectionOut.content = 'Generation failed.';
                return sectionOut;
            }
        }));

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
            verdict,
            compositeScore: integrityPack.compositeScore || 0,
            confidence: integrityPack.confidence || 'MEDIUM',
            accuracyScore: integrityPack.accuracy?.score || 0,
            accuracyBand: integrityPack.accuracy?.band || 'UNKNOWN',
            tokenUsage: totalTokenUsage,
            totalDuration: `${totalDuration.toFixed(2)}s`,
            generatedAt: new Date()
        };

        // 6. Persistence & Lifecycle
        const reportRasId = `RAS_RPT_${Date.now()}`;
        await db.Ras.create({
            rasId: reportRasId, runId, stepNo: 5, status: 'FINAL',
            artifactType: 'FINAL_REPORT', artifactJson: finalReport
        });

        await db.Runs.updateOne({ runId }, { $set: { verdict, finalReport, status: 'REPORT_COMPLETE' } });
        clockService.refreshClocksAfterCase(run.userId, runId);

        console.timeEnd("Report_Gen");
        return res.status(200).json({ success: true, data: { verdict, report: finalReport } });

    } catch (error) {
        console.error('[Report Engine Error]', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API — Download PDF
 */
exports.downloadReport = async (req, res) => {
    try {
        const { runId } = req.params;
        const [reportRas, userProfile] = await Promise.all([
            db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' }),
            db.UserProfile.findOne({ userId: req.user.id })
        ]);

        if (!reportRas) return res.status(404).json({ success: false, message: 'Report not found' });

        const html = buildReportHtml({
            report: reportRas.artifactJson,
            runId, generatedAt: reportRas.createdAt,
            accuracyBand: reportRas.artifactJson.accuracyBand,
            role: userProfile?.confirmedProfile?.identity?.currentRoleTitle || 'Professional'
        });

        const pdfBuffer = await generatePdfFromHtml(html);
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=Report_${runId}.pdf` });
        return res.send(pdfBuffer);
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

/**
 * API — Email PDF
 */
exports.sendReportEmail = async (req, res) => {
    try {
        const { runId } = req.params;
        const [user, reportRas, userProfile] = await Promise.all([
            db.User.findById(req.user.id),
            db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' }),
            db.UserProfile.findOne({ userId: req.user.id })
        ]);

        if (!reportRas) return res.status(404).json({ success: false, message: 'Report not found' });

        const html = buildReportHtml({
            report: reportRas.artifactJson,
            runId, generatedAt: reportRas.createdAt,
            role: userProfile?.confirmedProfile?.identity?.currentRoleTitle || 'Professional'
        });
        const pdfBuffer = await generatePdfFromHtml(html);

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
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};
