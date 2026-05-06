const { db } = require('../models/index.model.js');
const { uploadFile, deleteFile } = require('../../utils/s3');
const { smartCVParser } = require('../../utils/aiParser');
const notificationService = require('../services/notificationService');
const { createAuditLog } = require('../../utils/auditLogger.js');

/**
 * Handle "Continue with existing CV" choice.
 */
exports.keepExistingCv = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }

        if (run.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const allowedStatuses = ['CREATED', 'CV_UPLOADED', 'PROFILE_CONFIRMED', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED'];
        if (!allowedStatuses.includes(run.status)) {
            return res.status(400).json({ success: false, message: `Run is not in a state for CV operations (${run.status})` });
        }

        // Re-run bypass logic: Check if the previous run was marked as FREE by Admin
        let isFreeReRun = false;
        if (run.previousRunId) {
            const previousRun = await db.Runs.findOne({ runId: run.previousRunId });
            const setup = previousRun?.reRunSetup;
            const eligible = setup?.eligibleForFreeReRun === true;
            const notExpired = !setup?.freeReRunExpiryDate || (new Date() <= new Date(setup.freeReRunExpiryDate));

            if (eligible && notExpired) {
                isFreeReRun = true;
            }
        }



        if (run.cvSnapshot && run.cvSnapshot.cvUrl) {
            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    cvAttached: true,
                    cvUrl: run.cvSnapshot.cvUrl,
                    source: run.cvSnapshot.source,
                    message: "CV already attached to this run."
                }
            });
        }

        const userProfile = await db.UserProfile.findOne({
            userId,
            isConfirmed: true
        });

        if (!userProfile) {
            return res.status(400).json({
                success: false,
                message: "Please complete your profile setup before starting a run.",
                code: "PROFILE_NOT_CONFIRMED"
            });
        }

        const updatedRun = await db.Runs.findOneAndUpdate(
            { runId },
            {
                $set: {
                    status: 'CV_UPLOADED',
                    'cvSnapshot.cvUploadId': userProfile.lastCvUploadId,
                    'cvSnapshot.cvUrl': userProfile.cvUrl,
                    'cvSnapshot.parsedData': userProfile.confirmedProfile,
                    'cvSnapshot.attachedAt': new Date(),
                    'cvSnapshot.source': 'EXISTING'
                }
            },
            { new: true }
        );

        await createAuditLog(req, 'CV_ATTACHED', userId, {
            runId,
            source: 'EXISTING',
            cvUrl: userProfile.cvUrl
        });

        const rasId = `RAS_PROFILE_${runId}`;
        await db.Ras.findOneAndUpdate(
            { rasId },
            {
                $set: {
                    runId,
                    stepNo: 2,
                    artifactType: 'PROFILE_CONFIRMED',
                    artifactVersion: 1,
                    artifactJson: userProfile.confirmedProfile,
                    status: 'FINAL'
                }
            },
            { upsert: true }
        );

        // Step 1 Notification
        const user = await db.User.findById(userId);
        if (user) await notificationService.notifyParsingComplete(runId, user);

        return res.status(200).json({
            success: true,
            data: {
                runId: updatedRun.runId,
                cvAttached: true,
                cvUrl: updatedRun.cvSnapshot.cvUrl,
                fileName: updatedRun.cvSnapshot.cvUrl ? updatedRun.cvSnapshot.cvUrl.split('/').pop() : 'Existing CV',
                source: "EXISTING",
                message: "CV attached. Proceeding to profile review."
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Upload new CV for a specific run.
 */
exports.uploadRunCv = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }
        if (run.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const allowedStatuses = ['CREATED', 'CV_UPLOADED', 'PROFILE_CONFIRMED', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED'];
        if (!allowedStatuses.includes(run.status)) {
            return res.status(400).json({ success: false, message: `Run is not in a state for CV operations (${run.status})` });
        }

        // Re-run bypass logic: Check if the previous run was marked as FREE by Admin
        let isFreeReRun = false;
        if (run.previousRunId) {
            const previousRun = await db.Runs.findOne({ runId: run.previousRunId });
            const setup = previousRun?.reRunSetup;
            const eligible = setup?.eligibleForFreeReRun === true;
            const notExpired = !setup?.freeReRunExpiryDate || (new Date() <= new Date(setup.freeReRunExpiryDate));

            if (eligible && notExpired) {
                isFreeReRun = true;
            }
        }



        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file provided. Please upload your CV." });
        }

        const file = req.file;

        if (file.mimetype !== 'application/pdf') {
            return res.status(400).json({ success: false, message: "Invalid file type. Only PDF files are allowed." });
        }

        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: "File size exceeds the 10MB limit." });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `resumes/${userId}-${uniqueSuffix}.pdf`;

        const uploadRes = await uploadFile(file.buffer, fileName, file.mimetype);
        const fileUrl = uploadRes.url;

        let extractedData = null;
        let parserStatus = "FAILED";

        try {
            await createAuditLog(req, 'CV_PARSING_STARTED', userId, { runId, fileName: file.originalname });
            extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype);

            if (extractedData && extractedData.isCv === false) {
                await deleteFile(fileName);
                
                // Save the failed attempt to DocumentUploads for audit tracking
                await db.DocumentUploads.create({
                    userId,
                    fileName: file.originalname,
                    cvUrl: null,
                    parsedCvData: null,
                    parserStatus: 'NOT_A_CV',
                    errorReason: 'Detected as non-CV document.',
                    parserMetadata: extractedData ? {
                        modelUsed: extractedData.modelUsed,
                        duration: extractedData.totalPipelineDuration,
                        tokenUsage: extractedData.tokenUsage
                    } : null,
                    isActive: false
                });

                // --- NEW: Log Failure Reason (User Request) ---
                await createAuditLog(req, 'CV_PARSING_REJECTED', userId, {
                    runId,
                    fileName: file.originalname,
                    reason: 'Not a valid Resume/CV'
                });

                return res.status(400).json({
                    success: false,
                    message: "The uploaded document does not appear to be a valid Resume/CV."
                });
            }

            if (extractedData) {
                try {
                    const { sanitizeParsedData } = require('../../utils/cvSanitizer.js');
                    extractedData = sanitizeParsedData(extractedData);
                    parserStatus = "SUCCESS";
                } catch (sanitizerError) {
                    parserStatus = "SUCCESS";
                }
            }
        } catch (aiError) {
            console.error("[AI Extraction Failed]", aiError.message);
            // --- NEW: Log AI Pipeline Failure ---
            await createAuditLog(req, 'CV_PARSING_FAILED', userId, {
                runId,
                fileName: file.originalname,
                error: aiError.message
            });
        }

        const isExtractionBlank = !extractedData || 
                                (extractedData.aeuList.length < 3 && 
                                 (!extractedData.structured.work?.experience?.length) && 
                                 (!extractedData.structured.composition?.skills?.technical?.length));

        if (isExtractionBlank && parserStatus !== "FAILED") {
            parserStatus = "EMPTY";
            // --- NEW: Log Empty Extraction ---
            await createAuditLog(req, 'CV_PARSING_EMPTY', userId, {
                runId,
                fileName: file.originalname,
                reason: 'No meaningful data extracted'
            });
        }


        await db.DocumentUploads.updateMany(
            { userId },
            { $set: { isActive: false } }
        );

        const dbSafeParsedData = extractedData ? JSON.parse(JSON.stringify(extractedData)) : null;
        // Keep metadata for auditing and token tracking

        const newCv = await db.DocumentUploads.create({
            userId,
            fileName: file.originalname,
            cvUrl: fileUrl,
            parsedCvData: dbSafeParsedData,
            parserStatus: parserStatus,
            isActive: true
        });

        await db.Runs.findOneAndUpdate(
            { runId },
            {
                $set: {
                    status: 'CV_UPLOADED',
                    'cvSnapshot.cvUploadId': newCv._id,
                    'cvSnapshot.cvUrl': newCv.cvUrl,
                    'cvSnapshot.parsedData': newCv.parsedCvData,
                    'cvSnapshot.attachedAt': new Date(),
                    'cvSnapshot.source': 'REUPLOADED'
                }
            }
        );

        await db.UserProfile.findOneAndUpdate(
            { userId },
            {
                $set: {
                    lastCvUploadId: newCv._id,
                    cvUrl: newCv.cvUrl,
                    originalParsedData: newCv.parsedCvData,
                    confirmedProfile: null,
                    isConfirmed: false,
                    'overrideMap.fieldsChanged': [],
                    'overrideMap.changeDetails': []
                }
            },
            { upsert: true }
        );

        let finalMessage = "CV uploaded and parsed successfully";
        if (parserStatus === "FAILED") finalMessage = "CV uploaded but AI parsing failed";
        else if (parserStatus === "EMPTY") finalMessage = "CV uploaded but we couldn't extract any meaningful data. Please ensure it's a readable PDF.";

        // Step 1 Notification
        if (parserStatus === "SUCCESS") {
            const user = await db.User.findById(userId);
            if (user) await notificationService.notifyParsingComplete(runId, user);
        }

        return res.status(200).json({
            success: true,
            data: {
                message: finalMessage,
                cvUrl: fileUrl,
                parsedData: extractedData,
                source: "REUPLOADED"
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
