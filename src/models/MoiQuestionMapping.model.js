const mongoose = require('mongoose');

const MoiQuestionMappingSchema = new mongoose.Schema({
    moiqmId: { type: String, required: true, unique: true },
    moiId: { type: String, required: true },
    questionId: { type: String, required: true },
    isMandatory: { type: Boolean, default: true },
    weightOverride: { type: Number, default: null },
    accuracyImpactFlag: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    displayOrder: { type: Number, required: true },
    dependencyRuleId: { type: String, default: null },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'moi_question_mapping'
});

module.exports = mongoose.model('MoiQuestionMapping', MoiQuestionMappingSchema);
