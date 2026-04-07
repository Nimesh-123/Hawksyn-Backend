const mongoose = require('mongoose');

const RunsSchema = new mongoose.Schema({
    runId: {
        type: String,
        required: true,
        unique: true
    },
    requestId: { type: String, unique: true, sparse: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    playbookVersionId: { type: String, required: true },
    status: {
        type: String,
        enum: [
            'CREATED',
            'CV_UPLOADED',
            'PROFILE_CONFIRMED',
            'QUESTIONS_CONFIRMED',
            'SIGNALS_COLLECTED',
            'CASE_FILE_LOCKED',
            'INTEGRITY_COMPLETE',
            'REPORT_COMPLETE',
            'EXPERT_ASSIGNED'
        ],
        default: 'CREATED'
    },
    finalReport: { type: mongoose.Schema.Types.Mixed, default: null },
    verdict:     { type: String, enum: ['PROCEED', 'PAUSE', 'ABORT'], default: null },
    cvSnapshot: {
        cvUploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentUploads', default: null },
        cvUrl: { type: String, default: null },
        parsedData: { type: mongoose.Schema.Types.Mixed, default: null },
        attachedAt: { type: Date, default: null },
        source: {
            type: String,
            enum: ['EXISTING', 'REUPLOADED'],
            default: null
        }
    },
    objectiveInputs: { type: mongoose.Schema.Types.Mixed, default: null },
    isImmutable: { type: Boolean, default: false },
    eligibleForComparison: { type: Boolean, default: false },
    previousRunId: { type: String, default: null }, // Set for re-runs — used to bypass payment check
    reRunSetup: {
        eligibleForFreeReRun: { type: Boolean, default: false },
        freeReRunExpiryDate: { type: Date, default: null },
        reRunPriceOverride: { type: Number, default: null }
    },
    // ── EXPERT / SLA TRACKING (Task 20) ──
    expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskAuditorRegistry', default: null },
    expertAssignedAt: { type: Date, default: null },
    expertReviewedAt: { type: Date, default: null },
    isSlaBreached: { type: Boolean, default: false },
    completedAt: { type: Date, default: null }
}, {
    timestamps: true,
    collection: 'runs'
});

// Indexes

RunsSchema.index({ userId: 1, status: 1 });
RunsSchema.index({ caseId: 1, intentId: 1 });
RunsSchema.index({ createdAt: -1 });
RunsSchema.index({ status: 1 });
RunsSchema.index({ runId: 1, userId: 1 });

module.exports = mongoose.model('Runs', RunsSchema);
