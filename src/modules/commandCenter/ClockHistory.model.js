const mongoose = require('mongoose');

const ClockHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    cvId: { type: String, required: true }, // The CV that triggered this scan
    
    // The calculated scores for this scan
    clock1_score: { type: Number, default: null }, // 0-100
    clock2_level: { type: Number, default: null }, // 1-6
    clock3_score: { type: Number, default: null }, // 0-100
    clock4_score: { type: Number, default: null }, // 0-100

    // The deltas (Current - Previous) calculated at the time of this scan
    clock1_trend: { type: Number, default: null },
    clock2_trend: { type: Number, default: null },
    clock3_trend: { type: Number, default: null },
    clock4_trend: { type: Number, default: null },

    scannedAt: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'clock_histories'
});

ClockHistorySchema.index({ userId: 1, scannedAt: -1 });

module.exports = mongoose.model('ClockHistory', ClockHistorySchema);
