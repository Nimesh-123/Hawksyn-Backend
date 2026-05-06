const { db } = require('../models/index.model.js');
const { generateFormattedId } = require('../../utils/idGenerator');
const { getChatSettings } = require('../../utils/configHelper.js');
const { createAuditLog } = require('../../utils/auditLogger.js');


async function buildRunSummary(run) {
    const caseData = await db.CaseRegistry.findOne({ caseId: run.caseId }).lean();

    const rasArtifacts = await db.Ras.find({
        runId: run.runId,
        status: 'FINAL'
    });

    const rasMap = {};
    for (const ras of rasArtifacts) {
        rasMap[ras.artifactType] = ras.artifactJson;
    }

    const finalReport = rasMap['FINAL_REPORT'] || null;
    const integrityPack = rasMap['INTEGRITY_PACK'] || null;
    const objectiveData = rasMap['OBJECTIVE_INPUTS_CAPTURED'] || run.objectiveInputs || null;

    // Accuracy Score Source (Step 4 or Step 5)
    const accuracyScore = finalReport?.accuracyScore || integrityPack?.accuracy?.score || 50;

    let durationStr = '00:00:00';
    if (run.completedAt && run.createdAt) {
        const diffMs = new Date(run.completedAt) - new Date(run.createdAt);
        const diffSec = Math.floor(diffMs / 1000);
        const h = Math.floor(diffSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
        const s = (diffSec % 60).toString().padStart(2, '0');
        durationStr = `${h}:${m}:${s}`;
    }

    const userObservation = objectiveData?.observation || objectiveData?.input || "Assessment Completed";

    // ── Reversibility Mapping ──
    // Checks if a constraint exists for Reversibility, or defaults to "Medium" for now
    const reversibilityRes = run.finalReport?.sections?.find(s => s.sectionName.toLowerCase().includes('reversibility'))?.content
        || integrityPack?.constraints?.results?.find(c => c.constraintName.toLowerCase().includes('reversibility'))?.band
        || "Medium";

    // ── Standard Re-Run Policy (Available Anytime) ──
    let reRunInDays = 0;
    // As per documentation, there is no restriction on re-run timing.
    // Users can initiate a re-run at any time.

    const canReRun = run.status === 'REPORT_COMPLETE' || run.status === 'EXPERT_ASSIGNED';

    return {
        runId: run.runId,
        caseId: run.caseId,
        caseName: caseData?.caseName || "Unknown Case",
        status: run.status,
        userObservation: userObservation,
        duration: durationStr,
        accuracyScore: accuracyScore,
        verdict: run.verdict,
        displayVerdict: run.verdict,
        reversibility: reversibilityRes,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        reRunInDays: reRunInDays,
        canReRun: canReRun,
        // ── Re-Run Policy Details ──
        reRunPolicy: {
            isFree: (run.reRunSetup?.eligibleForFreeReRun === true) &&
                (!run.reRunSetup?.freeReRunExpiryDate || new Date() <= new Date(run.reRunSetup.freeReRunExpiryDate)),
            expiry: run.reRunSetup?.freeReRunExpiryDate || null,
            priceOverride: run.reRunSetup?.reRunPriceOverride || null
        },
        chatSupport: {
            isFree: run.chatExpiryDate ? new Date() <= new Date(run.chatExpiryDate) : false,
            expiryDate: run.chatExpiryDate || null
        }
    };
}

exports.getAllRecords = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, filterBy = 'All', sortBy = 'Newest to oldest' } = req.query;

        const user = await db.User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const runFilter = { userId: user._id };

        // Load ALL runs to handle comparisons and filtering in-memory
        let runs = await db.Runs.find(runFilter).sort({ createdAt: -1 });
        const totalRuns = runs.length;

        if (!runs.length) {
            return res.status(200).json({ success: true, data: { records: [], timeline: [] } });
        }

        // Process all runs to get base summaries
        const processed = await Promise.all(runs.map(async (run) => {
            return await buildRunSummary(run);
        }));

        // ── Group by Case ID for Incremental Comparison ──
        const casesGroups = {};
        processed.forEach(run => {
            if (!casesGroups[run.caseId]) casesGroups[run.caseId] = [];
            casesGroups[run.caseId].push(run);
        });

        // Calculate Deltas per Group
        Object.keys(casesGroups).forEach(caseId => {
            const group = casesGroups[caseId];
            // Sort group by date descending (Newest first)
            group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            group.forEach((run, index) => {
                let delta = {
                    riskChange: 0,
                    verdictChanged: false,
                    newAssumptions: false,
                    isFresh: false
                };

                const olderRunInCase = group[index + 1];

                // Baseline logic is now PER CASE
                run.isBaseline = (group.length > 1 && index === group.length - 1) || (group.length === 1);
                run.runLabel = run.isBaseline ? "Baseline" : "Re-run";

                if (olderRunInCase) {
                    const olderRisk = (100 - (olderRunInCase.accuracyScore || 50));
                    const newerRisk = (100 - (run.accuracyScore || 50));
                    delta.riskChange = newerRisk - olderRisk;
                    delta.verdictChanged = String(run.verdict).toLowerCase() !== String(olderRunInCase.verdict).toLowerCase();
                    delta.newAssumptions = run.accuracyScore !== olderRunInCase.accuracyScore;
                } else {
                    delta.isFresh = true;
                }
                run.delta = delta;
            });
        });

        let finalProcessed = [...processed];

        // ── Apply Filtering ──
        if (filterBy === 'Changes only') {
            finalProcessed = finalProcessed.filter(r => r.delta.riskChange !== 0 || r.delta.verdictChanged);
        } else if (filterBy === 'Baseline vs Latest') {
            // Keep latest and baseline for each case type
            const filtered = [];
            Object.keys(casesGroups).forEach(cid => {
                const group = casesGroups[cid];
                if (group.length >= 2) {
                    filtered.push(group[0]); // Latest
                    filtered.push(group[group.length - 1]); // Baseline
                } else if (group.length === 1) {
                    filtered.push(group[0]);
                }
            });
            finalProcessed = filtered;
        }

        // ── Apply Sorting ──
        if (sortBy === 'Oldest to newest') {
            finalProcessed.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else {
            finalProcessed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }


        // Pagination (After filtering/sorting)
        const paginated = finalProcessed.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));


        const timeline = finalProcessed.slice(0, 3).reverse().map(r => ({

            date: r.createdAt,
            riskScore: (100 - (r.accuracyScore || 50)),
            verdict: r.verdict,
            displayVerdict: r.verdict, // Added back for app visibility
            reversibility: r.reversibility
        }));

        let trendStatement = "Insufficient data to establish a trend.";
        if (timeline.length >= 2) {
            const first = timeline[0].riskScore;
            const last = timeline[timeline.length - 1].riskScore;
            if (Math.abs(last - first) < 5) {
                trendStatement = "Net position stable despite short-term fluctuation.";
            } else if (last > first) {
                trendStatement = "Risk trajectory is increasing. Immediate recalibration advised.";
            } else {
                trendStatement = "Risk profile is improving. Mitigation strategies are effective.";
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                userId,
                totalRuns,
                trendStatement,
                timeline,
                records: paginated,
                total: finalProcessed.length,
                page: Number(page),
                pages: Math.ceil(finalProcessed.length / Number(limit)),
                canRunNewCase: true

            }
        });

    } catch (error) {
        console.error('[Records Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getRunDetail = async (req, res) => {
    try {
        const { userId, runId } = req.params;

        // ── A. Load user ──
        const user = await db.User.findById(userId);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });

        // ── B. Load run — verify ownership ──
        const run = await db.Runs.findOne({ runId, userId: user._id });
        if (!run)
            return res.status(404).json({
                success: false,
                message: 'Run not found or does not belong to this user'
            });

        // ── C. Load all RAS artifacts ──
        const rasArtifacts = await db.Ras.find({
            runId,
            status: 'FINAL'
        }).sort({ stepNo: 1 });

        const rasMap = {};
        for (const ras of rasArtifacts) {
            rasMap[ras.artifactType] = ras.artifactJson;
        }

        // ── D. Build full detail ──
        const finalReport = rasMap['FINAL_REPORT'] || null;
        const integrityPack = rasMap['INTEGRITY_PACK'] || null;
        const expertData = rasMap['EXPERT_ASSIGNED'] || null;
        const profileData = rasMap['PROFILE_CONFIRMED'] || null;
        const objectiveRas = rasMap['OBJECTIVE_INPUTS_CAPTURED'] || null;
        const signalsRas = rasMap['EXTERNAL_SIGNALS_CAPTURED'] || null;

        // ── Enrich Interview Data with actual Question Text ──
        let enrichedInterview = [];
        if (objectiveRas && objectiveRas.answers) {
            const qIds = objectiveRas.answers.map(a => a.questionId);
            const questions = await db.Questions.find({ questionId: { $in: qIds } }).lean();
            const qMap = {};
            for (const q of questions) qMap[q.questionId] = q.questionText;

            enrichedInterview = objectiveRas.answers.map(ans => ({
                ...ans,
                questionText: qMap[ans.questionId] || ans.questionId
            }));
        }

        const runDetail = {
            runId: run.runId,
            userId: run.userId,
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            status: run.status,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,

            // Profile snapshot
            profile: profileData?.confirmedProfile
                || profileData?.profile
                || profileData
                || null,

            // Dashboard Tiles: Stage-1 Findings (Stage-1 Findings Tab)
            insights: signalsRas?.signals || null,

            // User Data: Raw Interview (Data Tab)
            interviewData: enrichedInterview,

            // Logic: Integrity data (Basis Tab)
            integrity: integrityPack ? {
                accuracyScore: integrityPack.accuracy?.score,
                accuracyBand: integrityPack.accuracy?.band,
                totalPenalty: integrityPack.accuracy?.totalPenalty,
                constraints: integrityPack.constraints?.results || [],
                hasTerminalFailure: integrityPack.constraints?.hasTerminalFailure || false,
                redFlags: integrityPack.redFlags?.triggered || [],
                contradictions: integrityPack.contradictions?.triggered || [],
                warnings: integrityPack.warnings || [],
                coverage: integrityPack.coverage?.results || []
            } : null,

            // Full report
            report: finalReport ? {
                verdict: finalReport.verdict,
                accuracyScore: finalReport.accuracyScore,
                accuracyBand: finalReport.accuracyBand,
                hasTerminalFailure: finalReport.hasTerminalFailure,
                requiresEscalation: finalReport.requiresEscalation,
                sections: finalReport.sections || [],
                redFlags: finalReport.redFlags || [],
                warnings: finalReport.warnings || [],
                generatedAt: finalReport.generatedAt
            } : null,

            // Expert assignment
            expert: expertData ? {
                assignmentStatus: expertData.assignmentStatus,
                assignedExpert: expertData.assignedExpert || null,
                escalationRequired: expertData.escalationRequired || false,
                assignedAt: expertData.assignedAt
            } : null,

            // Standard Re-Run Policy: Available Anytime
            reRunInDays: 0,
            reRunPolicy: {
                isFree: (run.reRunSetup?.eligibleForFreeReRun === true) &&
                    (!run.reRunSetup?.freeReRunExpiryDate || new Date() <= new Date(run.reRunSetup.freeReRunExpiryDate)),
                expiry: run.reRunSetup?.freeReRunExpiryDate || null,
                priceOverride: run.reRunSetup?.reRunPriceOverride || null
            },
            // --- NEW: Chat Support Info ---
            chatSupport: await (async () => {
                const settings = await getChatSettings();
                const freeDays = settings.freeDaysAfterExpertAssign || 30;
                const charge = settings.chatChargePerMonth || 500;
                const isFree = run.chatExpiryDate ? new Date() <= new Date(run.chatExpiryDate) : false;
                
                return {
                    isFreeActive: isFree,
                    freeWindowDays: freeDays,
                    expiryDate: run.chatExpiryDate || null,
                    chargePerQuery: charge,
                    displayMessage: isFree 
                        ? `Expert support is FREE until ${new Date(run.chatExpiryDate).toLocaleDateString()}.`
                        : `Free window expired. Expert support is now INR ${charge} per query.`
                };
            })()
        };



        return res.status(200).json({
            success: true,
            data: runDetail
        });

    } catch (error) {
        console.error('[Run Detail Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.initiateReRun = async (req, res) => {
    try {
        const { userId } = req.params;
        const { runId: previousRunId } = req.body;

        if (!previousRunId) {
            return res.status(400).json({ success: false, message: 'runId of the previous run is required' });
        }

        // 1. Validate User
        const user = await db.User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // 2. Fetch the previous run to get caseId and intentId automatically
        const previousRun = await db.Runs.findOne({ runId: previousRunId, userId });
        if (!previousRun) return res.status(404).json({ success: false, message: 'Previous run not found' });

        const { caseId, intentId } = previousRun;

        // --- NEW: Resume Logic (Prevents duplicates if user goes back) ---
        const existingReRun = await db.Runs.findOne({
            userId,
            previousRunId: previousRunId,
            status: { $nin: ['REPORT_COMPLETE', 'PROCESSING_FAILED'] }
        });

        if (existingReRun) {
            console.log(`[Re-Run] Resuming existing session ${existingReRun.runId} for user ${userId}`);
            return res.status(200).json({
                success: true,
                data: {
                    runId: existingReRun.runId,
                    caseId: existingReRun.caseId,
                    intentId: existingReRun.intentId,
                    status: existingReRun.status,
                    message: "Resuming existing re-run session."
                }
            });
        }

        // 3. Validate Case and Intent config
        const caseRecord = await db.CaseRegistry.findOne({ caseId, isActive: true });
        if (!caseRecord) return res.status(404).json({ success: false, message: 'Case not found' });

        const config = await db.CaseIntentConfig.findOne({ caseId, intentId, isActive: true });
        if (!config) return res.status(400).json({ success: false, message: 'Usecase/Intent configuration not found' });

        // 4. Check Re-Run Policy (Admin Managed)
        // We use the settings manually configured by the Admin in the previous run
        const adminSetup = previousRun.reRunSetup || {};

        let eligibleForFree = adminSetup.eligibleForFreeReRun || false;
        let expiryDate = adminSetup.freeReRunExpiryDate || null;
        let reRunPrice = adminSetup.reRunPriceOverride || 999; // Default if not set

        // Check if the Admin's free window has already expired
        if (eligibleForFree && expiryDate && new Date() > new Date(expiryDate)) {
            eligibleForFree = false;
        }
        const userProfile = await db.UserProfile.findOne({ userId });

        // 5. Generate New runId
        const newRunId = await generateFormattedId(db.Runs, 'RUN', 'runId');

        await createAuditLog(req, 'RE_RUN_INITIATED', userId, {
            previousRunId,
            caseId,
            intentId,
            isFree: eligibleForFree
        });

        // 5. Return Policy & Proceed to Payment Flow
        return res.status(200).json({
            success: true,
            data: {
                previousRunId: previousRunId,
                caseId,
                intentId,
                caseName: caseRecord.caseName,
                status: 'POLICY_CHECK_COMPLETE',
                reRunPolicy: {
                    isFree: eligibleForFree,
                    expiry: expiryDate,
                    price: eligibleForFree ? 0 : reRunPrice
                },
                message: "Policy verified. Proceed to payment/initiation."
            }
        });

    } catch (error) {
        console.error('[Re-Run Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.compareRuns = async (req, res) => {
    try {
        const { baseline: baselineId, latest: latestId } = req.query;

        if (!baselineId || !latestId) {
            return res.status(400).json({ success: false, message: 'Both baseline and latest runIds are required' });
        }

        const [baseline, latest] = await Promise.all([
            db.Runs.findOne({ runId: baselineId }).lean(),
            db.Runs.findOne({ runId: latestId }).lean()
        ]);

        if (!baseline || !latest) {
            return res.status(404).json({ success: false, message: 'One or both runs not found' });
        }

        // Fetch RAS for both to get precise integrity scores
        const [baseRas, lateRas] = await Promise.all([
            db.Ras.findOne({ runId: baselineId, artifactType: 'INTEGRITY_PACK', status: 'FINAL' }).lean(),
            db.Ras.findOne({ runId: latestId, artifactType: 'INTEGRITY_PACK', status: 'FINAL' }).lean()
        ]);

        const baseScore = baseRas?.artifactJson?.accuracy?.score || 50;
        const lateScore = lateRas?.artifactJson?.accuracy?.score || 50;
        const baseRisk = 100 - baseScore;
        const lateRisk = 100 - lateScore;

        const deltaScore = lateRisk - baseRisk;
        const verdictChanged = baseline.verdict !== latest.verdict;

        // --- Logic: Decision Direction AI Summary ---
        let deltaType = deltaScore > 0 ? 'DETERIORATION' : (deltaScore < 0 ? 'IMPROVEMENT' : 'STABLE');
        let absDelta = Math.abs(deltaScore);

        let summary = "";
        let keyDrivers = [];
        let recommendation = "";

        if (deltaType === 'STABLE') {
            summary = "Your risk profile remains stable. Your career safety metrics haven't shifted significantly since the baseline.";
            keyDrivers = ["Consistent market signals", "Static profile data", "No significant role changes"];
            recommendation = "Continue tracking. Re-run if you change roles or gain new skills.";
        } else if (deltaType === 'DETERIORATION') {
            summary = `Your risk has increased by ${absDelta}%. This suggests higher vulnerability to market changes or AI displacement compared to your baseline.`;
            keyDrivers = [
                "New AI tools impacting your specific role",
                "Increased automation in your industry",
                "Skill gap detected relative to new market trends"
            ];
            recommendation = "Review your 'Top Skills' and consider upskilling in high-demand areas to lower your risk.";
        } else {
            summary = `Your risk has improved by ${absDelta}%. You are in a safer position now than you were during your baseline audit.`;
            keyDrivers = [
                "Enhanced experience levels",
                "Favorable market shifts in your sector",
                "Better profile accuracy (Full vs Partial)"
            ];
            recommendation = "Your profile is strengthening. Consider locking in this baseline as your new standard.";
        }

        return res.status(200).json({
            success: true,
            data: {
                baseline: {
                    runId: baseline.runId,
                    riskScore: baseRisk,
                    verdict: baseline.verdict,
                    accuracyBand: baseRas?.artifactJson?.accuracy?.band || 'LOW'
                },
                latest: {
                    runId: latest.runId,
                    riskScore: lateRisk,
                    verdict: latest.verdict,
                    accuracyBand: lateRas?.artifactJson?.accuracy?.band || 'LOW'
                },
                comparison: {
                    deltaScore: deltaScore,
                    deltaType: deltaType,
                    verdictChanged: verdictChanged,
                    interpretation: {
                        summary,
                        keyDrivers: keyDrivers.slice(0, 3), // Limit to 3 drivers as per UI
                        recommendation
                    }
                }
            }
        });

    } catch (error) {
        console.error('[Compare Runs Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
