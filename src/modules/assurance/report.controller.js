const { db } = require('../../models/index.model.js');
const notificationService = require('../../services/notificationService');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { calculateAICost } = require('../admin/helpers/aiCostHelper.js');
const { callLLM } = require('./helpers/evaluationHelpers.js');
const clockService = require('../../services/clockService.js');
const { buildReportHtml } = require('./templates/reportTemplate.js');
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

                    const systemPromptBase = (prompt.systemPrompt || '') +
                        (ostContract ? `\n\nCRITICAL OUTPUT FORMAT (JSON ONLY):\n${ostContract}` : '') +
                        "\n\n--- COMPREHENSIVE EVIDENCE PACKAGE ---\n" +
                        JSON.stringify(placeholders, null, 2) +
                        "\n\nSTRICT GROUNDING RULES:\n" +
                        "1. Use the provided EVIDENCE PACKAGE as the primary source of truth.\n" +
                        "2. Do not say data is missing if it is in the package above.\n" +
                        "3. DO NOT mention surveys or inventories unless they appear explicitly in the evidence.\n" +
                        "4. STRUCTURE: Use Bullet Points (•) for multi-sentence descriptions, action items, or key findings to ensure high readability.\n" +
                        "5. If specific evidence is missing, provide a professional 'Pro-Tip' relevant to the user's role: " + (normalizedProfile.currentRoleTitle || 'Professional');

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
                            forceProvider: 'Gemini',
                            systemPrompt: systemPromptBase + "\n\nROLE: You are the Adversarial Challenger.",
                            userPrompt: challengerPrompt,
                            temperature: 0.5,
                            maxTokens: prompt.maxTokens || 1500
                        });

                        const mergerPrompt = `Merge the PRIMARY DRAFT and the ADVERSARIAL CRITIQUE into a professional, highly balanced final section output. Ensure it reads cohesively.\n\nPRIMARY DRAFT:\n${llmResult.text}\n\nADVERSARIAL CRITIQUE:\n${challengerResult.text}`;

                        const mergerResult = await callLLM({
                            modelFamily: prompt.modelFamily,
                            forceProvider: 'Gemini',
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

                    sectionOut.content = applyCertaintyCap(llmResult.text, prompt.certaintyCapPercent || 85, integrityPack.accuracy?.band);
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
            verdict,
            compositeScore: integrityPack.compositeScore || 0,
            confidence: integrityPack.confidence || 'MEDIUM',
            accuracyScore: integrityPack.accuracy?.score || 0,
            accuracyBand: integrityPack.accuracy?.band || 'UNKNOWN',
            redFlags: integrityPack.redFlags?.triggered || [],
            warnings: integrityPack.warnings || [],
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

        // --- Immutable S3 Snapshots ---
        let reportPdfUrl = null;
        try {
            // 1. JSON Snapshot
            await s3Service.uploadJsonSnapshot(finalReport, 'snapshots', `RPT_${runId}`);

            // 2. PDF Report
            const html = buildReportHtml({
                report: finalReport,
                runId, generatedAt: new Date(),
                accuracyBand: finalReport.accuracyBand,
                role: profileSnapshot?.identity?.currentRoleTitle || 'Professional',
                profile: normalizedProfile
            });
            const pdfBuffer = await generatePdfFromHtml(html, {
                displayHeaderFooter: true,
                headerTemplate: '<span></span>',
                footerTemplate: `
                  <div style="font-family: 'Inter', sans-serif; width: 100%; display: flex; justify-content: space-between; font-size: 7.5pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; margin: 0 15mm; box-sizing: border-box; -webkit-print-color-adjust: exact;">
                    <span>Case #${runId} | Hawksyn AI 2.0</span>
                    <span>Page <span class="pageNumber"></span></span>
                  </div>
                `,
                marginBottom: '20mm',
                marginTop: '15mm'
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
        notificationService.notifyProcessingSuccess(runId);

        console.timeEnd("Report_Gen");
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

        return res.status(500).json({ success: false, message: `Report generation failed: ${error.message}`, error: error.message });
    }
};

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
            role: userProfile?.confirmedProfile?.identity?.currentRoleTitle || 'Professional',
            profile: userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured
        });

        const pdfBuffer = await generatePdfFromHtml(html, {
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `
              <div style="font-family: 'Inter', sans-serif; width: 100%; display: flex; justify-content: space-between; font-size: 7.5pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; margin: 0 15mm; box-sizing: border-box; -webkit-print-color-adjust: exact;">
                <span>Case #${runId} | Hawksyn AI 2.0</span>
                <span>Page <span class="pageNumber"></span></span>
              </div>
            `,
            marginBottom: '20mm',
            marginTop: '15mm'
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
        const pdfBuffer = await generatePdfFromHtml(html, {
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `
              <div style="font-family: 'Inter', sans-serif; width: 100%; display: flex; justify-content: space-between; font-size: 7.5pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; margin: 0 15mm; box-sizing: border-box; -webkit-print-color-adjust: exact;">
                <span>Case #${runId} | Hawksyn AI 2.0</span>
                <span>Page <span class="pageNumber"></span></span>
              </div>
            `,
            marginBottom: '20mm',
            marginTop: '15mm'
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

        const placeholders = buildPlaceholderMap(profileSnapshot, rasArtifacts, questionsMap, integrityPack, signalsRas?.artifactJson || {});

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
