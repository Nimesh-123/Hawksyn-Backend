const mongoose = require('mongoose');

const extractedCVSchema = new mongoose.Schema({
    candidate_id: { type: String, required: true, unique: true },
    header: { type: mongoose.Schema.Types.Mixed },
    roles: { type: [mongoose.Schema.Types.Mixed] },
    education: { type: [mongoose.Schema.Types.Mixed] },
    skills: { type: mongoose.Schema.Types.Mixed },
    credentials: { type: [mongoose.Schema.Types.Mixed] },
    base_aeus: { type: [mongoose.Schema.Types.Mixed] },
    consolidator_output: { type: mongoose.Schema.Types.Mixed },
    precomputed_stats: { type: mongoose.Schema.Types.Mixed },
    consolidator_flags: { type: mongoose.Schema.Types.Mixed },
    extraction_meta: { type: mongoose.Schema.Types.Mixed },
    extraction_version: { type: String, default: 'v1' },
    extracted_at: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'extracted_cvs' });

module.exports = mongoose.model('ExtractedCV', extractedCVSchema);
