const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Null means it's for System Admins
    },
    targetRole: {
        type: String,
        enum: ['admin', 'sub_admin', 'expert', 'user', 'ALL'],
        default: 'user'
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            'INTAKE_COMPLETE', 
            'PROCESSING_SUCCESS', 
            'PROCESSING_FAILED', 
            'EXPERT_ASSIGNED', 
            'REPORT_READY',
            'SYSTEM_ALERT',
            'NEW_ASSIGNMENT',
            'VERDICT_EXPIRY',
            'PAYMENT_SUCCESS',
            'REVIEW_COMPLETE',
            'PROFILE_CONFLICT',
            'EXPERT_REPLY',
            'CONTRADICTION_ALERT',
            'MISSING_DATA_ALERT',
            'SLA_BREACH'
        ],
        required: true
    },
    metadata: {
        runId: { type: String, default: null },
        caseId: { type: String, default: null },
        errorStep: { type: String, default: null }
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexing for faster retrieval
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ targetRole: 1, isRead: 1 });

module.exports = mongoose.model('Notifications', NotificationSchema);
