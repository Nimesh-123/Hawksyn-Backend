const { db } = require('../models/index.model.js');
const { uploadFile } = require('../../utils/s3');
const { smartCVParser } = require('../../utils/aiParser');

/**
 * NEW API — POST /api/runs/:runId/cv/keep-existing
 * Purpose: User chose "Continue with existing CV"
 * Attach most recent CV to this run
 */
exports.keepExistingCv = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id; // Using id as per JWT payload

        // Step 1 — Validate run
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }
        if (run.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }
        if (run.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, message: "Run is not active" });
        }

        // Step 2 — Verify payment
        const payment = await db.Payments.findOne({
            runId: runId,
            userId: userId,
            status: 'COMPLETED'
        });
        if (!payment) {
            return res.status(403).json({ success: false, message: "Payment not verified for this run" });
        }

        // Step 3 — Check if CV already attached
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

        // Step 4 — Get confirmed UserProfile
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

        // Step 5 — Attach profile data to run
        const updatedRun = await db.Runs.findOneAndUpdate(
            { runId },
            {
                $set: {
                    'cvSnapshot.cvUploadId': userProfile.lastCvUploadId,
                    'cvSnapshot.cvUrl': userProfile.cvUrl,
                    'cvSnapshot.parsedData': userProfile.confirmedProfile,

                    'cvSnapshot.attachedAt': new Date(),
                    'cvSnapshot.source': 'EXISTING'
                }
            },
            { new: true }
        );


        return res.status(200).json({
            success: true,
            data: {
                runId: updatedRun.runId,
                cvAttached: true,
                cvUrl: updatedRun.cvSnapshot.cvUrl,
                fileName: cv.fileName,
                source: "EXISTING",
                message: "CV attached. Proceeding to profile review."
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API — POST /api/runs/:runId/cv/upload
 * Purpose: Upload new CV for a specific run
 */
exports.uploadRunCv = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        // Add Check 1 — Run validation
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }
        if (run.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }
        if (run.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, message: "Run is not active" });
        }

        // Add Check 2 — Payment verification
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

        // Validation - PDF only (Reusing logic from user controller)
        if (file.mimetype !== 'application/pdf') {
            return res.status(400).json({ success: false, message: "Invalid file type. Only PDF files are allowed." });
        }

        // Size validation
        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: "File size exceeds the 10MB limit." });
        }

        // Generate unique and sanitized filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `resumes/${userId}-${uniqueSuffix}.pdf`;

        // Upload to S3
        const fileUrl = await uploadFile(file.buffer, fileName, file.mimetype);

        // AI Data Extraction
        let extractedData = null;
        let parserStatus = "FAILED";

        try {
            extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype);
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

        // Deactivate previous CVs
        await db.UserCvUploads.updateMany(
            { userId },
            { $set: { isActive: false } }
        );

        const dbSafeParsedData = extractedData ? JSON.parse(JSON.stringify(extractedData)) : null;
        if (dbSafeParsedData) {
            delete dbSafeParsedData.parsingDuration;
            delete dbSafeParsedData.modelUsed;
            delete dbSafeParsedData.totalPipelineDuration;
        }

        // Insert new CV record
        const newCv = await db.UserCvUploads.create({
            userId,
            fileName: file.originalname,
            cvUrl: fileUrl,
            parsedCvData: dbSafeParsedData,
            parserStatus: parserStatus,
            isActive: true
        });

        // Add Check 3 — After CV parsing completes: Update run.cvSnapshot
        await db.Runs.findOneAndUpdate(
            { runId },
            {
                $set: {
                    'cvSnapshot.cvUploadId': newCv._id,
                    'cvSnapshot.cvUrl': newCv.cvUrl,
                    'cvSnapshot.parsedData': newCv.parsedCvData,
                    'cvSnapshot.attachedAt': new Date(),
                    'cvSnapshot.source': 'REUPLOADED'
                }
            }
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
