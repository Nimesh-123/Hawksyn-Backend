const mongoose = require('mongoose');

const PlaybooksSchema = new mongoose.Schema({
    playbookId: { type: String, required: true }, // Removed  to support multiple versions/intents
    playbookVersionId: { type: String, sparse: true }, 
    playbookName: { type: String }, // Made optional to support version entries without names
    version: { type: String },
    caseId: { type: String }, // Made optional to support registry rows (PR)
    intentId: { type: String }, // Made optional to support PR level entries
    cvPolicyId: { type: String }, // Added from PV sheet
    documentPolicyId: { type: String },
    documentMandatory: { type: Boolean, default: true },
    allowedDocumentFormats: { type: String, default: 'PDF|DOCX' },
    adversarialMirrorEnabled: { type: Boolean, default: false },
    allowedLlms: { type: String },
    normalisationLlm: { type: String },
    mandatoryDocumentFields: { type: String },
    objectiveInputSchemaId: { type: String },
    outputContracts: { type: String },
    layerGuardrails: { type: mongoose.Schema.Types.Mixed, default: null },
    configJson: { type: mongoose.Schema.Types.Mixed, default: null },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    notes: { type: String }
}, {
    timestamps: true,
    collection: 'playbooks'
});

module.exports = mongoose.model('Playbooks', PlaybooksSchema);
