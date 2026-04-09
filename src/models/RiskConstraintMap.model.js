const mongoose = require('mongoose');

const RiskConstraintMapSchema = new mongoose.Schema({
    rcmId: { type: String, required: true, unique: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    droId: { type: String, required: true },
    constraintId: { type: String, required: true, default: 'ALL' },
    triggerSource: { 
        type: String, 
        required: true,
        enum: ['CONSTRAINT_THRESHOLD', 'CONTRADICTION_TRIGGER', 'COVERAGE_GAP', 'EXTERNAL_SIGNAL_TRIGGER', 'CONSTRAINT_SCORE', 'RED_FLAG', 'COMPOSITE_PATTERN', 'CONTRADICTION']
    },
    triggerReferenceId: { type: String, required: true },
    triggerConditionJson: { type: mongoose.Schema.Types.Mixed, required: true },
    activationMode: { 
        type: String, 
        required: true,
        enum: ['AUTOMATIC_ON_MATCH', 'CONDITIONAL_MODEL_FALLBACK', 'MANUAL_AUDITOR_OVERRIDE', 'STANDALONE']
    },
    confidenceImpact: { 
        type: String, 
        required: true,
        enum: ['NONE', 'LOW_DEDUCTION', 'MEDIUM_DEDUCTION', 'HIGH_DEDUCTION', 'CERTAINTY_CAP', 'DEGRADES', 'CRITICAL_BLOCK']
    },
    displayOrder: { type: Number, required: true },
    isActive: { type: Boolean, required: true, default: true }
}, {
    timestamps: true,
    collection: 'risk_constraint_map'
});

module.exports = mongoose.model('RiskConstraintMap', RiskConstraintMapSchema);
