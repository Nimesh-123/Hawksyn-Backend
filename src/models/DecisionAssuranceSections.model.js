const mongoose = require('mongoose');

const DecisionAssuranceSectionsSchema = new mongoose.Schema({
    sectionId: { type: String, required: true, unique: true },
    sectionName: { type: String, required: true },
    caseId: { type: String },
    intentId: { type: String },
    sectionOrder: { type: Number },
    sectionType: { type: String },
    allowedAeuTypesJson: [{ type: String }],
    certaintyCapPercent: { type: Number },
    minAccuracyRequired: { type: Number },
    fallbackPolicy: { type: String },
      outputSchemaReference: { type: String, default: null },

    isActive: { type: Boolean, default: true },
    requiredInternalAnchorsJson: [{ type: String }],
    requiredExternalAnchorsJson: [{ type: String }],
    
}, {
    timestamps: true,
    collection: 'decision_assurance_sections'
});

module.exports = mongoose.model('DecisionAssuranceSections', DecisionAssuranceSectionsSchema);
