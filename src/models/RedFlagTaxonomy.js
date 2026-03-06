const mongoose = require('mongoose');

const RedFlagTaxonomySchema = new mongoose.Schema({
    redFlagId: { type: String, required: true, unique: true },
    redFlagSetId: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    redFlagName: { type: String, required: true },
    triggerSource: { type: String },
    triggerReferenceId: { type: String },
    severityBand: { type: String },
    penaltyPoints: { type: Number },
    uniquenessMode: { type: String },
    remediationCode: { type: String },
    escalationRequired: { type: Boolean },
    displayOrder: { type: Number },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'red_flag_taxonomy'
});

module.exports = mongoose.model('RedFlagTaxonomy', RedFlagTaxonomySchema);
