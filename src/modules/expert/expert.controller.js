const { db } = require('../../models/index.model.js');
const bcrypt = require('bcryptjs');

const { refreshClocksAfterCase } = require('../../services/clockService');
const { scoreExpert, buildAssignmentReason } = require('./services/expertService');
const { generateFormattedId } = require('../../../utils/idGenerator');
const crypto = require('crypto');
const RESPONSE = require('../../../utils/response.js');
const notificationService = require('../../services/notificationService');
const { getChatSettings } = require('../../../utils/configHelper.js');
const { createAuditLog } = require('../../../utils/auditLogger.js');

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
            await createAuditLog(req, 'EXPERT_ASSIGNMENT_SKIPPED', run.userId, { runId, reason: "No terminal failures, expert review not required." });
            
            // Set Chat Expiry for User (7 days for Hawk Run)
            const chatSettings = await getChatSettings();
            const freeDays = chatSettings?.freeDaysAfterHawkRun || 7;
            const chatExpiryDate = new Date();
            chatExpiryDate.setDate(chatExpiryDate.getDate() + freeDays);
            await db.User.findByIdAndUpdate(run.userId, { $set: { chatExpiryDate } });

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
            $or: [
                { caseCategories: { $in: [run.caseId] } },
                { caseId: run.caseId }
            ],
            isActive: true,
            $expr: { $lt: ['$dailyCaseloadCount', '$maxCaseload'] }
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
            await createAuditLog(req, 'EXPERT_ASSIGNMENT_PENDING', run.userId, { runId, reason: "No experts available for auto-assignment." });
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

        const clientRole = run.cvSnapshot?.parsedData?.identity?.currentRoleTitle || run.cvSnapshot?.parsedData?.work?.role || '';
        const caseDomain = run.caseId;

        const scoredExperts = experts.map(expert => {
            const scoring = scoreExpert(expert, redFlags, integrityConstraints, clientRole, caseDomain);
            const reason = buildAssignmentReason(expert, redFlags, integrityConstraints, scoring);
            return { expert, scoring, reason };
        });

        scoredExperts.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);
        const best = scoredExperts[0];

        await db.RiskAuditorRegistry.updateOne(
            { auditorId: best.expert.auditorId },
            { $inc: { currentCaseload: 1, dailyCaseloadCount: 1 } }
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
        
        await createAuditLog(req, 'EXPERT_ASSIGNED', run.userId, { 
            runId, 
            expertId: expertIdRaw,
            expertName: best.expert.auditorName,
            type: 'AUTO'
        });
        
        // --- NEW: Expert Assigned Notification (#2) ---
        try {
            const user = await db.User.findById(run.userId);
            if (user) {
                // Set Chat Expiry for User (30 days for Expert Assignment)
                const chatSettings = await getChatSettings();
                const freeDays = chatSettings?.freeDaysAfterExpertAssign || 30;
                const chatExpiryDate = new Date();
                chatExpiryDate.setDate(chatExpiryDate.getDate() + freeDays);
                user.chatExpiryDate = chatExpiryDate;
                await user.save();

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

        const user = await db.User.findById(userId);
        const isFreeWindowActive = user.chatExpiryDate && new Date() < new Date(user.chatExpiryDate);

        const expertId = expertAssignment.artifactJson.assignedExpert.auditorId;

        let newBalance = null;

        if (!isFreeWindowActive) {
            const userCredits = await db.UserCredits.findOne({ userId });
            
            if (!userCredits || userCredits.expertChatBalance < 1) {
                return res.status(402).json({
                    success: false,
                    message: `Free chat window has expired. Please purchase query credits to continue.`
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
                            note: `Expert Slot Consumed: ${queryType} — Run ${runId} (After free window)`,
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
                message: isFreeWindowActive ? `Query sent for free (active window).` : 'Query sent successfully (paid credit used).'
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

exports.getChatAttempts = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        const expertAssignment = await db.Ras.findOne({
            runId,
            artifactType: 'EXPERT_ASSIGNED',
            status: 'FINAL'
        });

        if (!expertAssignment || !expertAssignment.artifactJson.assignedExpert) {
            return res.status(200).json({
                success: true,
                data: { canChat: false, message: 'No expert assigned yet.' }
            });
        }

        const user = await db.User.findById(userId);
        const isFreeWindowActive = user.chatExpiryDate && new Date() < new Date(user.chatExpiryDate);

        const userCredits = await db.UserCredits.findOne({ userId });
        const creditBalance = userCredits ? userCredits.expertChatBalance : 0;

        // Count queries already asked in this run
        const queriesCount = await db.ExpertQuery.countDocuments({ runId, userId });

        return res.status(200).json({
            success: true,
            data: {
                runId,
                isFreeWindowActive,
                creditBalance,
                queriesAsked: queriesCount,
                canChat: isFreeWindowActive || creditBalance > 0,
                displayMessage: isFreeWindowActive 
                    ? `Free support window is active until ${new Date(user.chatExpiryDate).toLocaleDateString()}.` 
                    : 'Your balance: ' + creditBalance + ' query slots.',
                remainingAttempts: isFreeWindowActive ? 'Unlimited' : creditBalance
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.unlockExpertSupport = async (req, res) => {
    try {
        const { runId } = req.body;
        const userId = req.user.id;

        const run = await db.Runs.findOne({ runId, userId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

        const userCredits = await db.UserCredits.findOne({ userId });
        if (!userCredits || userCredits.expertChatBalance < 1) {
            return res.status(402).json({ success: false, message: 'Insufficient expert chat credits. Please purchase more.' });
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
                        note: 'Manual Unlock Expert Support — Run ' + runId,
                        runId: runId,
                        createdAt: new Date()
                    }
                }
            }
        );

        return res.status(200).json({
            success: true,
            data: {
                newBalance,
                message: 'Expert support unlocked for this run.'
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateExpertProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const { 
            auditorName, designation, currentOrganization, experienceYears,
            industryExpertise, specializations, profileNote, upiId, bankDetails,
            maxCaseload, slaCommitmentHours, isTermsAccepted
        } = req.body;

        const expert = await db.RiskAuditorRegistry.findById(id);
        if (!expert) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        // Optional Validation: Simple UPI Check
        if (upiId && !upiId.includes('@')) {
            return RESPONSE.error(res, 400, 1002, 'Invalid UPI ID format');
        }

        // Apply Updates
        if (auditorName) expert.auditorName = auditorName;
        if (designation) expert.designation = designation;
        if (currentOrganization) expert.currentOrganization = currentOrganization;
        if (experienceYears) expert.experienceYears = experienceYears;
        if (industryExpertise) expert.industryExpertise = industryExpertise;
        if (specializations) expert.specializations = specializations;
        if (profileNote) expert.profileNote = profileNote;
        if (upiId) expert.upiId = upiId;
        if (bankDetails) expert.bankDetails = bankDetails;
        if (maxCaseload) expert.maxCaseload = maxCaseload;
        if (slaCommitmentHours) expert.slaCommitmentHours = slaCommitmentHours;
        
        if (isTermsAccepted === true) {
            expert.isTermsAccepted = true;
            expert.acceptedAt = new Date();
        }

        // Auto-activate if setup is reasonably complete & terms are accepted
        if (expert.designation && expert.upiId && expert.isTermsAccepted && expert.status === 'PENDING_SETUP') {
            expert.status = 'ACTIVE';
        }

        await expert.save();

        return RESPONSE.success(res, 200, 1001, {
            message: 'Expert profile updated successfully',
            status: expert.status,
            expert
        });

    } catch (error) {
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.getExpertProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const expert = await db.RiskAuditorRegistry.findById(id).select('-password -refreshToken');
        if (!expert) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        return RESPONSE.success(res, 200, 1001, expert);
    } catch (error) {
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.toggleAvailability = async (req, res) => {
    try {
        const id = req.user.id;
        const { isActive } = req.body; 

        const expert = await db.RiskAuditorRegistry.findByIdAndUpdate(
            id, 
            { $set: { isActive: !!isActive } },
            { new: true }
        );

        return RESPONSE.success(res, 200, 1001, {
            message: `Expert status updated to ${expert.isActive ? 'ONLINE' : 'OFFLINE'}`,
            isActive: expert.isActive
        });
    } catch (error) {
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.getExpertCases = async (req, res) => {
    try {
        const id = req.user.id;
        const { tab = 'ASSIGNED' } = req.query; // ASSIGNED, COMPLETED

        const expertRecord = await db.RiskAuditorRegistry.findById(id);
        if (!expertRecord) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        const statusMap = {
            'ASSIGNED': 'EXPERT_ASSIGNED',
            'COMPLETED': 'REPORT_COMPLETE'
        };

        const targetStatus = statusMap[tab.toUpperCase()] || 'EXPERT_ASSIGNED';

        const runs = await db.Runs.find({
            expertId: id,
            status: targetStatus
        })
        .populate('userId', 'name email')
        .sort({ expertAssignedAt: -1 })
        .lean();

        const enrichedRuns = await Promise.all(runs.map(async (run) => {
            const reportRas = await db.Ras.findOne({
                runId: run.runId,
                artifactType: 'FINAL_REPORT'
            }).select('artifactJson');

            const report = reportRas?.artifactJson || {};
            
            let riskPriority = 'LOW';
            if (report.verdict === 'STOP' || report.hasTerminalFailure) riskPriority = 'HIGH';
            else if (report.verdict === 'CAUTION') riskPriority = 'MEDIUM';

            return {
                runId: run.runId,
                caseId: run.caseId,
                userName: run.userId?.name || 'User',
                userEmail: run.userId?.email,
                daysLeft: run.daysLeft,
                status: run.status,
                assignedAt: run.expertAssignedAt,
                riskPriority, 
                verdict: report.verdict,
                hasTerminalFailure: report.hasTerminalFailure || false
            };
        }));

        return RESPONSE.success(res, 200, 1001, enrichedRuns);

    } catch (error) {
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.toggleUserExpertStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            isExpert,
            caseId,
            caseCategories,
            specializations,
            maxCaseload
        } = req.body;

        const user = await db.User.findById(userId);
        if (!user) return RESPONSE.error(res, 404, 3001, 'User not found');

        if (!isExpert && user.isExpert) {
            return RESPONSE.error(res, 400, 1007, 'Expert status cannot be removed once granted. Please use the Block User feature if you wish to restrict access.');
        }

        user.isExpert = !!isExpert;
        user.role = isExpert ? 'expert' : 'user';
        if (isExpert) {
            user.isExpertApplicant = false;
        }
        await user.save();

        if (isExpert) {
            let expert = await db.RiskAuditorRegistry.findOne({ email: user.email });

            const auditorName = user.fullName || user.name || 'Expert Auditor';
            const finalSpecializations = specializations || ["Generalist"];

            // Handle caseCategories (allow both array and single caseId string for flexibility)
            let categories = [];
            if (Array.isArray(caseCategories)) {
                categories = caseCategories;
            } else if (caseCategories) {
                categories = [caseCategories];
            } else if (caseId) {
                categories = [caseId];
            } else {
                categories = ['GENERAL'];
            }

            const expertConfig = {
                auditorName,
                email: user.email,
                caseCategories: categories,
                specializations: finalSpecializations,
                maxCaseload: maxCaseload || 20,
                isActive: true,
                status: 'ACTIVE'
            };

            if (!expert) {
                expertConfig.auditorId = `EXP_${Math.floor(Date.now() / 1000)}_${Math.floor(1000 + Math.random() * 9000)}`;
                expertConfig.password = await bcrypt.hash('Expert@Hks123!', 10);
                await db.RiskAuditorRegistry.create(expertConfig);
            } else {
                await db.RiskAuditorRegistry.updateOne(
                    { email: user.email },
                    { $set: expertConfig }
                );
            }
        }

        const msg = isExpert ? 'Promoted to Expert with specific Categories/Specializations' : 'Expert status confirmed';
        return RESPONSE.success(res, 200, 1001, {
            message: `User role updated. ${msg}`,
            userId: user._id,
            isExpert: user.isExpert,
            caseCategories: isExpert ? (caseCategories || caseId) : undefined
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getAllExperts = async (req, res) => {
    try {
        const experts = await db.RiskAuditorRegistry.find().select('-password -refreshToken').sort({ createdAt: -1 });
        return RESPONSE.success(res, 200, 1001, { total: experts.length, experts });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.deleteExpert = async (req, res) => {
    try {
        const { id } = req.params; // Using MongoDB _id
        const deleted = await db.RiskAuditorRegistry.findByIdAndDelete(id);
        if (!deleted) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        return RESPONSE.success(res, 200, 1001, { message: 'Expert removed successfully' });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.updateExpert = async (req, res) => {
    try {
        const { id } = req.params; // Expert's MongoDB _id
        const { auditorName, caseId, specializations, maxCaseload, isActive, status, slaCommitmentHours } = req.body;

        const expert = await db.RiskAuditorRegistry.findById(id);
        if (!expert) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        // Build update object
        const updateData = {};
        if (auditorName) updateData.auditorName = auditorName;

        // Map caseId (single) to caseCategories (array) for the model
        if (caseId) {
            updateData.caseCategories = [caseId];
            updateData.caseId = caseId; // Keep caseId for legacy support
        }

        if (specializations) updateData.specializations = specializations;
        if (maxCaseload !== undefined) updateData.maxCaseload = maxCaseload;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (status) updateData.status = status;
        if (slaCommitmentHours !== undefined) updateData.slaCommitmentHours = slaCommitmentHours;

        const updatedExpert = await db.RiskAuditorRegistry.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        ).select('-password -refreshToken');

        return RESPONSE.success(res, 200, 1001, {
            message: 'Expert details updated successfully',
            expert: updatedExpert
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getSlaStatus = async (req, res) => {
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId }).populate('expertId');
        if (!run) {
            return res.status(404).json({ success: false, message: 'Run not found.' });
        }

        if (run.status !== 'EXPERT_ASSIGNED' || !run.expertId) {
            return res.status(200).json({
                success: true,
                data: {
                    isSlaTracked: false,
                    message: 'Case is not currently under expert review.'
                }
            });
        }

        const expert = run.expertId;

        // Fetch custom SLA commitment hours
        let slaHours = expert.slaCommitmentHours || 72;
        try {
            const systemConfig = await db.SystemConfig.findOne({ configKey: 'GLOBAL_SETTINGS' });
            if (systemConfig && systemConfig.configValue && systemConfig.configValue.chatSettings && systemConfig.configValue.chatSettings.slaCommitmentHours) {
                slaHours = systemConfig.configValue.chatSettings.slaCommitmentHours;
            }
        } catch (cfgErr) {
            console.warn('[ExpertController] Config fetch failed:', cfgErr.message);
        }

        const expertAssignedTime = new Date(run.expertAssignedAt || run.updatedAt);
        const breachTime = new Date(expertAssignedTime.getTime() + (slaHours * 60 * 60 * 1000));
        
        const now = new Date();
        const diffMs = breachTime - now;
        const isExpired = diffMs <= 0;
        
        const remainingSeconds = isExpired ? 0 : Math.floor(diffMs / 1000);
        
        // Formatted countdown label: e.g., "52h 14m remaining"
        let displayLabel = '0h 0m remaining';
        if (remainingSeconds > 0) {
            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            displayLabel = `${hours}h ${minutes}m remaining`;
        } else {
            displayLabel = 'SLA expired';
        }

        return res.status(200).json({
            success: true,
            data: {
                isSlaTracked: true,
                runId: run.runId,
                caseId: run.caseId,
                assignedExpert: {
                    auditorId: expert.auditorId,
                    auditorName: expert.auditorName,
                    designation: expert.designation
                },
                isSlaBreached: run.isSlaBreached || isExpired,
                totalSlaHours: slaHours,
                expertAssignedAt: run.expertAssignedAt,
                breachTime,
                remainingSeconds,
                displayLabel
            }
        });

    } catch (error) {
        console.error('[ExpertController] SLA status error:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.manualReassignExpert = async (req, res) => {
    try {
        const { runId } = req.params;
        const { targetExpertId } = req.body;

        if (!targetExpertId) {
            return RESPONSE.error(res, 400, 1002, 'targetExpertId is required for override reassignment');
        }

        // 1. Find the Run
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return RESPONSE.error(res, 404, 3001, 'Run not found');
        }

        // 2. Find the Target Expert (Support ObjectId and AuditorId search)
        const mongoose = require('mongoose');
        let searchFilter = {};
        if (mongoose.Types.ObjectId.isValid(targetExpertId)) {
            searchFilter._id = targetExpertId;
        } else {
            searchFilter.auditorId = targetExpertId;
        }

        const targetExpert = await db.RiskAuditorRegistry.findOne(searchFilter);
        if (!targetExpert) {
            return RESPONSE.error(res, 404, 1005, 'Target Expert not found');
        }

        if (!targetExpert.isActive || targetExpert.status !== 'ACTIVE') {
            return RESPONSE.error(res, 400, 1005, 'Target Expert is currently offline or inactive');
        }

        const oldExpertId = run.expertId;
        const reassignedTime = new Date();

        // 3. Caseload balancing
        if (oldExpertId) {
            // Decrement old expert caseload
            await db.RiskAuditorRegistry.updateOne(
                { _id: oldExpertId },
                { $inc: { currentCaseload: -1 } }
            );
        }

        // Increment new expert caseload
        await db.RiskAuditorRegistry.updateOne(
            { _id: targetExpert._id },
            { $inc: { currentCaseload: 1, dailyCaseloadCount: 1 } }
        );

        // 4. Update the Run
        await db.Runs.updateOne(
            { runId },
            {
                $set: {
                    expertId: targetExpert._id,
                    expertAssignedAt: reassignedTime,
                    isSlaBreached: false // Reset breach state
                }
            }
        );

        // 5. Create new EXPERT_ASSIGNED artifact under Step 6 (Audit Trail)
        const expRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const assignmentArtifact = {
            runId,
            assignedExpert: {
                auditorId: targetExpert.auditorId,
                auditorName: targetExpert.auditorName,
                specializations: targetExpert.specializations,
                assignedAt: reassignedTime,
                assignmentReason: 'Manual Admin Override Reassignment',
                scoreBreakdown: {
                    total: 100,
                    specialization: 60,
                    load: 40
                }
            },
            verdict: run.verdict || 'PAUSE',
            escalationRequired: true,
            assignmentStatus: 'ASSIGNED',
            assignedAt: reassignedTime
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

        // 6. Secure Audit Log
        await db.AuditLog.create({
            action: 'MANUAL_EXPERT_REASSIGNED',
            userId: req.user?.id || req.user?._id, // Performed by Admin
            metadata: {
                runId,
                caseId: run.caseId,
                previousExpertId: oldExpertId || null,
                newExpertId: targetExpert._id,
                newExpertName: targetExpert.auditorName,
                timestamp: reassignedTime
            }
        });

        // 7. Alert notifications
        try {
            const user = await db.User.findById(run.userId);
            if (user) {
                await notificationService.notifyExpertAssigned(runId, user, targetExpert);
            }
        } catch (alertErr) {
            console.error('[Admin Reassign] Notifications failed:', alertErr.message);
        }

        return RESPONSE.success(res, 200, 1001, {
            message: 'Manual expert reassignment override successful',
            runId,
            newExpertId: targetExpert._id,
            newExpertName: targetExpert.auditorName,
            assignedAt: reassignedTime
        });

    } catch (error) {
        console.error('[Admin Override Reassign Error]', error.message);
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};


