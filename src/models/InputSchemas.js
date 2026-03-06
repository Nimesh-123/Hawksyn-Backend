const mongoose = require('mongoose');

const InputSchemasSchema = new mongoose.Schema({
    moiId: { type: String, required: true, unique: true },
    moiName: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    playbookVersionId: { type: String, required: true },
    version: { type: String },
    description: { type: String },
    questions: [{
        questionId: { type: String },
        isMandatory: { type: Boolean },
        displayOrder: { type: Number },
        accuracyImpactFlag: { type: String }
    }],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'input_schemas'
});

module.exports = mongoose.model('InputSchemas', InputSchemasSchema);
