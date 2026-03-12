// ════════════════════════════════════════════════════════════
// HAWKSYN — Step 7: My Records
// GET /api/v1/users/:userId/records
// GET /api/v1/users/:userId/records/:runId
// ════════════════════════════════════════════════════════════

const { db } = require('../models/index.model.js');

// ─────────────────────────────────────────────────────────
// HELPER — buildRunSummary
// Single run ka summary object banata hai RAS data se
// ─────────────────────────────────────────────────────────
async function buildRunSummary(run) {
    // Load all RAS artifacts for this run in one query
    const rasArtifacts = await db.Ras.find({
        runId:  run.runId,
        status: 'FINAL'
    });

    // Map by artifactType for easy access
    const rasMap = {};
    for (const ras of rasArtifacts) {
        rasMap[ras.artifactType] = ras.artifactJson;
    }

    const finalReport   = rasMap['FINAL_REPORT']    || null;
    const expertData    = rasMap['EXPERT_ASSIGNED']  || null;

    // Build sections summary from report
    const sectionsSummary = (finalReport?.sections || []).map(s => ({
        sectionId:   s.sectionId,
        sectionName: s.sectionName,
        status:      s.status,
        degraded:    s.degraded || false
    }));

    // Expert summary
    const assignedExpert = expertData?.assignedExpert
        ? {
            auditorId:   expertData.assignedExpert.auditorId,
            auditorName: expertData.assignedExpert.auditorName,
            assignedAt:  expertData.assignedExpert.assignedAt
          }
        : null;

    return {
        runId:             run.runId,
        caseId:            run.caseId,
        intentId:          run.intentId,
        playbookVersionId: run.playbookVersionId,
        status:            run.status,

        // Report data
        verdict:           finalReport?.verdict       || null,
        accuracyScore:     finalReport?.accuracyScore || null,
        accuracyBand:      finalReport?.accuracyBand  || null,
        hasTerminalFailure: finalReport?.hasTerminalFailure || false,
        requiresEscalation: finalReport?.requiresEscalation || false,

        // Counts
        redFlagsCount: (finalReport?.redFlags  || []).length,
        warningsCount: (finalReport?.warnings  || []).length,

        // Expert
        assignedExpert,
        assignmentStatus: expertData?.assignmentStatus || null,

        // Sections summary
        sectionsSummary,

        // Timestamps
        createdAt:   run.createdAt,
        updatedAt:   run.updatedAt
    };
}

// ════════════════════════════════════════════════════════════
// CONTROLLER 1 — getAllRecords
// GET /api/v1/users/:userId/records
// ════════════════════════════════════════════════════════════
exports.getAllRecords = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, status, verdict } = req.query;

        // ── A. Verify user exists ──
        const user = await db.User.findById(userId);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });

        // ── B. Build filter ──
        const filter = { userId: user._id }; // Usually runs store ObjectId
        // Wait, does Run store userId as String or ObjectId?
        // Checking Runs.model.js...
        
        // If the runs collection uses the 'userId' field from the URL (which might be the string 'USR_...'),
        // then filter = { userId }. But usually it's the ObjectId.
        // Let's assume the run.userId matches the user.userId string or the user._id.
        // Looking at Runs.model.js from earlier:
        // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
        // So we need the user._id.
        
        const runFilter = { userId: user._id };
        if (status)  runFilter.status  = status;
        // verdict is stored in the Runs model now (Step 5 fix)
        if (verdict) runFilter.verdict = verdict;

        // ── C. Load runs with pagination ──
        const skip      = (Number(page) - 1) * Number(limit);
        const totalRuns = await db.Runs.countDocuments(runFilter);
        const runs      = await db.Runs.find(runFilter)
            .sort({ createdAt: -1 })   // latest first
            .skip(skip)
            .limit(Number(limit));

        if (!runs.length) {
            return res.status(200).json({
                success: true,
                data: {
                    userId,
                    totalRuns:   0,
                    page:        Number(page),
                    totalPages:  0,
                    records:     []
                }
            });
        }

        // ── D. Build summary for each run ──
        const records = await Promise.all(
            runs.map(run => buildRunSummary(run))
        );

        return res.status(200).json({
            success: true,
            data: {
                userId,
                totalRuns,
                page:       Number(page),
                totalPages: Math.ceil(totalRuns / Number(limit)),
                records
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

            // Full integrity data
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
