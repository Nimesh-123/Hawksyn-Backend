const mongoose = require('mongoose');

const PlaybooksSchema = new mongoose.Schema({
    playbookId: { type: String, required: true },
    playbookVersionId: { type: String, required: true, unique: true },
    playbookName: { type: String, required: true },
    version: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    documentPolicyId: { type: String },
    documentMandatory: { type: Boolean, default: true },
    allowedDocumentFormats: { type: String, default: 'PDF|DOCX' },
    adversarialMirrorEnabled: { type: Boolean, default: false },
    allowedLlms: { type: String },
    normalisationLlm: { type: String },
    mandatoryDocumentFields: { type: String },
    objectiveInputSchemaId: { type: String },
    outputContracts: { type: String },
    layerGuardrails: { type: mongoose.Schema.Types.Mixed },
    configJson: { type: mongoose.Schema.Types.Mixed },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    isActive: { type: Boolean, default: true },
    notes: { type: String }
}, {
    timestamps: true,
    collection: 'playbooks'
});

module.exports = mongoose.model('Playbooks', PlaybooksSchema);
