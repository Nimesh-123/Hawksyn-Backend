const mongoose = require('mongoose');

const IntegrityEligibilityRulesSchema = new mongoose.Schema({
    ierId: { type: String, required: true, unique: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    integrityState: { 
        type: String, 
        required: true,
        enum: ['COMPLETE', 'FULL', 'PARTIAL', 'MINIMAL']
    },
    requiredAnchorsJson: { type: mongoose.Schema.Types.Mixed, required: true },
    accuracyThresholdMin: { type: Number, required: true },
    accuracyThresholdMax: { type: Number, required: true },
    sectionsBlockedJson: { type: mongoose.Schema.Types.Mixed, default: null },
    certaintyCapOverride: { type: Number, default: null },
    verdictDeliverable: { type: Boolean, required: true },
    isActive: { type: Boolean, required: true, default: true }
}, {
    timestamps: true,
    collection: 'integrity_eligibility_rules'
});

module.exports = mongoose.model('IntegrityEligibilityRules', IntegrityEligibilityRulesSchema);
