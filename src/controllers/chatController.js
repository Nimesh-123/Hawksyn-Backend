const { db } = require('../models/index.model.js');
const RESPONSE = require('../../utils/response.js');
const ChatMessage = require('../models/ChatMessage.model');

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
 * Get Chat History (Past messages for session recovery)
 * GET /api/v1/chat/history/:runId
 */
exports.getChatHistory = async (req, res) => {
    try {
        const { runId } = req.params;

        let messages = await ChatMessage.find({ runId }).sort({ createdAt: 1 }).lean();

        // Always prepend a welcome message based on run status
        const run = await db.Runs.findOne({ runId }).lean();

        let systemText = "Hello! I am your Hawksyn Expert Assistant. Our expert auditor is reviewing your case. Feel free to explain your situation here.";

        if (run && (run.status === 'PAUSE' || run.status === 'ABORT')) {
            systemText = "⚠️ Your audit has been put on hold due to data mismatches. Our expert auditor is reviewing your case. You can chat here to clarify details or upload supporting documents.";
        }

        // Provide a virtual welcome message for UI (not saved in DB to keep it clean)
        const welcomeMsg = {
            _id: 'welcome_msg_001',
            messageId: 'MSG_WELCOME_001',
            runId: runId,
            senderId: 'SYSTEM',
            senderType: 'EXPERT', // Using EXPERT to match frontend styling
            senderName: 'Hawksyn Assistant',
            type: 'TEXT',
            content: systemText,
            status: 'SENT',
            createdAt: run ? run.createdAt : new Date(),
            isRead: true
        };

        messages.unshift(welcomeMsg);

        return RESPONSE.success(res, 200, 1001, {
            runId,
            totalMessages: messages.length,
            messages
        });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
