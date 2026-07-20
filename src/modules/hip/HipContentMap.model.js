const mongoose = require('mongoose');

const hipContentMapSchema = new mongoose.Schema({
    db_key: { type: String, required: true, unique: true }, // e.g., 'C1S1_FR_STRONG'
    section_id: { type: String, required: true }, // e.g., 'C1S1'
    chapter_id: { type: String, required: true }, // e.g., '1'
    section_name: { type: String, required: true }, // e.g., 'Top Signals'
    band_code: { type: String, required: true }, // e.g., 'FR'
    band_label: { type: String, required: true }, // e.g., 'Fresher (0-2 yrs)'
    signal_level: { type: String, required: true },
    
    headline: { type: String, required: true },
    content_block: { type: String, required: true },
    
    capability_titles: { type: String, required: false },
    capability_actions: { type: String, required: false },
    scarcity_titles: { type: String, required: false },
    scarcity_actions: { type: String, required: false },
    
    ref_developer_reference: { type: String, required: false },
    ref_signal_map: { type: String, required: false },
    pif_check: { type: String, required: false }
}, {
    timestamps: true,
    collection: 'hip_content_maps'
});

// Index for fast lookups
hipContentMapSchema.index({ db_key: 1 });
hipContentMapSchema.index({ band_code: 1, section_id: 1, signal_level: 1 });

module.exports = mongoose.model('HipContentMap', hipContentMapSchema);

