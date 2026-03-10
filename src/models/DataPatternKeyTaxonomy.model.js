const mongoose = require('mongoose');

const DataPatternKeyTaxonomySchema = new mongoose.Schema({
    patternKeyId: { type: String, required: true, unique: true },
    patternName: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    requiredSignals: { type: [String], required: true },
    minRequiredSignals: { type: Number, required: true },
    aggregationMethod: { type: String, required: true },
    weightingLogicJson: { type: Object },
    minimumConfidenceScore: { type: Number },
    conflictResolutionStrategy: { type: String },
    producesAnchorName: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'data_pattern_key_taxonomy'
});

module.exports = mongoose.model('DataPatternKeyTaxonomy', DataPatternKeyTaxonomySchema);
