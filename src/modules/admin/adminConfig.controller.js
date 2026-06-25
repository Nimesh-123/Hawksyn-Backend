const { db } = require('../../models/index.model.js');
const RESPONSE = require('../../../utils/response.js');

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
            modelFamily: modelFamily || 'gemini-2.0-flash',
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
 * Get System Settings
 * GET /api/v1/admin/config/system
 */
exports.getSystemSettings = async (req, res) => {
    try {
        let config = await db.SystemConfig.findOne({ configKey: 'GLOBAL_SETTINGS' });
        
        if (!config) {
            config = {
                configKey: 'GLOBAL_SETTINGS',
                configValue: {
                    chatSettings: {
                        freeDaysAfterExpertAssign: 30,
                        chatChargePerMonth: 500,
                        freeDaysAfterHawkRun: 7,
                        slaCommitmentHours: 72
                    },
                    cvReuploadPrice: 99
                },
                description: 'Global configuration for the entire system'
            };
        }

        return RESPONSE.success(res, 200, 1001, config);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Update System Settings
 * POST /api/v1/admin/config/system
 */
exports.updateSystemSettings = async (req, res) => {
    try {
        const { configValue, description } = req.body;

        if (!configValue) {
            return RESPONSE.error(res, 400, 1003, 'configValue is required');
        }

        const config = await db.SystemConfig.findOneAndUpdate(
            { configKey: 'GLOBAL_SETTINGS' },
            { $set: { configValue, description: description || 'Global configuration for the entire system' } },
            { upsert: true, new: true }
        );

        return RESPONSE.success(res, 200, 'System settings updated successfully', {
            config
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
