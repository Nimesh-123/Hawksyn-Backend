const mongoose = require('mongoose');

const GuardrailRegistrySchema = new mongoose.Schema({
    grRuleId: { type: String, required: true, unique: true },
    ruleName: { type: String, required: true },
    ruleScope: { type: String },
    applicableCasesJson: [{ type: String }],
    applicableIntentsJson: [{ type: String }],
    guardrailType: { type: String },
    ruleStatement: { type: String },
    enforcementMode: { type: String },
    applicableSectionsJson: { type: [String], default: ['ALL'] },
  applicableSignalsJson:  { type: [String], default: ['ALL'] },
  penaltyPoints:          { type: Number, default: 0 },
  violationAction:        { type: String, default: 'BLOCK' },

    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'guardrail_registry'
});

module.exports = mongoose.model('GuardrailRegistry', GuardrailRegistrySchema);
