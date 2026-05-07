const mongoose = require('mongoose');

const MarketPulseSchema = new mongoose.Schema({
    pulseId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    role: { type: String, required: true },
    industry: { type: String, required: true },
    
    // Scores from Gemini
    aiExposureScore: { type: Number, required: true },
    careerMomentumScore: { type: Number, required: true },
    skillRelevanceScore: { type: Number, required: true },
    opportunityWindowScore: { type: Number, required: true },
    
    // Contextual Data
    careerMomentumMonths: { type: Number, required: true },
    opportunityWindowYears: { type: Number, required: true },
    insightText: { type: String, required: true },
    
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
    generatedBy: { type: String, default: 'CRON_WEEKLY' },

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
    collection: 'market_pulses'
});

MarketPulseSchema.index({ role: 1, industry: 1, isActive: 1 });
// MarketPulseSchema.index({ pulseId: 1 }); // Removed redundant index (already unique: true in field definition)

module.exports = mongoose.model('MarketPulse', MarketPulseSchema);
