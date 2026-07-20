const { db } = require('../../models/index.model.js');
const { uploadFile, deleteFile } = require('../../../utils/s3');
const { smartCVParser, GuardrailError } = require('../../../utils/aiParser');
const notificationService = require('../../services/notificationService');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { calculateAICost, convertToLocalCurrency } = require('../admin/helpers/aiCostHelper.js');
const { detectRegionFromIP } = require('../../../utils/regionHelper');
const { generateReport } = require('./report/reportGenerator');
const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const PsdeSignalContent = require('./PsdeSignalContent.model');
const { getDimensionName } = require('./dimensionLookup');

Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

Handlebars.registerHelper('multiply', function (a, b) {
    return Number(a) * Number(b);
});

Handlebars.registerHelper('gt', function (a, b) {
    return Number(a) > Number(b);
});

Handlebars.registerHelper('divide', function (a, b) {
    return Number(b) === 0 ? 0 : Number(a) / Number(b);
});

Handlebars.registerHelper('subtract', function (a, b) {
    return Number(a) - Number(b);
});

Handlebars.registerHelper('add', function (a, b) {
    return Number(a) + Number(b);
});

Handlebars.registerHelper('round', function (a) {
    return Math.round(Number(a));
});

Handlebars.registerHelper('gte', function (a, b) {
    return Number(a) >= Number(b);
});


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

        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];

        if (!allowedMimes.includes(file.mimetype)) {
            return res.status(400).json({ success: false, message: "Invalid file type. Only PDF and DOCX files are allowed." });
        }

        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: "File size exceeds the 10MB limit." });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        const fileName = `resumes/${userId}-${uniqueSuffix}.${ext}`;

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
            ip: req.ip,
            isDebug: req.headers['x-psde-debug'] === 'true' || req.query.debug === 'true'
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

        // Fetch PIF content for the detected signals
        if (report.top_signals && report.top_signals.length > 0) {
            const archetypeIds = report.top_signals.map(s => s.archetype_id).filter(Boolean);
            const pifContents = await PsdeSignalContent.find({ archetype_id: { $in: archetypeIds } });
            
            const pifMap = {};
            pifContents.forEach(p => {
                if (!pifMap[p.archetype_id] || p.seniority_variant === 'ALL') {
                    pifMap[p.archetype_id] = p;
                }
            });

            report.top_signals = report.top_signals.map(s => {
                const pif = pifMap[s.archetype_id];
                if (pif) {
                    return {
                        ...s,
                        dimension_name: getDimensionName(s.archetype_id),
                        seniority_variant: pif.seniority_variant,
                        surface_at_intake: pif.surface_at_intake,
                        has_interview_q: pif.has_interview_q,
                        detection_condition: pif.detection_condition,
                        meaning: pif.meaning,
                        outside_view: pif.outside_view,
                        positive_reading: pif.positive_reading,
                        negative_reading: pif.negative_reading,
                        what_decides: pif.what_decides,
                        closing_tension: pif.closing_tension,
                        iq_l1_clarify: pif.iq_l1_clarify,
                        iq_l2_probe: pif.iq_l2_probe,
                        iq_l3_validate: pif.iq_l3_validate,
                        iq_l4_generalise: pif.iq_l4_generalise,
                        iq_l5_reflect: pif.iq_l5_reflect
                    };
                }
                return s;
            });
        }

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

/**
 * Download the CV Intelligence Report as PDF
 */
