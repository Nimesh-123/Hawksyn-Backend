const mongoose = require('mongoose');

const RasSchema = new mongoose.Schema({
    rasId: { type: String, required: true, unique: true },
    runId: { type: String, required: true },
    stepNo: { type: Number, required: true },
    artifactType: {
        type: String,
        required: true,
        enum: [
            'CV_RAW_TEXT',
            'CV_NORMALISED',
            'MISSING_FIELD_QUESTIONS',
            'PROFILE_CONFIRMED',
            'OBJECTIVE_INPUTS_CAPTURED',
            'EXTERNAL_SIGNALS_CAPTURED',
            'CONSTRAINT_SCORES',
            'RED_FLAGS_TRIGGERED',
            'INTEGRITY_PACK',
            'FINAL_REPORT',
            'REPORT_GENERATED',
            'EXPERT_ASSIGNED'
        ]
    },
    artifactVersion: { type: Number, default: 1 },
    artifactJson: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
        type: String,
        enum: ['DRAFT', 'FINAL', 'FAILED'],
        default: 'FINAL'
    }
}, { timestamps: true });

// Indexes for high-performance scale (1-2 Lakh users)
RasSchema.index({ runId: 1 });
RasSchema.index({ runId: 1, artifactType: 1, status: 1 });
RasSchema.index({ artifactType: 1 });

module.exports = mongoose.model('Ras', RasSchema, 'ras');
