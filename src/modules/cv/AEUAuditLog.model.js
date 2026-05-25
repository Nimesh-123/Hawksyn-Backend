const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
    aeu_id: { type: String, required: true },
    event_type: { 
        type: String, 
        enum: ['created', 'user_confirmed', 'user_disputed', 'user_corrected', 'superseded', 'archived'],
        required: true 
    },
    before_state: { type: Object },
    after_state: { type: Object },
    changed_by: { type: String, default: 'system' },
    changed_at: { type: Date, default: Date.now },
    reason: { type: String }
}, { _id: false });

const aeuAuditLogSchema = new mongoose.Schema({
    candidate_id: { type: String, required: true, index: true },
    run_id: { type: String, required: true },
    events: [auditEventSchema]
}, {
    timestamps: true
});

// Retention policy: 7 years as per spec
aeuAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 7 });

module.exports = mongoose.model('AEUAuditLog', aeuAuditLogSchema);
