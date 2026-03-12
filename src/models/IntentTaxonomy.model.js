const mongoose = require('mongoose');

const IntentTaxonomySchema = new mongoose.Schema({
    intentId: { type: String, required: true, unique: true },
    intentName: { type: String, required: true },
    intentDescription: { type: String, default: null },
    intentHorizonDays: { type: Number },
    intentType: { type: String, enum: ['STABILITY', 'SWITCH', 'UPSKILL'] },
    primaryOutcome: { type: String },
    defaultVerdictMode: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'intent_taxonomy'
});

module.exports = mongoose.model('IntentTaxonomy', IntentTaxonomySchema);
