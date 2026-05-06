const mongoose = require('mongoose');

const AiPromptSchema = new mongoose.Schema({
    promptId: { 
        type: String, 
        required: true, 
        unique: true,
        enum: ['IDENTITY_WORK_PROMPT', 'SKILLS_PROJECTS_PROMPT', 'CV_PARSER_CONSOLIDATED']
    },
    title: { type: String },
    promptText: { type: String, required: true },
    modelFamily: { type: String, default: 'claude-3-sonnet' },
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 4000 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'ai_prompts'
});

module.exports = mongoose.model('AiPrompt', AiPromptSchema);
