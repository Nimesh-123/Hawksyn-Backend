const mongoose = require('mongoose');

const AccuracyScoringPolicySchema = new mongoose.Schema({
    accuracyPolicyId: { type: String, required: true },
    policyName: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    baseScore: { type: Number },
    aggregationMode: { type: String },
    maxTotalPenalty: { type: Number },
    floorScore: { type: Number },
    escalationThresholdScore: { type: Number },
    bandRulesJson: { type: mongoose.Schema.Types.Mixed },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'accuracy_scoring_policy'
});

module.exports = mongoose.model('AccuracyScoringPolicy', AccuracyScoringPolicySchema);
