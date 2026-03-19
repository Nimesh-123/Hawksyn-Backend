const { db } = require('../models/index.model.js');
const { uploadFile, deleteFile } = require('../../utils/s3');
const { smartCVParser } = require('../../utils/aiParser');

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

        const payment = await db.Payments.findOne({
            runId: runId,
            userId: userId,
            status: 'COMPLETED'
        });
        if (!payment) {
            return res.status(403).json({ success: false, message: "Payment not verified for this run" });
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

        const payment = await db.Payments.findOne({
            runId,
            userId,
            status: 'COMPLETED'
        });
        if (!payment) {
            return res.status(403).json({ success: false, message: "Payment not verified for this run" });
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

        const fileUrl = await uploadFile(file.buffer, fileName, file.mimetype);

        let extractedData = null;
        let parserStatus = "FAILED";

        try {
            extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype);

            if (extractedData && extractedData.isCv === false) {
                await deleteFile(fileName);
                return res.status(400).json({
                    success: false,
                    message: "The uploaded document does not appear to be a valid Resume/CV."
                });
            }

            if (extractedData) {
                try {
                    const { sanitizeParsedData } = require('../../utils/cvSanitizer.js');
                    extractedData = sanitizeParsedData(extractedData);
                    parserStatus = "COMPLETED";
                } catch (sanitizerError) {
                    parserStatus = "PARTIAL";
                }
            }
        } catch (aiError) {
            console.error("[AI Extraction Failed]", aiError.message);
        }

        await db.DocumentUploads.updateMany(
            { userId },
            { $set: { isActive: false } }
        );

        const dbSafeParsedData = extractedData ? JSON.parse(JSON.stringify(extractedData)) : null;
        if (dbSafeParsedData) {
            delete dbSafeParsedData.parsingDuration;
            delete dbSafeParsedData.modelUsed;
            delete dbSafeParsedData.totalPipelineDuration;
        }

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

        return res.status(200).json({
            success: true,
            data: {
                message: extractedData ? "CV uploaded and parsed successfully" : "CV uploaded but AI parsing failed",
                cvUrl: fileUrl,
                parsedData: extractedData,
                source: "REUPLOADED"
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
