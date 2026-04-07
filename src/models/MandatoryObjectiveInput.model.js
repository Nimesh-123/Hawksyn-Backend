const mongoose = require('mongoose');

const MandatoryObjectiveInputSchema = new mongoose.Schema({
    moiId: { type: String, required: true },
    moiName: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    playbookVersionId: { type: String, required: true },
    version: { type: String, default: 'v1.0' },
    description: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'mandatory_objective_input'
});

module.exports = mongoose.model('MandatoryObjectiveInput', MandatoryObjectiveInputSchema);
