const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    configKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    configValue: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String
    }
}, {
    timestamps: true,
    collection: 'system_configs'
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
