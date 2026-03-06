const mongoose = require('mongoose');

const QuestionsSchema = new mongoose.Schema({
    questionId: { type: String, required: true, unique: true },
    questionText: { type: String, required: true },
    questionType: { type: String },
    optionsJson: [{
        opt: { type: String },
        score: { type: Number }
    }],
    scoreMode: { type: String },
    defaultWeight: { type: Number },
    caseScope: { type: String },
    intentScope: { type: String },
    isMandatory: { type: Boolean },
    isActive: { type: Boolean, default: true },
    validationJson: { type: mongoose.Schema.Types.Mixed },
    scoringRuleId: { type: String },
    scoringType: { type: String },
    normalizationMin: { type: Number },
    normalizationMax: { type: Number },
    direction: { type: String },
    curveType: { type: String },
    scoringMapJson: [{
        optionScore: { type: Number },
        normalizedScore: { type: Number }
    }],
    numericMin: { type: Number },
    numericMax: { type: Number },
    outOfRangePolicy: { type: String },
    roundingRule: { type: String }
}, {
    timestamps: true,
    collection: 'questions'
});

module.exports = mongoose.model('Questions', QuestionsSchema);
