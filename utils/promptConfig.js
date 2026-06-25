const { db } = require('../src/models/index.model.js');

/**
 * Fetch a prompt from the database or return the default.
 * @param {string} promptId - Unique ID for the prompt.
 * @param {object} defaults - Fallback values { promptText, modelFamily, temperature, maxTokens }.
 * @returns {Promise<object>}
 */
async function getPrompt(promptId, defaults = {}) {
    try {
        const config = await db.AiPrompt.findOne({ promptId, isActive: true });
        if (config) {
            return {
                promptText: config.promptText || defaults.promptText,
                modelFamily: config.modelFamily || defaults.modelFamily || 'claude-sonnet-4-6',
                temperature: config.temperature ?? defaults.temperature ?? 0.7,
                maxTokens: config.maxTokens ?? defaults.maxTokens ?? 4000
            };
        }
        return {
            promptText: defaults.promptText,
            modelFamily: defaults.modelFamily || 'claude-sonnet-4-6',
            temperature: defaults.temperature ?? 0.7,
            maxTokens: defaults.maxTokens ?? 4000
        };
    } catch (error) {
        console.error(`[PromptConfig] Error fetching ${promptId}:`, error.message);
        return {
            promptText: defaults.promptText,
            modelFamily: defaults.modelFamily || 'claude-sonnet-4-6',
            temperature: defaults.temperature ?? 0.7,
            maxTokens: defaults.maxTokens ?? 4000
        };
    }
}

module.exports = { getPrompt };
