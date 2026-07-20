const mongoose = require('mongoose');

const PSDEResultSchema = new mongoose.Schema({
    candidate_id: {
        type: String,
        required: true,
        index: true
    },
    candidate_intelligence_summary: {
        type: String,
        default: null
    },
    total_evaluated: { type: Number, default: 330 },
    total_detected: { type: Number, default: 0 },
    total_partial: { type: Number, default: 0 },
    total_not_detected: { type: Number, default: 330 },
    total_contradicted: { type: Number, default: 0 },
    top_fired: [mongoose.Schema.Types.Mixed],  // top 10 by confidence
    cluster_summary: mongoose.Schema.Types.Mixed, // C1-C8 counts
    archetype_results: [
        {
            archetype_id: String,
            archetype_name: String,
            cluster_id: String,
            dimension_id: String,
            detection_state: {
                type: String,
                enum: ['detected', 'partial', 'not_detected', 'contradicted'],
                default: 'not_detected'
            },
            confidence_score: {
                type: Number,
                min: 0.0,
                max: 0.9
            },
            polarity: {
                type: String,
                enum: ['positive', 'negative', 'neutral', 'context_dependent']
            },
            evidence_source: { type: String, default: 'cv_archetype_detection' },
            minimum_anchors_required: { type: Number, default: 1 },
            actual_anchor_count: { type: Number, default: 0 },
            evidence_anchors: [
                {
                    anchor_id: String,
                    anchor_type: String,
                    anchor_value: mongoose.Schema.Types.Mixed,
                    derivation_method: {
                        type: String,
                        enum: ['direct_extraction', 'aggregation', 'cross_field_computation', 'absence_check', 'user_provided']
                    },
                    cv_location: mongoose.Schema.Types.Mixed,
                    verbatim_quote: String,
                    anchor_confidence: Number
                }
            ],
            reasoning: String,
            explanation: String,
            flags: [String]
        }
    ],
    debug_trace: mongoose.Schema.Types.Mixed,
    meta: {
        total_scanned: Number,
        total_detected: Number,
        scan_time_ms: Number,
        generated_at: Date
    }
}, {
    timestamps: true,
    collection: 'psde_results'
});

module.exports = mongoose.model('PSDEResult', PSDEResultSchema);
