const mongoose = require('mongoose');

/**
 * CORE RULES:
 * - Append-only (NO UPDATE / DELETE)
 * - One fact per row
 * - Citation mandatory
 * - Freshness tracking required
 */
const ExternalEvidenceDataPoolSchema = new mongoose.Schema({
    eedpId: { type: String, required: true, unique: true },
    signalId: { type: String, required: true },
    sourceId: { type: String, required: true },
    caseId: { type: String, required: true },
    runId: { type: String, required: true },
    signalValue: { type: String, required: true },
    signalUnit: { type: String, default: null },
    signalDirection: { type: String, default: null },
    fetchedAt: { type: Date, required: true, default: Date.now },
    freshnessExpiresAt: { type: Date, required: true },
    geoScope: { type: String, required: true },
    geoValue: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    citationText: { type: String, required: true },
    confidenceScore: { type: Number, required: true },
    isValidated: { type: Boolean, required: true, default: false },
    aeuId: { type: String, required: true }
}, {
    timestamps: true,
    collection: 'external_evidence_data_pool'
});

// Indexes for performance
ExternalEvidenceDataPoolSchema.index({ signalId: 1 });
ExternalEvidenceDataPoolSchema.index({ runId: 1 });
ExternalEvidenceDataPoolSchema.index({ fetchedAt: 1 });
ExternalEvidenceDataPoolSchema.index({ freshnessExpiresAt: 1 });

module.exports = mongoose.model('ExternalEvidenceDataPool', ExternalEvidenceDataPoolSchema);
