const mongoose = require('mongoose');

const QuestionsSchema = new mongoose.Schema({
    questionId: { type: String, required: true, unique: true },
    questionText: { type: String, required: true },
    questionType: { type: String, enum: ['MCQ', 'NUMERIC'] },
    optionsJson: { type: mongoose.Schema.Types.Mixed, default: null },
    scoreMode: { type: String },
    defaultWeight: { type: Number },
    caseScope: { type: String },
    intentScope: { type: String },
    isMandatory: { type: Boolean },
    isActive: { type: Boolean, default: true },
    validationJson: { type: mongoose.Schema.Types.Mixed, default: null },
    scoringRuleId: { type: String },
    scoringType: { type: String, enum: ['MCQ_MAP', 'NUMERIC_RANGE', 'SCALE_LINEAR'] },
    normalizationMin: { type: Number, default: 0 },
    normalizationMax: { type: Number, default: 100 },
    stepApplicability: { type: String, default: null },
    profileGateJson: { type: mongoose.Schema.Types.Mixed, default: null },
    triggerRuleJson: { type: mongoose.Schema.Types.Mixed, default: null },
    outputTagsJson: { type: mongoose.Schema.Types.Mixed, default: null },
    direction: { type: String, enum: ['LOWER_IS_BETTER', 'HIGHER_IS_BETTER'] },
    curveType: { type: String },
    scoringMapJson: { type: mongoose.Schema.Types.Mixed, default: null },
    numericMin: { type: Number },
    numericMax: { type: Number },
    outOfRangePolicy: { type: String },
    roundingRule: { type: String }
}, {
    timestamps: true,
    collection: 'questions'
});

module.exports = mongoose.model('Questions', QuestionsSchema);
