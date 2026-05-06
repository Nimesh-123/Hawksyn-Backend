const { db } = require('../src/models/index.model.js');

/**
 * Get Chat Settings from SystemConfig
 */
async function getChatSettings() {
    try {
        const config = await db.SystemConfig.findOne({ configKey: 'CHAT_SETTINGS' });
        if (config && config.configValue) {
            return config.configValue;
        }
    } catch (err) {
        console.warn('[ConfigHelper] Failed to fetch CHAT_SETTINGS:', err.message);
    }

    // Default Fallback
    return {
        freeDaysAfterExpertAssign: 30,
        chatChargePerMonth: 500,
        freeDaysAfterHawkRun: 7
    };
}

module.exports = {
    getChatSettings
};
