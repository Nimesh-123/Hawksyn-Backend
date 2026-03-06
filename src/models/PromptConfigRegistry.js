const mongoose = require('mongoose');

const PromptConfigRegistrySchema = new mongoose.Schema({
    promptId: { type: String, required: true, unique: true },
    sectionId: { type: String },
    caseId: { type: String },
    intentId: { type: String },
    playbookVersionId: { type: String },
    promptVersion: { type: Number },
    modelFamily: { type: String },
    temperature: { type: Number },
    maxTokens: { type: Number },
    systemPrompt: { type: String },
    userPrompt: { type: String },
    evidencePlaceholdersJson: { type: mongoose.Schema.Types.Mixed },
    certaintyCapPercent: { type: Number },
    retryPolicy: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'prompt_config_registry'
});

module.exports = mongoose.model('PromptConfigRegistry', PromptConfigRegistrySchema);
