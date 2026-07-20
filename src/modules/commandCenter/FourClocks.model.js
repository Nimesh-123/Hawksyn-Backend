const mongoose = require('mongoose');

const FourClocksSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    cvId: { type: String, required: true },
    
    // Status
    clockValidUntil: { type: Date, default: null },
    lastCalculatedAt: { type: Date, default: Date.now },

    // --- CLOCK 1: Career Compounding ---
    clock1: {
        score: { type: Number, default: 0 },
        condition_id: { type: String, default: null },
        trend: { type: Number, default: null },
        contributors: [{ type: String }] // Array of Archetype IDs (Top 5 max)
    },

    // --- CLOCK 2: Operating Level ---
    clock2: {
        level: { type: Number, default: 0 },
        condition_id: { type: String, default: null }, // Usually OL_LX
        trend: { type: Number, default: null },
        contributors: [{ type: String }],
        gap_state: { type: String, default: null } // e.g., 'ALIGNED', 'OVER-TITLED'
    },

    // --- CLOCK 3: Profile Trust ---
    clock3: {
        score: { type: Number, default: 0 },
        condition_id: { type: String, default: null },
        trend: { type: Number, default: null },
        contributors: [{ type: String }]
    },

    // --- CLOCK 4: Evaluation Readiness ---
    clock4: {
        score: { type: Number, default: 0 },
        condition_id: { type: String },
        trend: { type: Number, default: null },
        contributors: [String],
        D1: { type: Number, default: 0 },
        D2: { type: Number, default: 0 },
        D3: { type: Number, default: 0 },
        D4: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    collection: 'four_clocks'
});

module.exports = mongoose.model('FourClocks', FourClocksSchema);
