const mongoose = require('mongoose');

const ClockHistorySchema = new mongoose.Schema({
    historyId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    
    // Scores
    aiExposureScore: { type: Number, required: true },
    careerMomentumScore: { type: Number, required: true },
    skillRelevanceScore: { type: Number, required: true },
    opportunityWindowScore: { type: Number, required: true },
    
    careerMomentumMonths: { type: Number, default: 0 },
    opportunityWindowYears: { type: Number, default: 0 },

    triggeredBy: { type: String, enum: ['AUTO_OPEN', 'HAWK', 'CASE_RUN'], default: 'AUTO_OPEN' },
    pulseId: { type: String, default: null },
    calculatedAt: { type: Date, default: Date.now },

    // AI Audit Metadata
    llm: { type: String, default: 'N/A' },
    model: { type: String, default: 'N/A' },
    tokenUsage: {
        promptTokens: { type: Number, default: 0 },
        completionTokens: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 }
    },
    calculationDuration: { type: String, default: null }
}, {
    timestamps: true,
    collection: 'clock_history'
});

ClockHistorySchema.index({ userId: 1, calculatedAt: -1 });

module.exports = mongoose.model('ClockHistory', ClockHistorySchema);
