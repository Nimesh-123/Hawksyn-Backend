const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserProfileSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    lastCvUploadId: {
        type: Schema.Types.ObjectId,
        ref: 'DocumentUploads',
        default: null
    },

    cvUrl: {
        type: String,
        default: null
    },

    originalParsedData: {
        type: Schema.Types.Mixed,
        default: null
        // raw Gemini output — never changes
    },

    confirmedProfile: {
        type: Schema.Types.Mixed,
        default: null
        // user edited + confirmed version
    },

    overrideMap: {
        fieldsChanged: { type: [String], default: [] },
        fieldsAccepted: { type: [String], default: [] },
        assumptionsConfirmed: { type: [String], default: [] },
        assumptionsCorrected: { type: [String], default: [] },
        changeDetails: [
            {
                field: String,
                originalValue: Schema.Types.Mixed,
                newValue: Schema.Types.Mixed,
                changedAt: Date
            }
        ]
    },

    isConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null }
}, {
    collection: 'user_profiles',
    timestamps: true
});

UserProfileSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('UserProfile', UserProfileSchema);
