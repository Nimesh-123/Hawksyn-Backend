const mongoose = require('mongoose');

const ContradictionsSchema = new mongoose.Schema({
    contradictionId: { type: String, required: true },
    contradictionSetId: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    contradictionName: { type: String, required: true },
    contradictionDescription: { type: String, default: null },
    contradictionType: { type: String, enum: ['INPUT_VS_INPUT', 'INPUT_VS_PROFILE', 'PROFILE_VS_SIGNAL'], default: 'INPUT_VS_INPUT' },
    involvedEntitiesJson: { type: mongoose.Schema.Types.Mixed, default: null },
    ruleJson: { type: mongoose.Schema.Types.Mixed },
    evaluationMode: { type: String },
    onMissingData: { type: String },
    severityBand: { type: String },
    defaultSeverityBand: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: null },
    ruleName: { type: String, default: null },
    accuracyPenaltyPoints: { type: Number },
    confidencePenaltyPoints: { type: Number, default: 0 },
    escalationTag: { type: String, default: null },
    isBlocking: { type: Boolean },
    maxTriggerCount: { type: Number },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'contradictions'
});

module.exports = mongoose.model('Contradictions', ContradictionsSchema);
