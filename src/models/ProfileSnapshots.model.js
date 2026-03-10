const mongoose = require('mongoose');

const ProfileSnapshotSchema = new mongoose.Schema({
    snapshotId: {
        type: String,
        required: true,
        unique: true
        // Format: SNAP_YYYYMMDD_XXXX
    },
    runId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    version: {
        type: Number,
        default: 1
    },

    // Original Gemini data — NEVER changes
    originalData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    // User edited data — starts as copy of original
    confirmedData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // What user changed
    overrideMap: {
        fieldsChanged: { type: [String], default: [] },
        fieldsAccepted: { type: [String], default: [] },
        assumptionsConfirmed: { type: [String], default: [] },
        assumptionsCorrected: { type: [String], default: [] },
        changeDetails: [
            {
                field: String,
                originalValue: mongoose.Schema.Types.Mixed,
                newValue: mongoose.Schema.Types.Mixed,
                changedAt: Date
            }
        ]
    },

    // Mandatory fields status
    mandatoryFieldsStatus: {
        allFilled: { type: Boolean, default: false },
        missingFields: { type: [String], default: [] }
    },

    // Confirmation state
    isConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    isLocked: { type: Boolean, default: false }
}, {
    timestamps: true,
    collection: 'profile_snapshots'
});

// Indexes
ProfileSnapshotSchema.index({ snapshotId: 1 }, { unique: true });
ProfileSnapshotSchema.index({ runId: 1 });
ProfileSnapshotSchema.index({ userId: 1 });

module.exports = mongoose.model('ProfileSnapshots', ProfileSnapshotSchema);
