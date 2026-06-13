const mongoose = require('mongoose');

const hipGuardrailRuleSchema = new mongoose.Schema({
    ruleId: { type: String, required: true, unique: true }, // e.g., 'GR_H_021'
    ruleName: { type: String, required: true }, // e.g., 'Plain language only'
    category: { type: String }, // e.g., 'HIP_LANGUAGE_SIMPLICITY'
    appliesTo: [{ type: String }], // e.g., ['ALL_HIP_SECTIONS']
    instruction: { type: String, required: true }, // The prompt rule passed to the LLM
    rationale: { type: String }, // Why the rule exists
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('HipGuardrailRule', hipGuardrailRuleSchema);
