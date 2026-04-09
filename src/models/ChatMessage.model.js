const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
    messageId:  { type: String, required: true, unique: true },
    runId:      { type: String, required: true },  // Room = runId

    senderId:   { type: String, required: true },  // userId or auditorId
    senderType: { type: String, enum: ['USER', 'EXPERT'], required: true },
    senderName: { type: String, default: 'Unknown' },

    type: {
        type: String,
        enum: ['TEXT', 'AUDIO', 'FILE', 'IMAGE'],
        default: 'TEXT'
    },

    content:  { type: String, default: null },   // TEXT messages
    fileUrl:  { type: String, default: null },   // AUDIO / FILE / IMAGE
    fileName: { type: String, default: null },   // Original file name
    fileSize: { type: Number, default: null },   // bytes

    status: {
        type: String,
        enum: ['SENT', 'DELIVERED', 'READ'],
        default: 'SENT'
    },

    isSystemMessage: { type: Boolean, default: false } // "Chat will close in X days" type msgs

}, {
    timestamps: true,
    collection: 'chat_messages'
});

// Indexes
ChatMessageSchema.index({ runId: 1, createdAt: 1 });
ChatMessageSchema.index({ senderId: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
