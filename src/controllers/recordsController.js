// ════════════════════════════════════════════════════════════
// HAWKSYN — Step 7: My Records
// GET /api/v1/users/:userId/records
// GET /api/v1/users/:userId/records/:runId
// ════════════════════════════════════════════════════════════

const { db } = require('../models/index.model.js');

// ─────────────────────────────────────────────────────────
// HELPER — buildRunSummary
// Single run ka summary object banata hai for Slide 44
// ─────────────────────────────────────────────────────────
async function buildRunSummary(run) {
    // 1. Fetch Case Name from Registry
    const caseData = await db.CaseRegistry.findOne({ caseId: run.caseId }).lean();
    
    // 2. Load all RAS artifacts for this run
    const rasArtifacts = await db.Ras.find({
        runId:  run.runId,
        status: 'FINAL'
    });

    const rasMap = {};
    for (const ras of rasArtifacts) {
        rasMap[ras.artifactType] = ras.artifactJson;
    }

    const finalReport   = rasMap['FINAL_REPORT']    || null;
    const expertData    = rasMap['EXPERT_ASSIGNED']  || null;
    const objectiveData = rasMap['OBJECTIVE_INPUTS_CAPTURED'] || run.objectiveInputs || null;

    // 3. Duration Calculation (Slide 44)
    let durationStr = '00:00:00';
    if (run.completedAt && run.createdAt) {
        const diffMs = new Date(run.completedAt) - new Date(run.createdAt);
        const diffSec = Math.floor(diffMs / 1000);
        const h = Math.floor(diffSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
        const s = (diffSec % 60).toString().padStart(2, '0');
        durationStr = `${h}:${m}:${s}`;
    }

    // 4. Simplified User Quote (Slide 44)
    // Extracting the main objective text provided by user
    const userObservation = objectiveData?.observation || objectiveData?.input || "Assessment Completed";

    return {
        runId:             run.runId,
        caseId:            run.caseId,
        caseName:          caseData?.caseName || "Unknown Case",
        status:            run.status,
        userObservation:   userObservation,
        duration:          durationStr,

        // Verdict logic for Slide 44 (Secured vs Not Secured)
        verdict:           finalReport?.verdict || null,
        displayVerdict:    finalReport?.verdict === 'PROCEED' ? 'Secured' : 'Not Secured',
        
        // Dates
        createdAt:         run.createdAt,
        completedAt:       run.completedAt,
        
        // Recurrence placeholder (Logic: 180 days after completion)
        reRunInDays:       180 
    };
}

// ════════════════════════════════════════════════════════════
// CONTROLLER 1 — getAllRecords
// GET /api/v1/users/:userId/records
// Supports Slide 44 (List) and Slide 45 (Comparison)
// ════════════════════════════════════════════════════════════
exports.getAllRecords = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const user = await db.User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const runFilter = { userId: user._id };
        const totalRuns = await db.Runs.countDocuments(runFilter);
        const runs = await db.Runs.find(runFilter)
            .sort({ createdAt: -1 }) // latest first
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        if (!runs.length) {
            return res.status(200).json({ success: true, data: { records: [], timeline: [] } });
        }

        // ── 1. Build individual records with delta logic ──
        const records = await Promise.all(runs.map(async (run, index) => {
            const summary = await buildRunSummary(run);
            
            // Delta Logic for Slide 45
            // Compare with the run immediately before it in chronological order
            let delta = { riskChange: 0, verdictChanged: false, newAssumptions: false };
            const nextRun = runs[index + 1]; // Since sorted latest first, index + 1 is the older run
            
            if (nextRun) {
                const olderScore = (100 - (nextRun.finalReport?.accuracyScore || 50));
                const newerScore = (100 - (run.finalReport?.accuracyScore || 50));
                delta.riskChange = newerScore - olderScore;
                delta.verdictChanged = run.verdict !== nextRun.verdict;
            }

            return {
                ...summary,
                delta,
                isBaseline: (totalRuns > 1 && index === totalRuns - 1) // First run is baseline by default
            };
        }));

        // ── 2. Build Timeline for "Decision Direction" (Slide 45 Top Box) ──
        // We take the last 3 runs for the timeline
        const timeline = records.slice(0, 3).reverse().map(r => ({
            date: r.createdAt,
            riskScore: (100 - (r.accuracyScore || 50)),
            verdict: r.verdict,
            displayVerdict: r.displayVerdict
        }));

        // ── 3. AI Trend Interpretation (Blue Box in Slide 45) ──
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
                timeline, // Top box Slide 45
                records,  // Individual cards Slide 45
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
        const finalReport   = rasMap['FINAL_REPORT']   || null;
        const integrityPack = rasMap['INTEGRITY_PACK'] || null;
        const expertData    = rasMap['EXPERT_ASSIGNED'] || null;
        const profileData   = rasMap['PROFILE_CONFIRMED'] || null;
        const objectiveRas  = rasMap['OBJECTIVE_INPUTS_CAPTURED'] || null;
        const signalsRas    = rasMap['EXTERNAL_SIGNALS_CAPTURED'] || null;

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
            runId:             run.runId,
            userId:            run.userId,
            caseId:            run.caseId,
            intentId:          run.intentId,
            playbookVersionId: run.playbookVersionId,
            status:            run.status,
            createdAt:         run.createdAt,
            updatedAt:         run.updatedAt,

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
                accuracyScore:      integrityPack.accuracy?.score,
                accuracyBand:       integrityPack.accuracy?.band,
                totalPenalty:       integrityPack.accuracy?.totalPenalty,
                constraints:        integrityPack.constraints?.results     || [],
                hasTerminalFailure: integrityPack.constraints?.hasTerminalFailure || false,
                redFlags:           integrityPack.redFlags?.triggered      || [],
                contradictions:     integrityPack.contradictions?.triggered || [],
                warnings:           integrityPack.warnings                 || [],
                coverage:           integrityPack.coverage?.results        || []
            } : null,

            // Full report
            report: finalReport ? {
                verdict:            finalReport.verdict,
                accuracyScore:      finalReport.accuracyScore,
                accuracyBand:       finalReport.accuracyBand,
                hasTerminalFailure: finalReport.hasTerminalFailure,
                requiresEscalation: finalReport.requiresEscalation,
                sections:           finalReport.sections || [],
                redFlags:           finalReport.redFlags  || [],
                warnings:           finalReport.warnings  || [],
                generatedAt:        finalReport.generatedAt
            } : null,

            // Expert assignment
            expert: expertData ? {
                assignmentStatus:   expertData.assignmentStatus,
                assignedExpert:     expertData.assignedExpert     || null,
                escalationRequired: expertData.escalationRequired || false,
                assignedAt:         expertData.assignedAt
            } : null
        };

        return res.status(200).json({
            success: true,
            data:    runDetail
        });

    } catch (error) {
        console.error('[Run Detail Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
