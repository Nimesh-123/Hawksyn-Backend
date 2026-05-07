const mongoose = require('mongoose');

const documentUploadsSchema = new mongoose.Schema(
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
            required: false
        },

        // Parser & Audit Logic
        parserStatus: {
            type: String,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'EMPTY', 'INVALID_FORMAT', 'NOT_A_CV'],
            default: 'PENDING'
        },
        parsedCvData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        errorReason: {
            type: String,
            default: null
        },
        parserMetadata: {
            llm: { type: String },
            model: { type: String },
            modelUsed: { type: String },
            duration: { type: String },
            tokenUsage: { type: mongoose.Schema.Types.Mixed }
        },

        // Lifecycle Status
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
        collection: 'document_uploads'
    }
);

// Indexes
documentUploadsSchema.index(
    { userId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);
documentUploadsSchema.index({ userId: 1, uploadedAt: -1 });

module.exports = mongoose.model('DocumentUploads', documentUploadsSchema);