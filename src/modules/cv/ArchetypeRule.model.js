const mongoose = require('mongoose');

const archetypeRuleSchema = new mongoose.Schema({
    archetype_id: { type: String, required: true, unique: true },
    archetype_name: { type: String, required: true },
    cluster_id: { type: String, required: true },
    cluster_name: { type: String },
    dimension_id: { type: String },
    dimension_name: { type: String },
    polarity: { type: String, enum: ['positive', 'negative', 'neutral', 'context_dependent'] },
    min_anchors_required: { type: Number },
    confidence_floor: { type: Number },
    mutex_group: { type: String },
    detection_type: { type: String, default: 'deterministic' },
    mongo_collection: { type: String },
    derivation_method: { type: String },
    cv_location: { type: String },
    anchor_fields_read: { type: String },
    detection_condition: { type: String },
    confidence_formula: { type: String },
    surface_at_intake: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true }
}, { collection: 'archetype_rules' });

archetypeRuleSchema.index({ cluster_id: 1 });

module.exports = mongoose.model('ArchetypeRule', archetypeRuleSchema);
