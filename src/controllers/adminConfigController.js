const { db } = require('../models/index.model.js');
const RESPONSE = require('../../utils/response.js');

/**
 * Get a specific prompt configuration by its ID
 * GET /api/v1/admin/config/prompt/:promptId
 */
exports.getPromptConfig = async (req, res) => {
    try {
        const { promptId } = req.params;
        let config = await db.AiPrompt.findOne({ promptId, isActive: true });
        
        if (!config) {
            return RESPONSE.error(res, 404, 4004, `Prompt configuration for ${promptId} not found`);
        }

        return RESPONSE.success(res, 200, 1001, config);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Update or Create a prompt configuration
 * POST /api/v1/admin/config/prompt
 */
exports.upsertPromptConfig = async (req, res) => {
    try {
        const { 
            promptId, 
            promptText,
            title, 
            maxTokens, 
            temperature,
            modelFamily
        } = req.body;

        if (!promptId) {
            return RESPONSE.error(res, 400, 1003, 'promptId is required');
        }

        if (!promptText) {
            return RESPONSE.error(res, 400, 1003, 'promptText is required');
        }

        const updateData = {
            promptText,
            title: title || promptId,
            maxTokens: maxTokens || 4000,
            temperature: temperature ?? 0.7,
            modelFamily: modelFamily || 'claude-3-sonnet',
            isActive: true
        };

        const config = await db.AiPrompt.findOneAndUpdate(
            { promptId },
            { $set: updateData },
            { upsert: true, new: true }
        );

        return RESPONSE.success(res, 200, 'Prompt configuration updated successfully', {
            config
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * List all active prompt configurations
 * GET /api/v1/admin/config/prompts
 */
exports.getAllPromptConfigs = async (req, res) => {
    try {
        const configs = await db.AiPrompt.find({ isActive: true });
        return RESPONSE.success(res, 200, 1001, configs);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
/**
 * Get System Settings by Key
 * GET /api/v1/admin/config/system/:configKey
 */
exports.getSystemSettings = async (req, res) => {
    try {
        const { configKey } = req.params;
        let config = await db.SystemConfig.findOne({ configKey });
        
        // Default Chat Settings if not found
        if (!config && configKey === 'CHAT_SETTINGS') {
            config = {
                configKey: 'CHAT_SETTINGS',
                configValue: {
                    freeDaysAfterExpertAssign: 30,
                    chatChargePerMonth: 500,
                    freeDaysAfterHawkRun: 7
                }
            };
        }

        if (!config) {
            return RESPONSE.error(res, 404, 4004, `Settings for ${configKey} not found`);
        }

        return RESPONSE.success(res, 200, 1001, config);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Update or Create System Settings
 * POST /api/v1/admin/config/system
 */
exports.updateSystemSettings = async (req, res) => {
    try {
        const { configKey, configValue, description } = req.body;

        if (!configKey || !configValue) {
            return RESPONSE.error(res, 400, 1003, 'configKey and configValue are required');
        }

        const config = await db.SystemConfig.findOneAndUpdate(
            { configKey },
            { $set: { configValue, description } },
            { upsert: true, new: true }
        );

        return RESPONSE.success(res, 200, 'System settings updated successfully', {
            config
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
