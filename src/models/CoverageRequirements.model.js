const mongoose = require('mongoose');

const CoverageRequirementsSchema = new mongoose.Schema({
    crtId: { type: String, required: true },
    catId: { type: String },
    coverageSetId: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    anchorName: { type: String },
    requiredSourcesJson: { type: mongoose.Schema.Types.Mixed },
    minimumEvidenceCount: { type: Number },
    allowsPartial: { type: Boolean },
    missingPenaltyPoints: { type: Number },
    partialPenaltyPoints: { type: Number },
    reasoningBlockFlag: { type: Boolean },
    gapType: { type: String },
    stackingMode: { type: String },
    stackingCapPoints: { type: Number },
    displayOrder: { type: Number },
    escalationThreshold: { type: Number, default: null },
    escalationPenaltyPoints: { type: Number, default: null },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'coverage_requirements'
});

module.exports = mongoose.model('CoverageRequirements', CoverageRequirementsSchema);
