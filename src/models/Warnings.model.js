const mongoose = require('mongoose');

const WarningsSchema = new mongoose.Schema({
    warningId: { type: String, required: true, unique: true },
    warningMappingId: { type: String },
    redFlagId: { type: String },
    triggerMode: { type: String },
    displayPriority: { type: Number },
    warningTitle: { type: String },
    warningMessage: { type: String },
    severityBand: { type: String },
    advisoryType: { type: String },
    ctaText: { type: String },
    humanValidationRecommended: { type: Boolean },
    displayType: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'warnings'
});

module.exports = mongoose.model('Warnings', WarningsSchema);