exports.downloadCvReportPdf = async (req, res) => {
    try {
        const userId = req.user.id;

        const userProfile = await db.UserProfile.findOne({ userId });
        if (!userProfile || !userProfile.cvUrl) {
            return res.status(404).json({ success: false, message: "Parsed CV data not found for this user" });
        }

        const [extractedCV, psdeResult, uploadMeta] = await Promise.all([
            db.ExtractedCV.findOne({ candidate_id: userId }),
            db.PSDEResult.findOne({ candidate_id: userId }).sort({ created_at: -1 }),
            db.DocumentUploads.findById(userProfile.lastCvUploadId)
        ]);

        if (!extractedCV || !psdeResult) {
            return res.status(404).json({ success: false, message: "Required intelligence data not found" });
        }

        const report = generateReport(extractedCV, psdeResult, uploadMeta?.parserMetadata?.metrics);

        // Inject computed variables for the template
        const totalAEUs = report.evidence_stats?.total_evidence_units || (report.career_timeline || []).reduce((acc, curr) => acc + (curr.aeu_count || curr.base_aeu_count || 0), 0);
        report.totalAEUs = totalAEUs;
        report.strongAEUs = report.evidence_stats?.strong_evidence_units || report.strong_aeu_count || 0;
        report.ownedAEUs = report.evidence_stats?.owned_evidence_units || report.owned_aeu_count || 0;
        const totalSignals = (report.top_signals || []).length;
        report.totalSignals = totalSignals;
        report.notDetectedSignals = 330 - totalSignals;
        
        let flagsCount = 0;
        let posCount = 0;
        (report.top_signals || []).forEach(s => {
            if (s.severity === 'negative') flagsCount++;
            if (s.severity === 'positive') posCount++;
        });
        report.flagsCount = flagsCount;
        report.posCount = posCount;

        // Calculate timeline percentages
        if (report.career_timeline && report.header && report.header.experience_years) {
            const expYears = report.header.experience_years || 1;
            report.career_timeline.forEach(role => {
                const w = (role.duration_months / (expYears * 12)) * 100;
                role.timelineWidthPct = w;
                
                if (role.seniority_score >= 6) role.timelineBg = '#e85c0d'; // var(--orange)
                else if (role.seniority_score >= 4) role.timelineBg = '#0f766e'; // var(--teal3)
                else if (role.seniority_score >= 3) role.timelineBg = '#3d5a6e';
                else role.timelineBg = '#334155';
            });
        }

        // Ring calculations
        const getCircleDash = (r, count, total) => {
            const C = 2 * Math.PI * r;
            const t = total === 0 ? 1 : total;
            const dash = (count / t) * C;
            return `${dash} ${C - dash}`;
        };
        const getCircleOffset = (r) => {
            const C = 2 * Math.PI * r;
            return -C * 0.25;
        };
        report.ring48_dash = getCircleDash(48, totalAEUs, totalAEUs);
        report.ring48_offset = getCircleOffset(48);
        report.ring32_dash = getCircleDash(32, report.strongAEUs, totalAEUs);
        report.ring32_offset = getCircleOffset(32);
        report.ring16_dash = getCircleDash(16, report.ownedAEUs, totalAEUs);
        report.ring16_offset = getCircleOffset(16);

        // Skills bar
        const totalSkills = report.extracted_cv?.skills?.length || 0;
        const provenSkills = (report.extracted_cv?.skills || []).filter(s => s.is_proven).length;
        report.totalSkillsCount = totalSkills;
        report.provenSkillsCount = provenSkills;
        report.provenSkillsPct = totalSkills > 0 ? (provenSkills / totalSkills) * 100 : 0;

        // Clusters
        report.clustersList = [];
        if (report.cluster_dashboard?.cluster_summary) {
            for (const [key, value] of Object.entries(report.cluster_dashboard.cluster_summary)) {
                let icon = '📈';
                let name = 'Trajectory & Growth';
                let plain = 'How the candidate has moved through their career levels.';
                if (key === 'growth') { icon = '📈'; name = 'Trajectory & Growth'; plain = 'How the candidate has moved through their career levels.'; }
                else if (key === 'stability') { icon = '⚖️'; name = 'Tenure & Stability'; plain = 'Consistency, loyalty, and commitment patterns.'; }
                else if (key === 'scope') { icon = '🎯'; name = 'Scope & Ownership'; plain = 'What the candidate actually owns vs. just contributes to.'; }
                else if (key === 'impact') { icon = '⚡'; name = 'Impact & Output'; plain = 'Measurable outcomes and verifiable achievements.'; }
                else if (key === 'skills') { icon = '🔧'; name = 'Skills & Learning'; plain = 'Technical proficiency and domain-relevant capabilities.'; }
                else if (key === 'identity') { icon = '🧬'; name = 'Identity & Intent'; plain = 'Consistency of professional narrative and focus.'; }
                else if (key === 'domain') { icon = '🌐'; name = 'Domain & Exposure'; plain = 'Depth and breadth of industry-specific knowledge.'; }
                else if (key === 'visibility') { icon = '🖇️'; name = 'Visibility & Network'; plain = 'External recognition and professional standing.'; }
                
                report.clustersList.push({
                    id: key,
                    name,
                    plain,
                    icon,
                    score: value.score || 0,
                    detected: value.detected || 0,
                    total_evaluated: value.total_evaluated || 0,
                    scorePct: (value.score || 0) * 100,
                    hasFlag: (value.score || 0) > 0.8
                });
            }
        }

        // Split signals by cluster
        report.clustersList.forEach(c => {
            c.signals = (report.top_signals || []).filter(s => s.cluster?.toLowerCase().trim() === c.id);
            c.detected = c.signals.length; // Override just in case
            c.scoreCount = Math.round((c.score || 0) * 10);
        });

        const templatePath = path.join(__dirname, 'templates', 'CV_Report_Template.hbs');
        if (!fs.existsSync(templatePath)) {
            return res.status(500).json({ success: false, message: "Template missing on server" });
        }

        const rawHtml = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(rawHtml);
        
        const finalHtml = template({ report });

        let browser;
        try {
            browser = await puppeteer.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            
            await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
            
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
            });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Hawksyn-Report-${report.header.candidate_name.replace(/\\s+/g, '-')}.pdf`);
            return res.send(Buffer.from(pdfBuffer));
        } finally {
            if (browser) {
                await browser.close();
            }
        }
        
    } catch (error) {
        console.error('Error generating CV Report PDF:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate PDF. Please try again.' });
    }
};
