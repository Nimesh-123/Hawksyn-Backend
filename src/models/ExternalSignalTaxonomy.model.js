const mongoose = require('mongoose');

const ExternalSignalTaxonomySchema = new mongoose.Schema({
    signalId: { type: String, required: true, unique: true },
    signalName: { type: String, required: true },
    signalCategory: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    valueFormat: { type: String, required: true },
    unit: { type: String },
    recencyDaysMax: { type: Number },
    isMandatory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'external_signal_taxonomy'
});

module.exports = mongoose.model('ExternalSignalTaxonomy', ExternalSignalTaxonomySchema);
