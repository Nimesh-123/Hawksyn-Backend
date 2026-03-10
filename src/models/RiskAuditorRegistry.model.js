const mongoose = require('mongoose');

const RiskAuditorRegistrySchema = new mongoose.Schema({
    auditorId: { type: String, required: true, unique: true },
    auditorName: { type: String, required: true },
    professionalBackground: { type: String },
    specializationTags: { type: [String] },
    supportedCases: { type: [String] },
    supportedIntents: { type: [String] },
    escalationTier: { type: String },
    slaHours: { type: Number },
    maxActiveCases: { type: Number },
    ratingScore: { type: Number },
    requiresPrePayment: { type: Boolean, default: true },
    status: { type: String, default: 'ACTIVE' }
}, {
    timestamps: true,
    collection: 'risk_auditor_registry'
});

module.exports = mongoose.model('RiskAuditorRegistry', RiskAuditorRegistrySchema);
