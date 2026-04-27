const mongoose = require('mongoose');

const CaseIntentConfigSchema = new mongoose.Schema({
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    playbookVersionId: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    displayOrder: { type: Number },
    minAgeYears: { type: Number, default: null },
    maxAgeYears: { type: Number, default: null },
    minExperienceYears: { type: Number, default: null },
    maxExperienceYears: { type: Number, default: null },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    notes: { type: String }
}, {
    timestamps: true,
    collection: 'case_intent_config'
});
CaseIntentConfigSchema.index({ caseId: 1, intentId: 1 }, { unique: true });

module.exports = mongoose.model('CaseIntentConfig', CaseIntentConfigSchema);
