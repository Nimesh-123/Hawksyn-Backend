const { db } = require('../models/index.model.js');
const { callLLM } = require('../../utils/evaluationHelpers.js');
const clockService = require('../services/clockService.js');
const { buildReportHtml } = require('../templates/reportTemplate.js');
const { generatePdfFromHtml } = require('../services/pdfService.js');
const path = require('path');
const fs = require('fs');
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

        const rasArtifacts = await db.Ras.find({ runId });
        const integrityRas = rasArtifacts.find(r => r.artifactType === 'INTEGRITY_PACK');
        const signalsRas = rasArtifacts.find(r => r.artifactType === 'EXTERNAL_SIGNALS_CAPTURED');
        const profileRas = rasArtifacts.find(r => r.artifactType === 'PROFILE_CONFIRMED');
        const allObjectiveRas = rasArtifacts.filter(r => r.stepNo === 3 && r.artifactType === 'OBJECTIVE_INPUTS_CAPTURED');

        const profileSnapshot = profileRas?.artifactJson || run.cvSnapshot?.parsedData || {};

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
        const externalSignals = signalsRas?.artifactJson?.signals || null;
        
        const externalCoverage = signalsRas?.artifactJson?.coverage || [];

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
        const placeholders = buildPlaceholderMap(
            normalizedProfile, 
            rasArtifacts.filter(a => a.artifactType === 'QUESTION_ANSWERED' || a.artifactType === 'OBJECTIVE_INPUTS_CAPTURED'),
            questionsMap,
            integrityRas?.artifactJson || {},
            signalsRas?.artifactJson || {}
        );

        // Audit Trail: Save evidence package for production debugging
        try {
            const logDir = path.join(process.cwd(), 'logs', 'evidence');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            const snapshot = JSON.stringify(placeholders, null, 2);
            fs.writeFileSync(path.join(logDir, `${runId}_evidence.json`), snapshot);
            console.log(`[AUDIT-EVIDENCE] Run: ${runId} | Snapshot:\n${snapshot}`);
        } catch (logErr) {
            console.warn('[Report-Audit] Failed to save evidence snapshot:', logErr.message);
        }
        const goldExamples = await getGoldStandardExamples(db, run.caseId, run.intentId, 3);
        const goldContextBlock = goldExamples.length > 0
            ? `\n\n--- GOLD STANDARD EXAMPLES (${goldExamples.length}) ---\n` +
            goldExamples.map((ex, i) => `[Ex ${i + 1}]\n${JSON.stringify(ex.sections?.map(s => ({ id: s.sectionId, content: s.content })) || ex, null, 2)}`).join('\n\n')
            : "";

        // 4. Parallel Generation of Sections
        const sectionPromises = sections.map(async (section) => {
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
                    // 1. New Structured Object Mapping
                    if (ref && typeof ref === 'object') {
                        if (ref.source === 'answers' && ref.questionId) {
                            sectionPlaceholders[phKey] = placeholders[ref.questionId] || 'N/A';
                        } else if (ref.source === 'signals' || ref.source === 'externalSignals') {
                            if (ref.signalId) {
                                const sigRef = externalSignals?.[ref.signalId];
                                sectionPlaceholders[phKey] = sigRef ? String(sigRef[ref.field || 'value'] || 'N/A') : 'N/A';
                            } else if (Array.isArray(ref.filter)) {
                                const filtered = {};
                                ref.filter.forEach(fid => {
                                    if (externalSignals?.[fid]) filtered[fid] = externalSignals[fid];
                                });
                                sectionPlaceholders[phKey] = JSON.stringify(filtered, null, 2);
                            }
                        } else if (ref.source === 'integrity' && ref.path) {
                            sectionPlaceholders[phKey] = String(getDeepValue(integrityPack, ref.path) || 'N/A');
                        }
                        continue;
                    }

                    // 2. Legacy String-based Mapping
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

                const llmResult = await callLLM({
                    modelFamily: prompt.modelFamily,
                    forceProvider: 'Gemini',
                    systemPrompt: (prompt.systemPrompt || '') + 
                        "\n\n--- COMPREHENSIVE EVIDENCE PACKAGE ---\n" +
                        JSON.stringify(placeholders, null, 2) +
                        "\n\nSTRICT GROUNDING RULES:\n" +
                        "1. Use the provided EVIDENCE PACKAGE as the primary source of truth.\n" +
                        "2. If a specific placeholder is N/A but the evidence package has the data, use the data from the package.\n" +
                        "3. Do not say data is missing if it is in the package above.\n" +
                        "4. DO NOT mention surveys, inventories, or frameworks (e.g. 'Burnout Inventory', 'Stress Survey') unless they appear explicitly in the evidence.\n" +
                        "5. If specific evidence is missing, do not simply state 'UNKNOWN'. Instead, provide a professional 'Pro-Tip' or 'General Advisory' relevant to the section's topic and the user's role (e.g., Backend Engineer), ensuring the feedback remains valuable even with data gaps.\n" +
                        goldContextBlock,
                    userPrompt,
                    temperature: prompt.temperature || 0.3,
                    maxTokens: prompt.maxTokens || 1500
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
        });

        const reportSections = await Promise.all(sectionPromises);

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
