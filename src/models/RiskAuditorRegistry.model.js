const mongoose = require('mongoose');

const RiskAuditorRegistrySchema = new mongoose.Schema({
    auditorId: { type: String, required: true, unique: true },
    auditorName: { type: String, required: true },
    caseId: { type: String, required: true },
    specializations: { type: [String], default: [] },
    maxCaseload: { type: Number, default: 20 },
    currentCaseload: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // Keeping some legacy fields just in case
    professionalBackground: { type: String },
    ratingScore: { type: Number },
    status: { type: String, default: 'ACTIVE' }
}, {
    timestamps: true,
    collection: 'risk_auditor_registry'
});

module.exports = mongoose.model('RiskAuditorRegistry', RiskAuditorRegistrySchema);
