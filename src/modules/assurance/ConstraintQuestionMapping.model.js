const mongoose = require('mongoose');

const ConstraintQuestionMappingSchema = new mongoose.Schema({
    cqmtId: { type: String, required: true },
    mappingId: { type: String }, // Alias
    constraintId: { type: String }, // Made optional as QST sheet sometimes omits it
    questionId: { type: String, required: true },
    caseId: { type: String },
    intentId: { type: String },
    
    // Scoring Metadata
    scoringRuleId: { type: String },
    scoringType: { type: String, enum: ['MCQ_MAP', 'NUMERIC_RANGE', 'SCALE_LINEAR'] },
    normalizationMin: { type: Number, default: 0 },
    normalizationMax: { type: Number, default: 100 },
    direction: { type: String, enum: ['LOWER_IS_BETTER', 'HIGHER_IS_BETTER'] },
    
    // MCQ Option Mappings
    optionARaw: { type: mongoose.Schema.Types.Mixed },
    optionAScore: { type: Number },
    optionBRaw: { type: mongoose.Schema.Types.Mixed },
    optionBScore: { type: Number },
    optionCRaw: { type: mongoose.Schema.Types.Mixed },
    optionCScore: { type: Number },
    optionDRaw: { type: mongoose.Schema.Types.Mixed },
    optionDScore: { type: Number },
    
    outOfRangePolicy: { type: String },
    roundingRule: { type: String },
    
    // Scientific Context
    scientificFramework: { type: String },
    sourceReference: { type: String },
    
    contributionWeight: { type: Number },
    isRequiredForConstraint: { type: Boolean },
    normalizationMethod: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'constraint_question_mapping'
});

module.exports = mongoose.model('ConstraintQuestionMapping', ConstraintQuestionMappingSchema);
