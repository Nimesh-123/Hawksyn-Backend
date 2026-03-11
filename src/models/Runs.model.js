const mongoose = require('mongoose');

const RunsSchema = new mongoose.Schema({
    runId: {
        type: String,
        required: true,
        unique: true
    },
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
        enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'],
        default: 'IN_PROGRESS'
    },
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
    completedAt: { type: Date, default: null }
}, {
    timestamps: true,
    collection: 'runs'
});

// Indexes
RunsSchema.index({ userId: 1 });
RunsSchema.index({ userId: 1, status: 1 });
RunsSchema.index({ caseId: 1, intentId: 1 });

module.exports = mongoose.model('Runs', RunsSchema);
