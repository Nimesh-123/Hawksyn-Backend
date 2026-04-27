const { db } = require('../models/index.model.js');
const { generateFormattedId } = require('../../utils/idGenerator');


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
        // ── NEW: Re-Run Policy Details (Task: User Visibility) ──
        reRunPolicy: {
            isFree: (run.reRunSetup?.eligibleForFreeReRun === true) && 
                    (!run.reRunSetup?.freeReRunExpiryDate || new Date() <= new Date(run.reRunSetup.freeReRunExpiryDate)),
            expiry: run.reRunSetup?.freeReRunExpiryDate || null,
            priceOverride: run.reRunSetup?.reRunPriceOverride || null
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

        // Process all runs to get base summaries + delta
        let processed = await Promise.all(runs.map(async (run) => {
            return await buildRunSummary(run);
        }));

        // ── Apply Comparison (Delta) Logic ──
        processed.forEach((run, index) => {
            let delta = {
                riskChange: 0,
                verdictChanged: false,
                newAssumptions: false,
                isFresh: false
            };
            const olderRun = processed[index + 1];

            // Unified baseline logic
            run.isBaseline = (totalRuns > 1 && index === processed.length - 1) || (totalRuns === 1);
            run.runLabel = run.isBaseline ? "Baseline" : "Re-run";

            if (olderRun) {
                const olderRisk = (100 - (olderRun.accuracyScore || 50));
                const newerRisk = (100 - (run.accuracyScore || 50));
                delta.riskChange = newerRisk - olderRisk;
                delta.verdictChanged = String(run.verdict).toLowerCase() !== String(olderRun.verdict).toLowerCase();

                // Compare assumptions
                delta.newAssumptions = run.accuracyScore !== olderRun.accuracyScore;
            } else {
                delta.isFresh = true;
            }

            run.delta = delta;
        });

        // ── Apply Filtering ──
        if (filterBy === 'Changes only') {
            processed = processed.filter(r => r.delta.riskChange !== 0 || r.delta.verdictChanged);
        } else if (filterBy === 'Baseline vs Latest') {
            // Only keep the newest and the baseline
            if (processed.length >= 2) {
                processed = [processed[0], processed[processed.length - 1]];
            }
        }

        // ── Apply Sorting ──
        if (sortBy === 'Oldest to newest') {
            processed.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else {
            processed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Pagination (After filtering/sorting)
        const paginated = processed.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));

        const timeline = processed.slice(0, 3).reverse().map(r => ({
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
                canRunNewCase: true
            }
        });

    } catch (error) {
        console.error('[Records Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ════════════════════════════════════════════════════════════
// CONTROLLER 2 — getRunDetail
// GET /api/v1/users/:userId/records/:runId
// ════════════════════════════════════════════════════════════
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
            }
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

/**
 * API 3 — POST /api/v1/users/:userId/records/initiate-rerun
 * Purpose: Start a new assessment session for an existing completed run.
 * Frontend only sends `runId` — backend auto-fetches caseId & intentId from it.
 */
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

        // 3. Validate Case and Intent config
        const caseRecord = await db.CaseRegistry.findOne({ caseId, isActive: true });
        if (!caseRecord) return res.status(404).json({ success: false, message: 'Case not found' });

        const config = await db.CaseIntentConfig.findOne({ caseId, intentId, isActive: true });
        if (!config) return res.status(400).json({ success: false, message: 'Usecase/Intent configuration not found' });

        // 4. Check Re-Run Policy (Free vs Paid)


        // 5. Load latest Profile for CV Snapshot
        const userProfile = await db.UserProfile.findOne({ userId });

        // 5. Generate New runId
        const newRunId = await generateFormattedId(db.Runs, 'RUN', 'runId');

        // 6. Create Fresh Run (linked to the same case/intent as the previous run)
        const newRun = new db.Runs({
            runId: newRunId,
            userId: user._id,
            caseId,
            intentId,
            playbookVersionId: config.playbookVersionId,
            previousRunId: previousRunId, // Link back to the old run for delta/comparison
            status: 'CREATED',
            cvSnapshot: {
                cvUploadId: userProfile?.lastCvUploadId || null,
                cvUrl: userProfile?.cvUrl || null,
                parsedData: userProfile?.confirmedProfile || {},
                attachedAt: userProfile?.confirmedAt || new Date(),
                source: 'EXISTING'
            }
        });

        await newRun.save();

        console.log(`[Re-Run] New session ${newRunId} initiated from previous run ${previousRunId} for user ${userId}`);

        return res.status(200).json({
            success: true,
            data: {
                runId: newRun.runId,
                caseId: newRun.caseId,
                intentId: newRun.intentId,
                caseName: caseRecord.caseName,
                status: 'CREATED',
                cvChoiceMandatory: true,
                message: "Re-run initiated successfully."
            }
        });

    } catch (error) {
        console.error('[Re-Run Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 4 — GET /user/runs/compare?baseline=X&latest=Y
 * Purpose: Deep comparison between two runs (Slide 45)
 */
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
        let directionSummary = "";
        if (deltaScore > 10) {
            directionSummary = "Risk profile has significantly increased. New contradictions and red flags detected in the latest run suggest a higher probability of professional friction.";
        } else if (deltaScore < -10) {
            directionSummary = "Risk profile has improved. Latest inputs have successfully resolved previous contradictions, or market conditions have become more favorable for this profile.";
        } else {
            directionSummary = "Risk profile remains stable. Minimal divergence in core integrity findings between these two sessions.";
        }

        const comparison = {
            meta: {
                baselineId,
                latestId,
                analyzedAt: new Date()
            },
            riskAnalysis: {
                baselineRisk: baseRisk,
                latestRisk: lateRisk,
                delta: deltaScore,
                direction: deltaScore > 0 ? 'UP' : deltaScore < 0 ? 'DOWN' : 'STABLE',
                intensity: Math.abs(deltaScore) > 20 ? 'HIGH' : 'LOW'
            },
            verdictShift: {
                baselineVerdict: baseline.verdict,
                latestVerdict: latest.verdict,
                isChanged: verdictChanged
            },
            decisionDirection: directionSummary,
            keyDifferences: [
                {
                    label: "Accuracy Shift",
                    value: `${Math.abs(deltaScore)}% ${deltaScore > 0 ? 'Increase in Risk' : 'Reduction in Risk'}`
                },
                {
                    label: "Verdict Status",
                    value: verdictChanged ? `Changed from ${baseline.verdict} to ${latest.verdict}` : "Unchanged"
                }
            ]
        };

        return res.status(200).json({
            success: true,
            data: comparison
        });

    } catch (error) {
        console.error('[Compare Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
