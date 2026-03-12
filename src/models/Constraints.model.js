const mongoose = require('mongoose');

const ConstraintsSchema = new mongoose.Schema({
    constraintId: { type: String, required: true, unique: true },
    constraintSetId: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    constraintName: { type: String, required: true },
    constraintDescription: { type: String },
    scoringModel: { type: String },
    isBlockingConstraint: { type: Boolean },
    displayOrder: { type: Number },
    thresholdSetId: { type: String, required: true },

    // STRONG
    strongMin: { type: Number, required: true },
    strongMax: { type: Number, required: true },
    strongColor: { type: String, default: '#2E7D32' },
    strongIsTerminal: { type: Boolean, default: false },
    strongPriority: { type: Number, default: 1 },

    // MODERATE
    moderateMin: { type: Number, required: true },
    moderateMax: { type: Number, required: true },
    moderateColor: { type: String, default: '#F57F17' },
    moderateIsTerminal: { type: Boolean, default: false },
    moderatePriority: { type: Number, default: 2 },

    // FRAGILE
    fragileMin: { type: Number, required: true },
    fragileMax: { type: Number, required: true },
    fragileColor: { type: String, default: '#E65100' },
    fragileIsTerminal: { type: Boolean, default: false },
    fragilePriority: { type: Number, default: 3 },

    // CRITICAL
    criticalMin: { type: Number, required: true },
    criticalMax: { type: Number, required: true },
    criticalColor: { type: String, default: '#C62828' },
    criticalIsTerminal: { type: Boolean, default: true },
    criticalPriority: { type: Number, default: 4 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'constraints'
});

module.exports = mongoose.model('Constraints', ConstraintsSchema);
