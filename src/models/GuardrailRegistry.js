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
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'guardrail_registry'
});

module.exports = mongoose.model('GuardrailRegistry', GuardrailRegistrySchema);
