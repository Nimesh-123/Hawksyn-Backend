const mongoose = require('mongoose');

const ClockContentSchema = new mongoose.Schema({
    row_id: { type: String, required: false },
    clock_id: { type: mongoose.Schema.Types.Mixed, required: false }, // Could be string or number
    clock_name: { type: String, required: false },
    condition_id: { type: String, required: false },
    condition_name: { type: String, required: false },
    score_range: { type: String, required: false },
    grade: { type: String, required: false },
    element_id: { type: String, required: false },
    element_name: { type: String, required: false },
    screen: { type: String, required: false },
    content_text: { type: String, required: false },
    primary_color: { type: String, required: false },
    bg_color: { type: String, required: false },
    pulse_flag: { type: String, required: false },
    
    // Contributor specific fields (if they exist in the same collection)
    archetype_id: { type: String, required: false },
    display_title: { type: String, required: false },
    display_body: { type: String, required: false },
    detail_direction_tag: { type: String, required: false }
}, {
    timestamps: true,
    collection: 'clock_contents'
});

module.exports = mongoose.model('ClockContent', ClockContentSchema);
