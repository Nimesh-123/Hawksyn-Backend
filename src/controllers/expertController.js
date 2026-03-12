// ════════════════════════════════════════════════════════════
// HAWKSYN — Step 6: Expert Assignment
// POST /api/v1/runs/:runId/expert/assign
// ════════════════════════════════════════════════════════════

const { db } = require('../models/index.model.js');

// ─────────────────────────────────────────────────────────
// HELPER — scoreExpert
// Expert ko specialization + load ke basis pe score karta hai
// ─────────────────────────────────────────────────────────
function scoreExpert(expert, redFlags, constraints) {
    let specializationScore = 0;
    const specializations   = expert.specializations || [];

    // Check redFlag remediationCodes against expert specializations
    for (const flag of redFlags) {
        if (flag.remediationCode && specializations.some(s =>
            flag.remediationCode.toLowerCase().includes(s.toLowerCase()) ||
            s.toLowerCase().includes('ai') && flag.severityBand === 'CRITICAL'
        )) {
            specializationScore += 30;
        }
    }

    // Check constraint bands — CRITICAL constraints boost expert score
    for (const constraint of constraints) {
        if (constraint.band === 'CRITICAL' &&
            specializations.some(s => s.includes('AI') || s.includes('RISK'))) {
            specializationScore += 10;
        }
    }

    // Cap specialization score at 60
    specializationScore = Math.min(specializationScore, 60);

    // Load score — lower load = higher score (40% weight)
    const maxLoad   = expert.maxCaseload   || 20;
    const currLoad  = expert.currentCaseload || 0;
    const loadScore = Math.round(((maxLoad - currLoad) / maxLoad) * 40);

    return {
        totalScore:        specializationScore + loadScore,
        specializationScore,
        loadScore,
        availableCapacity: maxLoad - currLoad
    };
}

// ─────────────────────────────────────────────────────────
// HELPER — buildAssignmentReason
// Human-readable assignment reason banata hai
// ─────────────────────────────────────────────────────────
function buildAssignmentReason(expert, redFlags, constraints, scoring) {
    const parts = [];

    if (scoring.specializationScore > 0) {
        const matchedFlags = redFlags
            .filter(f => f.severityBand === 'CRITICAL')
            .map(f => f.redFlagName);
        if (matchedFlags.length > 0) {
            parts.push(`Matched critical risk: ${matchedFlags.join(', ')}`);
        }
    }

    const criticalConstraints = constraints
        .filter(c => c.band === 'CRITICAL')
        .map(c => c.constraintName);
    if (criticalConstraints.length > 0) {
        parts.push(`Critical constraints: ${criticalConstraints.join(', ')}`);
    }

    parts.push(`Capacity available: ${scoring.availableCapacity} slots`);

    return parts.join('. ');
}

