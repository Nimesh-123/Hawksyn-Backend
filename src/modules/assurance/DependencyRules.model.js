const mongoose = require('mongoose');

const DependencyRulesSchema = new mongoose.Schema({
    dependencyRuleId: { type: String, required: true, unique: true },
    moiId: { type: String, required: true },
    ruleName: { type: String, required: true },
    targetQuestionId: { type: String, required: true },
    ruleJson: { type: Object, required: true },
    onFailAction: { type: String, default: 'SKIP' },
    skipReason: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'dependency_rules'
});

module.exports = mongoose.model('DependencyRules', DependencyRulesSchema);
