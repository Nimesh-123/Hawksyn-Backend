const mongoose = require('mongoose');

const ConstraintQuestionMappingSchema = new mongoose.Schema({
    cqmtId: { type: String, required: true, unique: true },
    constraintId: { type: String, required: true },
    questionId: { type: String, required: true },
    scoringRuleId: { type: String },
    contributionWeight: { type: Number },
    isRequiredForConstraint: { type: Boolean },
    normalizationMethod: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'constraint_question_mapping'
});

module.exports = mongoose.model('ConstraintQuestionMapping', ConstraintQuestionMappingSchema);
