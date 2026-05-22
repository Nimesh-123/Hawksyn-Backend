const mongoose = require('mongoose');

const QuestionsSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    questionType: { type: String, enum: ['MCQ', 'NUMERIC'] },
    
    // Explicit Options (from Excel)
    optionA: { type: String },
    optionB: { type: String },
    optionC: { type: String },
    optionD: { type: String },
    
    optionsJson: { type: mongoose.Schema.Types.Mixed, default: null },
    scoreMode: { type: String },
    defaultWeight: { type: Number },
    caseScope: { type: String },
    intentScope: { type: String },
    
    questionRole: { type: String },
    mirrorPairId: { type: String },
    accuracyImpactFlag: { type: String },
    
    isRequired: { type: Boolean },
    isMandatory: { type: Boolean },
    
    isActive: { type: Boolean, default: true },
    validationJson: { type: mongoose.Schema.Types.Mixed, default: null },
    
    scoringRuleId: { type: String },
    scoringType: { type: String, enum: ['MCQ_MAP', 'NUMERIC_RANGE', 'SCALE_LINEAR'] },
    normalizationMin: { type: Number, default: 0 },
    normalizationMax: { type: Number, default: 100 },
    direction: { type: String, enum: ['LOWER_IS_BETTER', 'HIGHER_IS_BETTER'] },
    
    // MCQ Option Scores (from QST)
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
    
    scientificFramework: { type: String },
    sourceReference: { type: String },
    
    stepApplicability: { type: String, default: null },
    profileGateJson: { type: mongoose.Schema.Types.Mixed, default: null },
    triggerRuleJson: { type: mongoose.Schema.Types.Mixed, default: null },
    outputTagsJson: { type: mongoose.Schema.Types.Mixed, default: null },
    
    curveType: { type: String },
    scoringMapJson: { type: mongoose.Schema.Types.Mixed, default: null },
    numericMin: { type: Number },
    numericMax: { type: Number }
}, {
    timestamps: true,
    collection: 'questions'
});

module.exports = mongoose.model('Questions', QuestionsSchema);
