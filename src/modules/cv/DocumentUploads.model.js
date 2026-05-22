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

        // Guardrail & Audit Info from CVUpload
        rejection_rule_id: { type: String, default: null },
        rejection_layer: { type: String, default: null },
        user_message: { type: String, default: null },
        file_name_original: { type: String },
        file_size_bytes: { type: Number },
        file_format: { type: String },
        page_count: { type: Number, default: null },
        char_count: { type: Number, default: null },
        raw_text_path: { type: String, default: null },
        full_text: { type: String, default: null },
        warnings: { type: [String], default: [] },

        // Parser & Audit Logic
        parserStatus: {
            type: String,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'EMPTY', 'INVALID_FORMAT', 'NOT_A_CV', 'REJECTED', 'accepted', 'rejected', 'processing', 'extraction_complete'],
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

        // Metrics from CVUpload
        metrics: {
            total_tokens_input: { type: Number, default: 0 },
            total_tokens_output: { type: Number, default: 0 },
            processing_duration_ms: { type: Number, default: 0 },
            estimated_cost_usd: { type: Number, default: 0 },
            estimated_cost_inr: { type: Number, default: 0 }
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
