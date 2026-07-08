const mongoose = require('mongoose');

const CareerFactorSchema = new mongoose.Schema({
    factorText: { type: String, required: true },
    impactDirection: { type: String, enum: ['UP', 'DOWN', 'NEUTRAL'], required: true },
    explanation: { type: String, required: true }
}, { _id: false });

const UserClocksSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },

    // Lifecycle Fields
    planType: { type: String, enum: ['FREE', 'PAID'], default: 'FREE' },
    totalRefreshes: { type: Number, default: 1 },
    refreshesUsed: { type: Number, default: 0 },

    // Scores (Flat structure as used in controllers)
    aiExposureScore: { type: Number, default: 0 },
    careerMomentumScore: { type: Number, default: 0 },
    skillRelevanceScore: { type: Number, default: 0 },
    opportunityWindowScore: { type: Number, default: 0 },

    careerMomentumMonths: { type: Number, default: 0 },
    opportunityWindowYears: { type: Number, default: 0 },

    // Justifications & Trends (Gemini derived - Legacy strings)
    aiExposureJustification: { type: String, default: null },
    careerMomentumJustification: { type: String, default: null },
    skillRelevanceJustification: { type: String, default: null },
    opportunityWindowJustification: { type: String, default: null },
    trendTrigger: { type: String, default: null },

    // Detailed AI Insights (For Standalone Clock Screens)
    aiExposureFactors: { type: [CareerFactorSchema], default: [] },
    aiExposureMarketSignal: { type: String, default: null },
    aiExposurePeerSignal: { type: String, default: null },
    aiExposureWhatChanges: { type: String, default: null },

    careerMomentumFactors: { type: [CareerFactorSchema], default: [] },
    careerMomentumMarketSignal: { type: String, default: null },
    careerMomentumPeerSignal: { type: String, default: null },
    careerMomentumWhatChanges: { type: String, default: null },

    skillRelevanceFactors: { type: [CareerFactorSchema], default: [] },
    skillRelevanceMarketSignal: { type: String, default: null },
    skillRelevancePeerSignal: { type: String, default: null },
    skillRelevanceWhatChanges: { type: String, default: null },

    opportunityWindowFactors: { type: [CareerFactorSchema], default: [] },
    opportunityWindowMarketSignal: { type: String, default: null },
    opportunityWindowPeerSignal: { type: String, default: null },
    opportunityWindowWhatChanges: { type: String, default: null },

    // Previous Scores (for change detection)
    previousAiExposureScore: { type: Number, default: null },
    previousCareerMomentumScore: { type: Number, default: null },
    previousSkillRelevanceScore: { type: Number, default: null },
    previousOpportunityWindowScore: { type: Number, default: null },

    // Validity States
    validityState: { type: String, enum: ['ACTIVE_CLOCK', 'ACTIVE_CASE', 'FROZEN'], default: 'FROZEN' },
    generationStatus: { type: String, enum: ['PENDING', 'AI_EXPOSURE', 'MARKET_VELOCITY', 'SKILL_HALFLIFE', 'OPPORTUNITY_WINDOW', 'COMPLETED'], default: 'PENDING' },
    pulseId: { type: String, default: null },
    clockValidUntil: { type: Date, default: null },
    effectiveValidUntil: { type: Date, default: null },
    daysLeft: { type: Number, default: 0 },

    insightText: { type: String, default: '' },
    lastCalculatedAt: { type: Date, default: Date.now },
    lastCalculatedBy: { type: String, enum: ['AUTO_OPEN', 'HAWK', 'CASE_RUN', 'PROFILE_CONFIRM'], default: 'AUTO_OPEN' },

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
    collection: 'user_clocks'
});

// UserClocksSchema.index({ userId: 1 }); // Removed redundant index (already unique: true in field definition)

module.exports = mongoose.model('UserClocks', UserClocksSchema);
