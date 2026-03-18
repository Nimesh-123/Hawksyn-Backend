// ════════════════════════════════════════════════════════════
// HAWKSYN — Step 6: Expert Assignment
// POST /api/v1/runs/:runId/expert/assign
// ════════════════════════════════════════════════════════════

const { db } = require('../models/index.model.js');

// ── Clock Refresh Helper (non-blocking) ──────────────────────────
// Case complete hone ke baad clocks 30 days activate karta hai.
// Doc point 10: Case run → clocks automatically refresh → 30 days valid
async function refreshClocksAfterCase(userId, runId) {
    try {
        if (!userId) return;

        // ── 1. Load INTEGRITY_PACK RAS for this run ──
        const integrityRas = await db.Ras.findOne({
            runId,
            artifactType: 'INTEGRITY_PACK',
            status: 'FINAL'
        });

        // ── 2. Load latest active MarketPulse (for market-level data) ──
        const pulse = await db.MarketPulse.findOne({ isActive: true })
            .sort({ createdAt: -1 });

        // ── 3. Extract constraint scores from integrity pack ──
        const constraints = integrityRas?.artifactJson?.constraints?.results || [];

        const cons001 = constraints.find(c => c.constraintId === 'CONS_AI_001'); // Role Automation Exposure
        const cons002 = constraints.find(c => c.constraintId === 'CONS_AI_002'); // Financial Resilience
        const cons003 = constraints.find(c => c.constraintId === 'CONS_AI_003'); // Role Uniqueness
        const cons004 = constraints.find(c => c.constraintId === 'CONS_AI_004'); // Company AI Policy

        // ── 4. Derive clock scores from user's actual constraint scores ──
        // aiExposureScore:
        //   CONS_AI_001 score high (90) = low automation = low AI exposure risk. Inverse mapping.
        const aiExposureScore = cons001
            ? Math.round(100 - cons001.score)
            : (pulse?.aiExposureScore || 50);

        // careerMomentumScore: CONS_AI_003 = Role Uniqueness — high uniqueness = high momentum
        const careerMomentumScore = cons003
            ? cons003.score
            : (pulse?.careerMomentumScore || 50);

        // skillRelevanceScore: CONS_AI_001 = Automation Exposure — high score = skills still relevant
        const skillRelevanceScore = cons001
            ? cons001.score
            : (pulse?.skillRelevanceScore || 50);

        // opportunityWindowScore: CONS_AI_002 = Financial Resilience — more runway = more opportunity window
        const opportunityWindowScore = cons002
            ? cons002.score
            : (pulse?.opportunityWindowScore || 50);

        // ── 5. Months and years from MarketPulse (market-level, not user-specific) ──
        const careerMomentumMonths   = pulse?.careerMomentumMonths   || 18;
        const opportunityWindowYears = pulse?.opportunityWindowYears || 2;

        // ── 6. Insight text — use pulse insight or generate based on risk ──
        let insightText = pulse?.insightText || '';
        if (cons004 && cons004.band === 'CRITICAL') {
            insightText = 'Company is actively adopting AI. Focus on skills that complement automation.';
        } else if (cons001 && cons001.band === 'CRITICAL') {
            insightText = 'High automation overlap detected. Upskilling recommended immediately.';
        }

        // ── 7. Set validity ──
        const caseValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // ── 8. Update UserClocks ──
        await db.UserClocks.findOneAndUpdate(
            { userId },
            {
                $set: {
                    validityState:           'ACTIVE_CASE',
                    caseValidUntil,
                    clockValidUntil:         null,
                    effectiveValidUntil:     caseValidUntil,
                    daysLeft:                30,
                    lastCalculatedBy:        'CASE_RUN',
                    lastCalculatedAt:        new Date(),
                    pulseId:                 pulse?.pulseId || null,

                    // User-specific scores from integrity pack
                    aiExposureScore,
                    careerMomentumScore,
                    skillRelevanceScore,
                    opportunityWindowScore,

                    // Market-level data from pulse
                    careerMomentumMonths,
                    opportunityWindowYears,
                    insightText,

                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        console.log(`[Expert] ✅ Clocks refreshed for user ${userId} (runId: ${runId})`);
        console.log(`[Expert]    aiExposure: ${aiExposureScore} | momentum: ${careerMomentumScore} | skill: ${skillRelevanceScore} | opportunity: ${opportunityWindowScore}`);

    } catch (clockErr) {
        console.warn(`[Expert] ⚠️ Clock refresh failed for user ${userId}:`, clockErr.message);
    }
}

// ─────────────────────────────────────────────────────────
// HELPER — scoreExpert
// Expert ko specialization + load ke basis pe score karta hai
// ─────────────────────────────────────────────────────────
function scoreExpert(expert, redFlags, constraints) {
    let specializationScore = 0;
    const specializations = expert.specializations || [];

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
    const maxLoad = expert.maxCaseload || 20;
    const currLoad = expert.currentCaseload || 0;
    const loadScore = Math.round(((maxLoad - currLoad) / maxLoad) * 40);

    return {
        totalScore: specializationScore + loadScore,
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
            status: 'FINAL'
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
                assignedExpert: null,
                escalationRequired: false,
                assignmentStatus: 'NOT_REQUIRED',
                reason: `Verdict is PROCEED with no terminal failures. Expert review not required.`,
                assignedAt: new Date()
            };

            await db.Ras.create({
                rasId: autoRasId,
                runId,
                stepNo: 6,
                artifactType: 'EXPERT_ASSIGNED',
                artifactVersion: 1,
                artifactJson: autoArtifact,
                status: 'FINAL'
            });

            await db.Runs.updateOne(
                { runId },
                { $set: { status: 'EXPERT_ASSIGNED' } }
            );

            await refreshClocksAfterCase(run.userId, runId);

            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId: autoRasId,
                    assignmentStatus: 'NOT_REQUIRED',
                    message: 'Expert assignment not required. Run is complete.'
                }
            });
        }

        // ── D. Load available experts ──
        const experts = await db.RiskAuditorRegistry.find({
            caseId: run.caseId,
            isActive: true,
            $expr: { $lt: ['$currentCaseload', '$maxCaseload'] }
        });

        if (!experts.length) {
            // No expert available — escalate manually
            const noExpertRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

            const noExpertArtifact = {
                runId,
                assignedExpert: null,
                escalationRequired: true,
                assignmentStatus: 'PENDING_MANUAL',
                reason: 'No expert available with sufficient capacity. Manual assignment required.',
                assignedAt: new Date()
            };

            await db.Ras.create({
                rasId: noExpertRasId,
                runId,
                stepNo: 6,
                artifactType: 'EXPERT_ASSIGNED',
                artifactVersion: 1,
                artifactJson: noExpertArtifact,
                status: 'FINAL'
            });

            await db.Runs.updateOne(
                { runId },
                { $set: { status: 'EXPERT_ASSIGNED' } }
            );

            await refreshClocksAfterCase(run.userId, runId);

            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId: noExpertRasId,
                    assignmentStatus: 'PENDING_MANUAL',
                    message: 'No expert available. Manual assignment required.'
                }
            });
        }

        // ── E. Score each expert ──
        const redFlags = finalReport.redFlags || [];
        const constraints = finalReport.sections
            ? [] // constraints not in report directly
            : [];

        // Load constraints from integrity pack
        const integrityRas = await db.Ras.findOne({
            runId,
            artifactType: 'INTEGRITY_PACK',
            status: 'FINAL'
        });
        const integrityConstraints = integrityRas?.artifactJson?.constraints?.results || [];

        // Score all experts
        const scoredExperts = experts.map(expert => {
            const scoring = scoreExpert(expert, redFlags, integrityConstraints);
            const reason = buildAssignmentReason(expert, redFlags, integrityConstraints, scoring);
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
        const assignedAt = new Date();
        const expRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

        const assignmentArtifact = {
            runId,
            assignedExpert: {
                auditorId: best.expert.auditorId,
                auditorName: best.expert.auditorName,
                specializations: best.expert.specializations,
                assignedAt,
                assignmentReason: best.reason,
                scoreBreakdown: {
                    total: best.scoring.totalScore,
                    specialization: best.scoring.specializationScore,
                    load: best.scoring.loadScore
                }
            },
            verdict: finalReport.verdict,
            escalationRequired: finalReport.requiresEscalation || finalReport.hasTerminalFailure,
            assignmentStatus: 'ASSIGNED',
            assignedAt
        };

        await db.Ras.create({
            rasId: expRasId,
            runId,
            stepNo: 6,
            artifactType: 'EXPERT_ASSIGNED',
            artifactVersion: 1,
            artifactJson: assignmentArtifact,
            status: 'FINAL'
        });

        // ── H. Update Run status ──
        await db.Runs.updateOne(
            { runId },
            { $set: { status: 'REPORT_COMPLETE', completedAt: new Date() } }
        );

        await refreshClocksAfterCase(run.userId, runId);

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId: expRasId,
                assignmentStatus: 'ASSIGNED',
                assignedExpert: {
                    auditorId: best.expert.auditorId,
                    auditorName: best.expert.auditorName,
                    specializations: best.expert.specializations,
                    assignedAt,
                    assignmentReason: best.reason
                },
                verdict: finalReport.verdict,
                escalationRequired: assignmentArtifact.escalationRequired,
                message: 'Expert assigned successfully.'
            }
        });

    } catch (error) {
        console.error('[Expert Assignment Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * API 2 — GET /api/v1/runs/experts/price
 * Slide 54: Fetch dynamic price for N queries from backend.
 */
exports.getExpertQueryPrice = async (req, res) => {
    try {
        const { count = 1 } = req.query;
        const numCount = Number(count);
        
        // Logical pricing: e.g. 1 Query = 60 INR, 2 Queries = 100 INR (Discounted)
        // Image shows 2 queries = 100 INR
        const unitPrice = 50; 
        const totalPrice = numCount * unitPrice;

        return res.status(200).json({
            success: true,
            data: {
                count: numCount,
                price: totalPrice,
                currency: 'INR',
                displayLabel: `Pay = INR ${totalPrice}/-`
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 3 — POST /api/v1/runs/experts/ask
 * Slide 54: Consumes purchased Expert Chat Balance (Slots)
 */
exports.askExpertQuery = async (req, res) => {
    try {
        const { runId, queryText, queryType = 'CUSTOM' } = req.body;
        const userId = req.user.id;

        // 1. Verify Run & Expert Assignment
        const run = await db.Runs.findOne({ runId, userId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        const expertAssignment = await db.Ras.findOne({
            runId,
            artifactType: 'EXPERT_ASSIGNED',
            status: 'FINAL'
        });

        if (!expertAssignment || !expertAssignment.artifactJson.assignedExpert) {
            return res.status(400).json({ success: false, message: 'No expert has been assigned yet.' });
        }

        const expertId = expertAssignment.artifactJson.assignedExpert.auditorId;

        // 2. Check & Deduct Expert Chat Balance
        const userCredits = await db.UserCredits.findOne({ userId });
        
        if (!userCredits || userCredits.expertChatBalance < 1) {
            return res.status(402).json({
                success: false,
                message: 'No available query slots. Please purchase query credits first.'
            });
        }

        const newBalance = userCredits.expertChatBalance - 1;
        await db.UserCredits.findOneAndUpdate(
            { userId },
            {
                $set: { expertChatBalance: newBalance },
                $push: {
                    transactions: {
                        type: 'EXPERT_QUERY_CONSUME',
                        amount: -1,
                        balanceAfter: newBalance,
                        note: `Expert Slot Consumed: ${queryType} — Run ${runId}`,
                        createdAt: new Date()
                    }
                }
            }
        );

        // 3. Create Record
        const queryId = `EXPQ_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const expertQuery = await require('../models/ExpertQuery.model').create({
            queryId, userId, runId, expertId, queryType, queryText,
            status: 'PENDING'
        });

        return res.status(200).json({
            success: true,
            data: {
                queryId: expertQuery.queryId,
                expertChatBalance: newBalance,
                message: 'Query sent successfully.'
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 4 — GET /api/v1/experts/queries/:runId
 * List all queries for a specific run chat history.
 */
exports.getExpertQueries = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        const queries = await require('../models/ExpertQuery.model').find({ runId, userId }).sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            data: queries
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
