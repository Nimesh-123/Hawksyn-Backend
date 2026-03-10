const mongoose = require('mongoose');

const CaseIntentConfigSchema = new mongoose.Schema({
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    playbookVersionId: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    displayOrder: { type: Number },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    isActive: { type: Boolean, default: true },
    notes: { type: String }
}, {
    timestamps: true,
    collection: 'case_intent_config'
});

module.exports = mongoose.model('CaseIntentConfig', CaseIntentConfigSchema);
