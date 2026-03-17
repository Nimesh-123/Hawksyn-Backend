const mongoose = require('mongoose');

// AEU entry — har ek evidence unit ka pointer
const AeuManifestSchema = new mongoose.Schema({
    artifactType: {
        type: String,
        enum: [
            'PROFILE_CONFIRMED',
            'OBJECTIVE_INPUTS_CAPTURED',
            'EXTERNAL_SIGNALS_CAPTURED',
            'INTEGRITY_PACK'
        ],
        required: true
    },
    rasId:       { type: String, default: null },   // pointer to RAS artifact (nullable if missing)
    stepNo:      { type: Number, required: true },  // 2, 3, 4, 5
    evidenceIds: [{ type: String }],                // optional: individual AEU IDs within artifact
    isAvailable: { type: Boolean, default: true },  // false = artifact missing (degraded)
    missingReason: { type: String, default: null }
}, { _id: false });

// Taxonomy versions snapshot — exactly which versions were used
const TaxonomyVersionSchema = new mongoose.Schema({
    playbookVersionId: { type: String },
    constraintSetId:   { type: String },
    contradictionSetId:{ type: String },
    coverageSetId:     { type: String },
    redFlagSetId:      { type: String },
    accuracyPolicyId:  { type: String },
    externalSignalTaxonomyVersion: { type: String, default: 'v1' }
}, { _id: false });

const CaseFileSchema = new mongoose.Schema({
    caseFileId: { type: String, required: true, unique: true },
    // Format: CF_{runId}_{timestamp}

    runId:    { type: String, required: true },
    userId:   { type: String, required: true },
    caseId:   { type: String, required: true },
    intentId: { type: String, required: true },

    // Status lifecycle: DRAFT → LOCKED
    status: {
        type:    String,
        enum:    ['DRAFT', 'LOCKED'],
        default: 'DRAFT'
    },

    // All AEU artifacts for this run — ordered by step
    aeuManifest: [AeuManifestSchema],

    // Snapshot of taxonomy versions used
    taxonomyVersions: { type: TaxonomyVersionSchema, default: {} },

    // Coverage summary — how complete is this Case File
    coverageSummary: {
        totalArtifactsRequired:  { type: Number, default: 4 },
        totalArtifactsFound:     { type: Number, default: 0 },
        missingArtifacts:        [{ type: String }],
        isComplete:              { type: Boolean, default: false },
        degradedArtifacts:       [{ type: String }]
    },

    // External signals summary (from Step 5)
    externalSignalSummary: {
        collected:        { type: Boolean, default: false },
        dataQuality:      { type: String, default: 'INSUFFICIENT' },
        signalsAvailable: [{ type: String }]  // e.g. ['marketDemandSignal', 'aiDisplacementRisk']
    },

    // Immutability
    isImmutable: { type: Boolean, default: false },
    lockedAt:    { type: Date, default: null },

    // For future re-run comparison
    isEligibleForComparison: { type: Boolean, default: false },
    previousCaseFileId:      { type: String, default: null }, // if re-run

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

CaseFileSchema.index({ runId: 1 });
CaseFileSchema.index({ userId: 1, createdAt: -1 });
CaseFileSchema.index({ caseId: 1, intentId: 1 });

module.exports = mongoose.model('CaseFile', CaseFileSchema);
