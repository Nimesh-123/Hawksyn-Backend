const { db } = require('../models/index.model.js');
const RESPONSE = require('../../utils/response.js');
const ChatMessage = require('../models/ChatMessage.model');
const { generateFormattedId } = require('../../utils/idGenerator');

/**
 * Upload chat attachment (Audio/Image/File)
 * POST /api/v1/chat/upload
 */
exports.uploadAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return RESPONSE.error(res, 400, 4001, 'No file uploaded');
        }

        // Generate full URL
        const fileUrl = `${req.protocol}://${req.get('host')}/api/v1/uploads/chat/${req.file.filename}`;

        return RESPONSE.success(res, 201, 1001, {
            fileName: req.file.originalname,
            fileUrl: fileUrl,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Get Chat History (Includes 7-Day Validity Metadata)
 * GET /api/v1/chat/history/:runId
 */
exports.getChatHistory = async (req, res) => {
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId }).lean();
        if (!run) return RESPONSE.error(res, 404, 3001, "Run not found");

        const now = new Date();
        const chatExpiryDate = run.chatExpiryDate;
        
        // Locked if expiry exists and is in the past
        const isLocked = chatExpiryDate && now > new Date(chatExpiryDate);

        let messages = await ChatMessage.find({ runId }).sort({ createdAt: 1 }).lean();

        return RESPONSE.success(res, 200, 1001, {
            runId,
            chatExpiryDate,
            isLocked,
            lockMessage: isLocked ? "Chat validity expired. Please pay to unlock another 7 days." : null,
            totalMessages: messages.length,
            messages
        });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Send Message (Enforces 7-Day Validity)
 * POST /api/v1/chat/send/:runId
 */
exports.sendMessage = async (req, res) => {
    try {
        const { runId } = req.params;
        const { content, type, fileUrl, fileName, fileSize } = req.body;
        const userId = req.user.id;

        // Normalize type to uppercase for Mongoose Enum validation (TEXT, AUDIO, etc)
        const msgType = (type || 'TEXT').toUpperCase();

        const run = await db.Runs.findOne({ runId });
        if (!run) return RESPONSE.error(res, 404, 3001, "Run not found");

        // 1. Enforce 7-Day Validity
        const now = new Date();
        if (run.chatExpiryDate && now > new Date(run.chatExpiryDate)) {
            return res.status(403).json({
                success: false,
                message: "Chat window expired. Please unlock to continue.",
                isLocked: true
            });
        }

        // 2. Save Message
        const messageId = await generateFormattedId(ChatMessage, 'MSG', 'messageId');
        const newMessage = new ChatMessage({
            messageId,
            runId,
            senderId: userId,
            senderType: 'USER',
            senderName: req.user.name || 'User',
            content,
            type: msgType,
            fileUrl,
            fileName,
            fileSize,
            status: 'SENT'
        });

        await newMessage.save();

        return RESPONSE.success(res, 201, 1001, {
            messageId: newMessage.messageId,
            message: newMessage
        });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
