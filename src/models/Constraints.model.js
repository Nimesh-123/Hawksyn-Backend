const mongoose = require('mongoose');

const ConstraintsSchema = new mongoose.Schema({
    constraintId: { type: String, required: true, unique: true },
    constraintSetId: { type: String },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    constraintName: { type: String, required: true },
    constraintDescription: { type: String },
    scoringModel: { type: String },
    isBlockingConstraint: { type: Boolean },
    displayOrder: { type: Number },
    thresholds: [{
        bandName: { type: String },
        minScore: { type: Number },
        maxScore: { type: Number },
        bandPriority: { type: Number },
        bandColorCode: { type: String },
        isTerminalFailure: { type: Boolean }
    }],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'constraints'
});

module.exports = mongoose.model('Constraints', ConstraintsSchema);
