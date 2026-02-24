const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false // Optional because some guest actions might not have a userId yet
        },
        action: {
            type: String,
            required: true
        },
        ip: {
            type: String
        },
        userAgent: {
            type: String
        },
        metadata: {
            type: Object,
            default: {}
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
