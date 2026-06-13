const mongoose = require('mongoose');

const hipSectionPromptSchema = new mongoose.Schema({
    sectionId: { type: String, required: true, unique: true }, // e.g., 'S01'
    sectionName: { type: String, required: true }, // e.g., 'Distinctive Edge'
    chapter: { type: String }, // e.g., 'What Stands Out'
    pattern: { type: String }, // e.g., 'PATTERN_B'
    modelConfig: {
        modelFamily: { type: String, default: 'Claude' },
        temperature: { type: Number, default: 0.3 },
        tokenCeiling: { type: Number }
    },
    systemPrompt: { type: String, required: true },
    userPromptTemplate: { type: String, required: true },
    activeGuardrails: [{ type: String }], // Array of ruleIds like 'GR_H_001'
    htmlSlotTemplate: { type: String, required: true }, // The Handlebars HTML template
    degradedHtmlTemplate: { type: String, required: true }, // HTML to show if generation fails
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('HipSectionPrompt', hipSectionPromptSchema);
