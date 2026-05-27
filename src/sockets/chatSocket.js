const ChatMessage = require('../modules/expert/ChatMessage.model.js');
const Runs = require('../modules/assurance/Runs.model');
const { db } = require('../models/index.model.js');

// In-memory rate limiting map (max 5 messages per 10 seconds per user)
const rateLimitMap = new Map();

// Clean message text of danger script structures (XSS protection)
const sanitizeMessage = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').trim();
};

// Mask blacklisted offensive terms
const filterProfanity = (text) => {
    const blacklist = ['spam', 'abuse', 'hack', 'fuck', 'shit', 'bitch', 'asshole'];
    let filtered = text;
    blacklist.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filtered = filtered.replace(regex, '***');
    });
    return filtered;
};

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

                // --- 1. Rate Limiting Check (max 5 msgs per 10s) ---
                const now = Date.now();
                if (!rateLimitMap.has(session.userId)) {
                    rateLimitMap.set(session.userId, [now]);
                } else {
                    const timestamps = rateLimitMap.get(session.userId);
                    const validTimestamps = timestamps.filter(t => now - t < 10000);
                    
                    if (validTimestamps.length >= 5) {
                        return socket.emit('chat_status', { 
                            isLocked: false, 
                            reason: 'RATE_LIMIT_EXCEEDED',
                            message: 'Message rate limit exceeded. Max 5 messages per 10 seconds.'
                        });
                    }
                    
                    validTimestamps.push(now);
                    rateLimitMap.set(session.userId, validTimestamps);
                }

                const { senderName, type, content, fileUrl } = data;

                // --- 2. Input Sanitization & Empty Message Check ---
                const sanitizedContent = sanitizeMessage(content);
                if (!sanitizedContent && type !== 'FILE' && type !== 'IMAGE') {
                    return socket.emit('error', { message: 'Message content cannot be empty.' });
                }

                // --- 3. Abuse Control / Profanity Filter ---
                const filteredContent = filterProfanity(sanitizedContent);

                const msg = await ChatMessage.create({
                    messageId: `MSG_${Date.now()}_${Math.floor(Math.random() * 999)}`,
                    runId: session.runId,
                    senderId: session.userId,
                    senderType: session.userType,
                    senderName: senderName || 'User',
                    type: type || 'TEXT',
                    content: filteredContent,
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
