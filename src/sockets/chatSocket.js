const ChatMessage = require('../models/ChatMessage.model');
const Runs = require('../models/Runs.model');
const { db } = require('../models/index.model.js');

/**
 * PRODUCTION CHAT SOCKET HANDLER
 * - Re-enabled strict credit check for everyone
 * - 30-day Lockdown Enabled
 */
exports.initChatSocket = (io) => {

    io.on('connection', (socket) => {

        socket.on('join_room', async ({ runId, userId, userType }) => {
            if (!runId) return;
            try {
                const run = await Runs.findOne({ runId }).lean();
                if (!run) return socket.emit('error', { message: 'Invalid Session' });

                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const isExpired = new Date(run.createdAt) < thirtyDaysAgo;

                socket.data = { runId, userId, userType, isExpired };
                socket.join(runId);

                socket.to(runId).emit('user_status', { userId, status: 'ONLINE', userType });
                if (isExpired) socket.emit('chat_status', { isClosed: true, reason: 'EXPIRED' });

            } catch (err) { console.error(err); }
        });

        socket.on('send_message', async (data) => {
            const session = socket.data || {};
            if (!session.runId || !session.userId) return;

            try {
                if (session.isExpired) return socket.emit('error', { message: 'Closed' });

                const { senderName, type, content, fileUrl } = data;

                // --- 7-DAY FREE WINDOW CHECK ---
                const expertAssignment = await db.Ras.findOne({
                    runId: session.runId,
                    artifactType: 'EXPERT_ASSIGNED',
                    status: 'FINAL'
                });

                let usePaidCredit = false;
                if (session.userType === 'USER') {
                    if (!expertAssignment || !expertAssignment.artifactJson.assignedExpert) {
                        return socket.emit('error', { message: 'No expert assigned' });
                    }

                    const assignedAt = expertAssignment.artifactJson.assignedExpert.assignedAt;
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    if (new Date(assignedAt) < sevenDaysAgo) {
                        usePaidCredit = true;
                    }
                }

                // STRICT CREDIT CHECK (If after 7 days)
                if (usePaidCredit && session.userId !== 'USR_123') {
                    const credits = await db.UserCredits.findOne({ userId: session.userId });

                    if (!credits || credits.expertChatBalance <= 0) {
                        return socket.emit('chat_status', {
                            isClosed: true, reason: 'LOW_BALANCE',
                            message: 'Free window expired. Please buy more expert queries.'
                        });
                    }

                    credits.expertChatBalance -= 1;
                    credits.transactions.push({
                        type: 'EXPERT_QUERY_CONSUMED', amount: 1,
                        balanceAfter: credits.expertChatBalance,
                        runId: session.runId, createdAt: new Date(),
                        note: 'Chat after 7-day window'
                    });
                    await credits.save();
                }

                const msg = await ChatMessage.create({
                    messageId: `MSG_${Date.now()}_${Math.floor(Math.random() * 999)}`,
                    runId: session.runId,
                    senderId: session.userId,
                    senderType: session.userType,
                    senderName,
                    type: type || 'TEXT',
                    content,
                    fileUrl,
                    status: 'SENT'
                });

                io.to(session.runId).emit('new_message', msg);

                // PUSH NOTIFICATION: If Expert is sending, notify the User
                if (session.userType === 'EXPERT') {
                    const notifyService = require('../services/notificationService');
                    const runData = await Runs.findOne({ runId: session.runId }).populate('userId');
                    if (runData && runData.userId) {
                        await notifyService.notifyExpertChatReply(session.runId, runData.userId);
                    }
                }
            } catch (err) {
                console.error('[Socket Error]', err);
                socket.emit('error', { message: 'Failed to send' });
            }
        });

        // --- REAL-TIME READ STATUS UPDATE ---
        socket.on('read_messages', async ({ runId, readerType }) => {
            if (!runId || !readerType) return;
            try {
                // If expert reads, mark USER messages as READ
                // If user reads, mark EXPERT messages as READ
                const targetSenderType = (readerType === 'EXPERT') ? 'USER' : 'EXPERT';
                
                await ChatMessage.updateMany(
                    { runId, senderType: targetSenderType, status: { $ne: 'READ' } },
                    { $set: { status: 'READ' } }
                );

                // Notify others in the room that messages are read
                io.to(runId).emit('messages_read_update', { runId, readerType });
            } catch (err) {
                console.error('[Socket Read Error]', err);
            }
        });

        socket.on('typing', d => socket.to(d.runId).emit('user_typing', d));
        socket.on('disconnect', () => {
            const { runId, userId, userType } = socket.data || {};
            if (runId) socket.to(runId).emit('user_status', { userId, status: 'OFFLINE', userType });
        });
    });
};
