const { db } = require('../../models/index.model.js');
const { uploadFile, deleteFile } = require('../../../utils/s3');
const { smartCVParser, GuardrailError } = require('../../../utils/aiParser');
const notificationService = require('../../services/notificationService');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { calculateAICost, convertToLocalCurrency } = require('../admin/helpers/aiCostHelper.js');
const { detectRegionFromIP } = require('../../../utils/regionHelper');
const { generateReport } = require('./report/reportGenerator');


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

        // --- NATIVE ASYNC FLOW (Bypassing Redis/BullMQ) ---
        const { processCVInBackground } = require('../../queues/cvWorker');
        
        // Execute asynchronously without awaiting
        processCVInBackground({
            runId,
            userId,
            originalname: file.originalname,
            mimetype: file.mimetype,
            fileUrl,
            fileName,
            ip: req.ip
        }).catch(err => console.error("Background CV Processing failed:", err));

        // Set status to indicate CV is in queue
        await db.Runs.findOneAndUpdate(
            { runId },
            { $set: { status: 'CV_PROCESSING' } }
        );

        return res.status(202).json({
            success: true,
            data: {
                message: "CV uploaded successfully and added to background processing.",
                jobId: `local-${runId}`, // Mock jobId
                runId,
                cvUrl: fileUrl,
                status: "PROCESSING"
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * Retrieve the standalone CV parsing report (Candidate Snapshot) for the authenticated user BEFORE payment.
 */
exports.getLatestCvReport = async (req, res) => {
    try {
        const userId = req.user.id;

        const userProfile = await db.UserProfile.findOne({ userId });
        if (!userProfile) {
            return res.status(404).json({ success: false, message: "User profile not found" });
        }

        if (!userProfile.cvUrl) {
            return res.status(404).json({ success: false, message: "Parsed CV data not found for this user" });
        }

        // Fetch full parsed CV baseline, PSDE scan results, and upload metadata
        const [extractedCV, psdeResult, uploadMeta] = await Promise.all([
            db.ExtractedCV.findOne({ candidate_id: userId }),
            db.PSDEResult.findOne({ candidate_id: userId }).sort({ created_at: -1 }),
            db.DocumentUploads.findById(userProfile.lastCvUploadId)
        ]);

        if (!extractedCV) {
            return res.status(404).json({ success: false, message: "Full Extracted CV baseline document not found" });
        }

        if (!psdeResult) {
            return res.status(404).json({ success: false, message: "PSDE scan results not found for this user" });
        }

        // Generate Recruiter Intelligence report
        const report = generateReport(extractedCV, psdeResult, uploadMeta?.parserMetadata?.metrics);

        // Pre-calculate Hub Summary for the 'Who I Am' UI to make it easy for frontend
        let flagsRaisedCount = 0;
        if (report.data_health) {
            flagsRaisedCount += (report.data_health.warnings?.length || 0);
            flagsRaisedCount += (report.data_health.critical_flags?.length || 0);
        }
        if (report.extracted_cv?.gap_periods) {
            flagsRaisedCount += report.extracted_cv.gap_periods.filter(g => g.flag_raised).length;
        }

        report.hub_summary = {
            signalsFired: report.evidence_stats?.total_evidence_units || psdeResult.total_detected || 0,
            flagsRaised: flagsRaisedCount,
            profileScore: report.data_health?.validation_score || 100,
            scanCompletedDate: report.meta?.generated_at || new Date(),
            archetypesEvaluated: psdeResult.total_evaluated || 330
        };

        return res.status(200).json({
            success: true,
            data: report
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: `Failed to retrieve CV report: ${error.message}` });
    }
};

/**
 * Poll CV processing status
 */
exports.getCvProcessingStatus = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        const run = await db.Runs.findOne({ runId });
        if (!run || run.userId.toString() !== userId) {
            return res.status(404).json({ success: false, message: "Run not found or unauthorized" });
        }

        if (run.status === 'CV_PROCESSING') {
            const doc = await db.DocumentUploads.findOne({ userId, isActive: true });
            return res.status(200).json({ 
                success: true, 
                data: { 
                    status: 'PROCESSING', 
                    message: 'CV is currently being processed by AI',
                    parserStatus: doc?.parserStatus || 'PENDING',
                    liveMetrics: doc?.parserLiveMetrics || {}
                } 
            });
        }

        if (run.status === 'CV_UPLOADED') {
            // Already parsed
            const doc = await db.DocumentUploads.findById(run.cvSnapshot.cvUploadId);
            return res.status(200).json({ 
                success: true, 
                data: { 
                    status: 'COMPLETED', 
                    message: 'CV processed successfully',
                    parserStatus: doc?.parserStatus || 'SUCCESS'
                } 
            });
        }

        return res.status(200).json({ success: true, data: { status: run.status } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
