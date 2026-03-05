const mongoose = require('mongoose');

const userCvUploadsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // File Info
        fileName: {
            type: String,
            required: true
        },
        cvUrl: {
            type: String,
            required: true
        },

        // Parser
        parserStatus: {
            type: String,
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
            default: 'PENDING'
        },
        parsedCvData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        rejectionReason: {
            type: String,
            default: null
        },

        // Status
        isActive: {
            type: Boolean,
            default: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true,
        collection: 'user_cv_uploads'
    }
);

// Indexes
userCvUploadsSchema.index(
    { userId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);
userCvUploadsSchema.index({ userId: 1, uploadedAt: -1 });

module.exports = mongoose.model('UserCvUploads', userCvUploadsSchema);