const { db } = require('../models/index.model.js');
const { refreshClocksAfterCase } = require('../services/clockService');
const { scoreExpert, buildAssignmentReason } = require('../services/expertService');

/**
 * API 1 — POST /api/v1/runs/:runId/expert/assign
 * Handles expert assignment logic, scoring, and run completion.
 */
exports.assignExpert = async (req, res) => {
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        const reportRas = await db.Ras.findOne({
            runId,
            artifactType: 'FINAL_REPORT',
            status: 'FINAL'
        });

        if (!reportRas) {
            return res.status(400).json({
                success: false,
                message: 'Report not generated. Run Step 5 first.'
            });
        }

        const finalReport = reportRas.artifactJson;

        const needsExpert = finalReport.hasTerminalFailure ||
            finalReport.requiresEscalation ||
            finalReport.verdict !== 'PROCEED';

        if (!needsExpert) {
            const autoArtifact = {
                runId,
                assignedExpert: null,
                escalationRequired: false,
                assignmentStatus: 'NOT_REQUIRED',
                reason: `Verdict is PROCEED with no terminal failures. Expert review not required.`,
                assignedAt: new Date()
            };

            const autoRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
            await db.Ras.create({
                rasId: autoRasId,
                runId,
                stepNo: 6,
                artifactType: 'EXPERT_ASSIGNED',
                artifactVersion: 1,
                artifactJson: autoArtifact,
                status: 'FINAL'
            });

            await db.Runs.updateOne({ runId }, { $set: { status: 'EXPERT_ASSIGNED' } });
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

        const experts = await db.RiskAuditorRegistry.find({
            caseId: run.caseId,
            isActive: true,
            $expr: { $lt: ['$currentCaseload', '$maxCaseload'] }
        });

        if (!experts.length) {
            const noExpertArtifact = {
                runId,
                assignedExpert: null,
                escalationRequired: true,
                assignmentStatus: 'PENDING_MANUAL',
                reason: 'No expert available with sufficient capacity. Manual assignment required.',
                assignedAt: new Date()
            };

            const noExpertRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
            await db.Ras.create({
                rasId: noExpertRasId,
                runId,
                stepNo: 6,
                artifactType: 'EXPERT_ASSIGNED',
                artifactVersion: 1,
                artifactJson: noExpertArtifact,
                status: 'FINAL'
            });

            await db.Runs.updateOne({ runId }, { $set: { status: 'EXPERT_ASSIGNED' } });
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

        const redFlags = finalReport.redFlags || [];
        const integrityRas = await db.Ras.findOne({
            runId,
            artifactType: 'INTEGRITY_PACK',
            status: 'FINAL'
        });
        const integrityConstraints = integrityRas?.artifactJson?.constraints?.results || [];

        const scoredExperts = experts.map(expert => {
            const scoring = scoreExpert(expert, redFlags, integrityConstraints);
            const reason = buildAssignmentReason(expert, redFlags, integrityConstraints, scoring);
            return { expert, scoring, reason };
        });

        scoredExperts.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);
        const best = scoredExperts[0];

        await db.RiskAuditorRegistry.updateOne(
            { auditorId: best.expert.auditorId },
            { $inc: { currentCaseload: 1 } }
        );

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

        await db.Runs.updateOne({ runId }, { $set: { status: 'REPORT_COMPLETE', completedAt: new Date() } });
        await refreshClocksAfterCase(run.userId, runId);

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId: expRasId,
                assignmentStatus: 'ASSIGNED',
                assignedExpert: assignmentArtifact.assignedExpert,
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
 * Fetch dynamic price for N queries from backend.
 */
exports.getExpertQueryPrice = async (req, res) => {
    try {
        const { count = 1 } = req.query;
        const numCount = Number(count);
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
 * Consumes purchased Expert Chat Balance (Slots)
 */
exports.askExpertQuery = async (req, res) => {
    try {
        const { runId, queryText, queryType = 'CUSTOM' } = req.body;
        const userId = req.user.id;

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

        const queryId = `EXPQ_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const expertQuery = await db.ExpertQuery.create({
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
        const queries = await db.ExpertQuery.find({ runId, userId }).sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            data: queries
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 5 — GET /api/v1/experts/auditor/inbox
 */
exports.getAuditorInbox = async (req, res) => {
    try {
        const auditorId = req.user.id;
        const queries = await db.ExpertQuery.find({ expertId: auditorId, status: 'PENDING' }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: queries
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 6 — POST /api/v1/experts/auditor/reply
 */
exports.replyToQuery = async (req, res) => {
    try {
        const { queryId, answerText } = req.body;
        const auditorId = req.user.id;

        const query = await db.ExpertQuery.findOne({ queryId });
        if (!query) return res.status(404).json({ success: false, message: 'Query not found' });

        query.answerText = answerText;
        query.status = 'ANSWERED';
        query.answeredAt = new Date();
        query.answeredBy = auditorId;
        await query.save();

        return res.status(200).json({
            success: true,
            message: 'Reply sent successfully.',
            data: query
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
