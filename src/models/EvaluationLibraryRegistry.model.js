const mongoose = require('mongoose');

const EvaluationLibraryRegistrySchema = new mongoose.Schema({
    elrId: { type: String, required: true, unique: true },
    elrName: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    playbookVersionId: { type: String, required: true },
    documentPolicyId: { type: String },
    constraintSetId: { type: String },
    contradictionSetId: { type: String },
    coverageSetId: { type: String },
    redFlagSetId: { type: String },
    accuracyPolicyId: { type: String },
    warningMappingId: { type: String },
    version: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'evaluation_library_registry'
});

module.exports = mongoose.model('EvaluationLibraryRegistry', EvaluationLibraryRegistrySchema);
