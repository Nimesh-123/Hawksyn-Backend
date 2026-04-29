const { db } = require('../models/index.model.js');
const notificationService = require('../services/notificationService');
const { callLLM } = require('../../utils/evaluationHelpers.js');
const clockService = require('../services/clockService.js');
const { buildReportHtml } = require('../templates/reportTemplate.js');
const { generatePdfFromHtml } = require('../services/pdfService.js');
const s3Service = require('../../utils/s3');
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

        const goldExamples = await getGoldStandardExamples(db, run.caseId, run.intentId, 3);
        const goldContextBlock = goldExamples.length > 0
            ? `\n\n--- GOLD STANDARD EXAMPLES (${goldExamples.length}) ---\n` +
            goldExamples.map((ex, i) => `[Ex ${i + 1}]\n${JSON.stringify(ex.sections?.map(s => ({ id: s.sectionId, content: s.content })) || ex, null, 2)}`).join('\n\n')
            : "";

        // 4. Parallel Generation of Sections
        const sectionPromises = sections.map(async (section) => {
            const prompt = promptsMap[section.sectionId];
            const sectionOut = {
                sectionId: section.sectionId,
                sectionName: section.sectionName,
                sectionType: section.sectionType,
                sectionOrder: section.sectionOrder,
                promptVersion: prompt?.promptVersion || 1, // Capture for Audit Trail
                status: 'PENDING'
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

        // --- NEW: Immutable S3 Snapshots (Sprint 7/8) ---
        let reportPdfUrl = null;
        try {
            // 1. JSON Snapshot
            await s3Service.uploadJsonSnapshot(finalReport, 'snapshots', `RPT_${runId}`);

            // 2. PDF Report
            const html = buildReportHtml({
                report: finalReport,
                runId, generatedAt: new Date(),
                accuracyBand: finalReport.accuracyBand,
                role: profileSnapshot?.identity?.currentRoleTitle || 'Professional'
            });
            const pdfBuffer = await generatePdfFromHtml(html);
            const s3Result = await s3Service.uploadFile(
                pdfBuffer,
                `reports/Report_${runId}.pdf`,
                'application/pdf'
            );
            if (s3Result.success) reportPdfUrl = s3Result.url;

        } catch (s3Err) {
            console.error('[Report-S3] Automation Failed:', s3Err.message);
        }

        await db.Runs.updateOne({ runId }, {
            $set: {
                verdict,
                finalReport,
                reportPdfUrl,
                status: 'REPORT_COMPLETE',
                chatExpiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                completedAt: new Date()
            }
        });
        clockService.refreshClocksAfterCase(run.userId, runId);

        // Trigger Final Notification
        notificationService.notifyProcessingSuccess(runId);

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

/**
 * API — Refresh a specific Report Section (Sprint 7/8 Audit Trail)
 */
exports.refreshReportSection = async (req, res) => {
    try {
        const { runId } = req.params;
        const { sectionId } = req.body;

        if (!runId || !sectionId) return res.status(400).json({ success: false, message: 'runId and sectionId are required.' });

        // 1. Load Data
        const [run, reportArtifact, prompt] = await Promise.all([
            db.Runs.findOne({ runId }),
            db.Ras.findOne({ runId, artifactType: 'FINAL_REPORT' }),
            db.PromptConfigRegistry.findOne({ sectionId, isActive: true }) // Find latest active prompt
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

        const placeholders = buildPlaceholderMap(profileSnapshot, rasArtifacts, questionsMap, integrityPack, signalsRas?.artifactJson || {});

        // 3. Re-generate Section
        const userPrompt = fillPrompt(prompt.userPrompt, placeholders);

        console.log(`[REFRESH] Section: ${sectionId} | Prompt Version: ${prompt.promptVersion}`);

        const llmResult = await callLLM({
            modelFamily: prompt.modelFamily,
            systemPrompt: prompt.systemPrompt,
            userPrompt,
            temperature: 0.3
        });

        // 4. Update Report Artifact
        const newSectionData = {
            ...oldSectionData,
            content: llmResult.text || llmResult,
            promptVersion: prompt.promptVersion,
            refreshedAt: new Date()
        };

        finalizedReport.sections[sectionIndex] = newSectionData;

        // 5. Audit Log (Task D35)
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
        return res.status(500).json({ success: false, message: error.message });
    }
};
