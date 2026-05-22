const mongoose = require('mongoose');

const ExternalSignalTaxonomySchema = new mongoose.Schema({
    signalId: { type: String, required: true },
    signalName: { type: String },
    signalCategory: { type: String },
    caseId: { type: String },
    intentId: { type: String },
    valueFormat: { type: String },
    unit: { type: String },
    recencyDaysMax: { type: Number },
    isMandatory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'external_signal_taxonomy'
});

module.exports = mongoose.model('ExternalSignalTaxonomy', ExternalSignalTaxonomySchema);
