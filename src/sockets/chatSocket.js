const ChatMessage = require('../models/ChatMessage.model');
const Runs = require('../models/Runs.model');
const { db } = require('../models/index.model.js');

exports.initChatSocket = (io) => {

    io.on('connection', (socket) => {

        socket.on('join_room', async ({ runId, userId, userType }) => {
            if (!runId) return;
            try {
                const run = await Runs.findOne({ runId }).lean();
                if (!run) return socket.emit('error', { message: 'Invalid Session' });

                const now = new Date();
                const isExpired = run.chatExpiryDate && now > new Date(run.chatExpiryDate);

                socket.data = { runId, userId, userType, isExpired, chatExpiryDate: run.chatExpiryDate };
                socket.join(runId);

                socket.to(runId).emit('user_status', { userId, status: 'ONLINE', userType });
                
                if (isExpired) {
                    socket.emit('chat_status', { 
                        isLocked: true, 
                        reason: 'EXPIRED',
                        message: 'Chat window expired. Please unlock to continue.'
                    });
                }

            } catch (err) { console.error(err); }
        });

        socket.on('send_message', async (data) => {
            const session = socket.data || {};
            if (!session.runId || !session.userId) return;

            try {
                // Re-verify expiry on every message
                const run = await Runs.findOne({ runId: session.runId }).lean();
                const isExpired = run.chatExpiryDate && new Date() > new Date(run.chatExpiryDate);

                if (isExpired) {
                    return socket.emit('chat_status', { 
                        isLocked: true, 
                        reason: 'EXPIRED' 
                    });
                }

                const { senderName, type, content, fileUrl } = data;

                const msg = await ChatMessage.create({
                    messageId: `MSG_${Date.now()}_${Math.floor(Math.random() * 999)}`,
                    runId: session.runId,
                    senderId: session.userId,
                    senderType: session.userType,
                    senderName: senderName || 'User',
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

        socket.on('read_messages', async ({ runId, readerType }) => {
            if (!runId || !readerType) return;
            try {
                const targetSenderType = (readerType === 'EXPERT') ? 'USER' : 'EXPERT';
                await ChatMessage.updateMany(
                    { runId, senderType: targetSenderType, status: { $ne: 'READ' } },
                    { $set: { status: 'READ' } }
                );
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
