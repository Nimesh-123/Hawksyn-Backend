const mongoose = require('mongoose');

const CvFileRulesSchema = new mongoose.Schema({
    cvPolicyId: { type: String, required: true, unique: true },
    policyName: { type: String, required: true },
    policyVersion: { type: String },
    allowedFormats: { type: String },
    rejectPasswordProtected: { type: Boolean },
    rejectScannedOrImage: { type: Boolean },
    parserEngine: { type: String },
    normalisationLlm: { type: String },
    promptTemplateId: { type: String },
    outputSchemaId: { type: String },
    fieldMappingProfileId: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'cv_file_rules'
});

module.exports = mongoose.model('CvFileRules', CvFileRulesSchema);
