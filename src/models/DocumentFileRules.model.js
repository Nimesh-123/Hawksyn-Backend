const mongoose = require('mongoose');

const DocumentFileRulesSchema = new mongoose.Schema({
    documentPolicyId: { type: String, required: true, unique: true },
    policyName: { type: String, required: true },
    policyVersion: { type: String, required: true },
    allowedFormats: { type: String, required: true },
    rejectPasswordProtected: { type: Boolean, default: true },
    rejectScannedOrImage: { type: Boolean, default: true },
    parserEngine: { type: String, default: 'TEXT_EXTRACT_V1' },
    normalisationLlm: { type: String, enum: ['GEMINI', 'OPENAI'], default: 'GEMINI' },
    promptTemplateId: { type: String },
    outputSchemaId: { type: String },
    fieldMappingProfileId: { type: String },
    isActive: { type: Boolean, default: true },
    notes: { type: String }
}, {
    timestamps: true,
    collection: 'document_file_rules'
});

module.exports = mongoose.model(
    'DocumentFileRules',
    DocumentFileRulesSchema
);
