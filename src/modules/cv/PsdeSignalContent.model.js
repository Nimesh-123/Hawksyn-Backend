const mongoose = require('mongoose');

const psdeSignalContentSchema = new mongoose.Schema({
    archetype_id: { type: String, required: true },
    seniority_variant: { type: String, required: true, default: 'ALL' },
    cluster: { type: String, required: true },
    archetype_name: { type: String },
    polarity: { type: String },
    surface_at_intake: { type: String },
    has_interview_q: { type: String },
    detection_condition: { type: String },
    seniority_context: { type: String },
    meaning: { type: String },
    outside_view: { type: String },
    positive_reading: { type: String },
    negative_reading: { type: String },
    what_decides: { type: String },
    closing_tension: { type: String },
    iq_l1_clarify: { type: String },
    iq_l2_probe: { type: String },
    iq_l3_validate: { type: String },
    iq_l4_generalise: { type: String },
    iq_l5_reflect: { type: String }
}, { 
    collection: 'psde_signal_contents',
    timestamps: true 
});

// Composite index for fast lookups based on engine results
psdeSignalContentSchema.index({ archetype_id: 1, seniority_variant: 1 }, { unique: true });

module.exports = mongoose.model('PsdeSignalContent', psdeSignalContentSchema);