// ════════════════════════════════════════════════════════════
// MAIN CONTROLLER — assignExpert
// POST /api/v1/runs/:runId/expert/assign
// ════════════════════════════════════════════════════════════
exports.assignExpert = async (req, res) => {
    try {
        const { runId } = req.params;

        // ── A. Load Run ──
        const run = await db.Runs.findOne({ runId });
        if (!run)
            return res.status(404).json({ success: false, message: 'Run not found' });

        // ── B. Load finalReport from RAS ──
        const reportRas = await db.Ras.findOne({
            runId,
            artifactType: 'FINAL_REPORT',
            status:       'FINAL'
        });

        if (!reportRas)
            return res.status(400).json({
                success: false,
                message: 'Report not generated. Run Step 5 first.'
            });

        const finalReport = reportRas.artifactJson;

        // ── C. Check if expert assignment needed ──
        const needsExpert = finalReport.hasTerminalFailure ||
                            finalReport.requiresEscalation ||
                            finalReport.verdict !== 'PROCEED';

        if (!needsExpert) {
            // Auto-complete — no expert needed
            const autoRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

            const autoArtifact = {
                runId,
                assignedExpert:    null,
                escalationRequired: false,
                assignmentStatus:  'NOT_REQUIRED',
                reason:            `Verdict is PROCEED with no terminal failures. Expert review not required.`,
                assignedAt:        new Date()
            };

            await db.Ras.create({
                rasId:           autoRasId,
                runId,
                stepNo:          6,
                artifactType:    'EXPERT_ASSIGNED',
                artifactVersion: 1,
                artifactJson:    autoArtifact,
                status:          'FINAL'
            });

            await db.Runs.updateOne(
                { runId },
                { $set: { status: 'EXPERT_ASSIGNED' } }
            );

            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId:            autoRasId,
                    assignmentStatus: 'NOT_REQUIRED',
                    message:          'Expert assignment not required. Run is complete.'
                }
            });
        }

        // ── D. Load available experts ──
        const experts = await db.RiskAuditorRegistry.find({
            caseId:   run.caseId,
            isActive: true,
            $expr: { $lt: ['$currentCaseload', '$maxCaseload'] }
        });

        if (!experts.length) {
            // No expert available — escalate manually
            const noExpertRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

            const noExpertArtifact = {
                runId,
                assignedExpert:    null,
                escalationRequired: true,
                assignmentStatus:  'PENDING_MANUAL',
                reason:            'No expert available with sufficient capacity. Manual assignment required.',
                assignedAt:        new Date()
            };

            await db.Ras.create({
                rasId:           noExpertRasId,
                runId,
                stepNo:          6,
                artifactType:    'EXPERT_ASSIGNED',
                artifactVersion: 1,
                artifactJson:    noExpertArtifact,
                status:          'FINAL'
            });

            await db.Runs.updateOne(
                { runId },
                { $set: { status: 'EXPERT_ASSIGNED' } }
            );

            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId:            noExpertRasId,
                    assignmentStatus: 'PENDING_MANUAL',
                    message:          'No expert available. Manual assignment required.'
                }
            });
        }

        // ── E. Score each expert ──
        const redFlags   = finalReport.redFlags   || [];
        const constraints = finalReport.sections
            ? [] // constraints not in report directly
            : [];

        // Load constraints from integrity pack
        const integrityRas = await db.Ras.findOne({
            runId,
            artifactType: 'INTEGRITY_PACK',
            status:       'FINAL'
        });
        const integrityConstraints = integrityRas?.artifactJson?.constraints?.results || [];

        // Score all experts
        const scoredExperts = experts.map(expert => {
            const scoring = scoreExpert(expert, redFlags, integrityConstraints);
            const reason  = buildAssignmentReason(expert, redFlags, integrityConstraints, scoring);
            return { expert, scoring, reason };
        });

        // Sort by total score descending — pick best
        scoredExperts.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);
        const best = scoredExperts[0];

        // ── F. Increment expert caseload ──
        await db.RiskAuditorRegistry.updateOne(
            { auditorId: best.expert.auditorId },
            { $inc: { currentCaseload: 1 } }
        );

        // ── G. Build assignment artifact ──
        const assignedAt  = new Date();
        const expRasId    = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

        const assignmentArtifact = {
            runId,
            assignedExpert: {
                auditorId:         best.expert.auditorId,
                auditorName:       best.expert.auditorName,
                specializations:   best.expert.specializations,
                assignedAt,
                assignmentReason:  best.reason,
                scoreBreakdown: {
                    total:            best.scoring.totalScore,
                    specialization:   best.scoring.specializationScore,
                    load:             best.scoring.loadScore
                }
            },
            verdict:           finalReport.verdict,
            escalationRequired: finalReport.requiresEscalation || finalReport.hasTerminalFailure,
            assignmentStatus:  'ASSIGNED',
            assignedAt
        };

        await db.Ras.create({
            rasId:           expRasId,
            runId,
            stepNo:          6,
            artifactType:    'EXPERT_ASSIGNED',
            artifactVersion: 1,
            artifactJson:    assignmentArtifact,
            status:          'FINAL'
        });

        // ── H. Update Run status ──
        await db.Runs.updateOne(
            { runId },
            { $set: { status: 'EXPERT_ASSIGNED' } }
        );

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId:            expRasId,
                assignmentStatus: 'ASSIGNED',
                assignedExpert: {
                    auditorId:        best.expert.auditorId,
                    auditorName:      best.expert.auditorName,
                    specializations:  best.expert.specializations,
                    assignedAt,
                    assignmentReason: best.reason
                },
                verdict:           finalReport.verdict,
                escalationRequired: assignmentArtifact.escalationRequired,
                message:           'Expert assigned successfully.'
            }
        });

    } catch (error) {
        console.error('[Expert Assignment Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
