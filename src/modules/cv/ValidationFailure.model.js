const mongoose = require('mongoose');

const validationFailureSchema = new mongoose.Schema({
    run_id: { type: String, required: true, index: true },
    cluster_id: { type: String },
    rule_id: { type: String, required: true },
    severity: { type: String, enum: ['FATAL', 'ERROR', 'WARNING'], required: true },
    archetype_id: { type: String },
    anchor_id: { type: String },
    failure_detail: { type: String },
    raw_aeu: { type: Object },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ValidationFailure', validationFailureSchema);
