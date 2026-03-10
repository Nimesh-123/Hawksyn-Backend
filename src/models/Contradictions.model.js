const mongoose = require('mongoose');

const ContradictionsSchema = new mongoose.Schema({
    contradictionId: { type: String, required: true, unique: true },
    contradictionSetId: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    contradictionName: { type: String, required: true },
    contradictionDescription: { type: String },
    contradictionType: { type: String },
    involvedEntitiesJson: { type: mongoose.Schema.Types.Mixed },
    ruleJson: { type: mongoose.Schema.Types.Mixed },
    evaluationMode: { type: String },
    onMissingData: { type: String },
    severityBand: { type: String },
    accuracyPenaltyPoints: { type: Number },
    isBlocking: { type: Boolean },
    maxTriggerCount: { type: Number },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'contradictions'
});

module.exports = mongoose.model('Contradictions', ContradictionsSchema);
