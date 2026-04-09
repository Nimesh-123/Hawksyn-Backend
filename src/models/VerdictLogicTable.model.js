const mongoose = require('mongoose');

const VerdictLogicTableSchema = new mongoose.Schema({
    ruleId: { type: String, required: true, unique: true },
    stage: { 
        type: Number, 
        required: true,
        min: 1,
        max: 5
    },
    ruleName: { type: String, required: true },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true }, // FK or 'ALL'
    conditionJson: { type: mongoose.Schema.Types.Mixed, required: true },
    actionType: { type: String, required: true },
    actionValueJson: { type: mongoose.Schema.Types.Mixed, required: true },
    priority: { type: Number, required: true },
    isActive: { type: Boolean, required: true, default: true }
}, {
    timestamps: true,
    collection: 'verdict_logic_table'
});

module.exports = mongoose.model('VerdictLogicTable', VerdictLogicTableSchema);
