const { db } = require('../models/index.model.js');
const { refreshClocksAfterCase } = require('../services/clockService');
const { scoreExpert, buildAssignmentReason } = require('../services/expertService');
const { generateFormattedId } = require('../../utils/idGenerator');
const crypto = require('crypto');
const RESPONSE = require('../../utils/response.js');
const notificationService = require('../services/notificationService');

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

            await db.Runs.updateOne({ runId }, { 
                $set: { 
                    status: 'REPORT_COMPLETE', 
                    completedAt: new Date(),
                    expertReviewedAt: new Date() // Auto-finalize SLA
                } 
            });
            await refreshClocksAfterCase(run.userId, runId);

            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId: autoRasId,
                    assignmentStatus: 'NOT_REQUIRED',
                    message: 'Expert assignment not required. Run is automatically completed.'
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

        const mongoose = require('mongoose');
        // Ensure we are using the MongoDB _id and it's a proper ObjectId
        const expertIdRaw = best.expert._id.toString();
        const expertObjectId = new mongoose.Types.ObjectId(expertIdRaw);

        console.log(`[DEV Expert] Assigning Runner ${runId} to Expert _id: ${expertIdRaw} (auditorId: ${best.expert.auditorId})`);
        
        await db.Runs.updateOne(
            { runId }, 
            { 
                $set: { 
                    status: 'EXPERT_ASSIGNED', 
                    expertId: expertObjectId, 
                    expertAssignedAt: assignedAt 
                } 
            }
        );
        
        // --- NEW: Expert Assigned Notification (#2) ---
        try {
            const user = await db.User.findById(run.userId);
            if (user) {
                await notificationService.notifyExpertAssigned(runId, user, best.expert);
            }
        } catch (notifErr) {
            console.error('[Expert-Notify] Failed to notify user:', notifErr.message);
        }

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

        const assignedAt = expertAssignment.artifactJson.assignedExpert.assignedAt;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isFreeWindowActive = new Date(assignedAt) > sevenDaysAgo;

        const expertId = expertAssignment.artifactJson.assignedExpert.auditorId;

        let newBalance = null;

        if (!isFreeWindowActive) {
            const userCredits = await db.UserCredits.findOne({ userId });
            
            if (!userCredits || userCredits.expertChatBalance < 1) {
                return res.status(402).json({
                    success: false,
                    message: 'Free chat window (7 days) has expired. Please purchase query credits to continue.'
                });
            }

            newBalance = userCredits.expertChatBalance - 1;
            await db.UserCredits.findOneAndUpdate(
                { userId },
                {
                    $set: { expertChatBalance: newBalance },
                    $push: {
                        transactions: {
                            type: 'EXPERT_QUERY_CONSUME',
                            amount: -1,
                            balanceAfter: newBalance,
                            note: `Expert Slot Consumed: ${queryType} — Run ${runId} (After 7-day free window)`,
                            createdAt: new Date()
                        }
                    }
                }
            );
        }

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
                isFreeWindowActive,
                message: isFreeWindowActive ? 'Query sent for free (7-day window active).' : 'Query sent successfully (paid credit used).'
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getExpertQueries = async (req, res) => {
    try {
        const { runId } = req.params;
        const requesterId = req.user.id; 
        const role = req.user.role;

        const run = await db.Runs.findOne({ runId }).populate('userId');
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        let hasAccess = false;

        if (role === 'user') {
            if (run.userId._id.toString() === requesterId) hasAccess = true;
        } else if (role === 'expert') {
            const expertRecord = await db.RiskAuditorRegistry.findById(requesterId);
            const assignment = await db.Ras.findOne({
                runId,
                artifactType: 'EXPERT_ASSIGNED',
                'artifactJson.assignedExpert.auditorId': expertRecord?.auditorId
            });
            if (assignment) hasAccess = true;
        } else if (role === 'admin') {
            hasAccess = true;
        }

        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this chat.' });
        }

        const messages = await db.ChatMessage.find({ runId }).sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAuditorInbox = async (req, res) => {
    try {
        const id = req.user.id; 
        
        const expertRecord = await db.RiskAuditorRegistry.findById(id);
        if (!expertRecord) return RESPONSE.error(res, 404, 1005, 'Expert not found');
        
        const auditorId = expertRecord.auditorId;

        const assignments = await db.Ras.find({
            artifactType: 'EXPERT_ASSIGNED',
            'artifactJson.assignedExpert.auditorId': auditorId
        }).select('runId');

        const assignedRunIds = assignments.map(a => a.runId);

        if (assignedRunIds.length === 0) {
            return RESPONSE.success(res, 200, 1001, { total: 0, sessions: [] });
        }

        const sessions = await db.ChatMessage.aggregate([
            { $match: { runId: { $in: assignedRunIds } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$runId',
                    latestMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$senderType', 'USER'] }, { $ne: ['$status', 'READ'] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { 'latestMessage.createdAt': -1 } }
        ]);

        const runsWithDetails = await db.Runs.find({ runId: { $in: assignedRunIds } })
            .populate('userId', 'email name')
            .select('runId userId cvSnapshot.parsedData');

        const runToUserMap = {};
        runsWithDetails.forEach(r => {
            let displayName = r.cvSnapshot?.parsedData?.full_name || r.cvSnapshot?.parsedData?.name;
            
            if (!displayName && r.userId?.name) {
                displayName = r.userId.name;
            }

            if (!displayName && r.userId?.email) {
                displayName = r.userId.email.split('@')[0];
            }

            runToUserMap[r.runId] = displayName || 'Guest User';
        });

        return RESPONSE.success(res, 200, 1001, {
            total: sessions.length,
            sessions: sessions.map(s => ({
                runId: s._id,
                userName: runToUserMap[s._id] || 'Unknown User',
                latestMessage: s.latestMessage.content || 'File/Image',
                latestMessageAt: s.latestMessage.createdAt,
                senderName: s.latestMessage.senderName,
                unreadCount: s.unreadCount
            }))
        });

    } catch (error) {
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.replyToQuery = async (req, res) => {
    try {
        const { runId, content, type = 'TEXT' } = req.body;
        const id = req.user.id;

        if (!runId || !content) {
            return RESPONSE.error(res, 400, 1002, 'RunId and content are required');
        }

        const expertRecord = await db.RiskAuditorRegistry.findById(id);
        if (!expertRecord) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        const messageId = `MSG_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newMessage = await db.ChatMessage.create({
            messageId,
            runId,
            senderId: expertRecord.auditorId,
            senderType: 'EXPERT',
            senderName: expertRecord.auditorName,
            content,
            type,
            status: 'SENT'
        });

        await db.ChatMessage.updateMany(
            { runId, senderType: 'USER', status: { $ne: 'READ' } },
            { $set: { status: 'READ' } }
        );

        // --- NEW: Expert Chat Reply Notification (#7) ---
        try {
            const run = await db.Runs.findOne({ runId }).populate('userId');
            if (run && run.userId) {
                await notificationService.notifyExpertChatReply(runId, run.userId);
            }
        } catch (notifErr) {
            console.error('[Expert-Chat-Notify] Failed to notify user:', notifErr.message);
        }

        return RESPONSE.success(res, 200, 1001, {
            message: 'Reply sent and history updated',
            data: newMessage
        });

    } catch (error) {
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.initiateExpertQueryPayment = async (req, res) => {
    try {
        const { queryCount, platform = 'test', paymentMethod = 'test_gateway' } = req.body;
        const userId = req.user.id;

        if (!queryCount || queryCount < 1) {
            return res.status(400).json({ success: false, message: 'queryCount is required' });
        }

        const unitPrice = 50; 
        const amount = queryCount * unitPrice;

        const paymentId = await generateFormattedId(db.Payments, 'PAYQ', 'paymentId');
        const purchaseId = `TEST_EXPERT_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const newPayment = new db.Payments({
            paymentId,
            userId,
            platform,
            productId: 'EXPERT_QUERY_SLOTS',
            purchaseId,
            amount,
            currency: 'INR',
            status: 'PENDING',
            isTestPayment: true,
            paymentMethod: paymentMethod,
            metadata: { queryCount } 
        });

        await newPayment.save();

        return res.status(200).json({
            success: true,
            data: {
                paymentId,
                purchaseId,
                amount,
                queryCount,
                message: "Expert Query payment initiated."
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.verifyExpertQueryPayment = async (req, res) => {
    try {
        const { purchaseId } = req.body;
        const userId = req.user.id;

        const payment = await db.Payments.findOne({ purchaseId, userId, productId: 'EXPERT_QUERY_SLOTS' });
        if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });

        if (payment.status === 'COMPLETED') {
            return res.status(200).json({ success: true, message: 'Already credited.' });
        }

        const queryCount = payment.metadata?.queryCount || 1;

        payment.status = 'COMPLETED';
        payment.verifiedAt = new Date();
        await payment.save();

        let credits = await db.UserCredits.findOne({ userId });
        if (!credits) credits = new db.UserCredits({ userId });

        credits.expertChatBalance += queryCount;
        credits.transactions.push({
            type: 'EXPERT_QUERY_PURCHASE',
            amount: queryCount,
            balanceAfter: credits.expertChatBalance,
            note: `Purchased ${queryCount} expert query slots`,
            createdAt: new Date()
        });
        await credits.save();

        return res.status(200).json({
            success: true,
            data: {
                expertChatBalance: credits.expertChatBalance,
                message: `${queryCount} query slots credited to your account.`
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
