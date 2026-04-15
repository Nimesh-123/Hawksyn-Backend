const mongoose = require('mongoose');

const LegalContentSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['TERMS', 'PRIVACY', 'REFUND', 'DISCLAIMER'], 
        required: true,
        unique: true 
    },
    title: { type: String, required: true },
    content: { type: String, required: true }, // Markdown or HTML string
    version: { type: String, default: '1.0' },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('LegalContent', LegalContentSchema);
