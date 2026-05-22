const mongoose = require('mongoose');

const SourceRegistrySchema = new mongoose.Schema({
    sourceId: { type: String, required: true, unique: true },
    sourceName: { type: String, required: true },
    sourceType: { type: String, required: true },
    domainUrl: { type: String },
    credibilityTier: { type: String, required: true },
    geoScope: { type: String, required: true },
    recencyDaysDefault: { type: Number },
    minConfidenceWeight: { type: Number },
    allowedSignalCategories: { type: [String] },
    conflictPriorityRank: { type: Number },
    requiresManualValidation: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'source_registry'
});

module.exports = mongoose.model('SourceRegistry', SourceRegistrySchema);
