const mongoose = require('mongoose');

const UserClocksSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },

    // Scores (Flat structure as used in controllers)
    aiExposureScore: { type: Number, default: 0 },
    careerMomentumScore: { type: Number, default: 0 },
    skillRelevanceScore: { type: Number, default: 0 },
    opportunityWindowScore: { type: Number, default: 0 },

    careerMomentumMonths: { type: Number, default: 0 },
    opportunityWindowYears: { type: Number, default: 0 },

    // Justifications & Trends (Gemini derived)
    aiExposureJustification: { type: String, default: null },
    careerMomentumJustification: { type: String, default: null },
    skillRelevanceJustification: { type: String, default: null },
    opportunityWindowJustification: { type: String, default: null },
    trendTrigger: { type: String, default: null },

    // Previous Scores (for change detection)
    previousAiExposureScore: { type: Number, default: null },
    previousCareerMomentumScore: { type: Number, default: null },
    previousSkillRelevanceScore: { type: Number, default: null },
    previousOpportunityWindowScore: { type: Number, default: null },

    // Validity States
    validityState: {
        type: String,
        enum: ['FROZEN', 'ACTIVE_CLOCK', 'ACTIVE_CASE'],
        default: 'FROZEN'
    },
    caseValidUntil: { type: Date, default: null },
    clockValidUntil: { type: Date, default: null },
    effectiveValidUntil: { type: Date, default: null },
    daysLeft: { type: Number, default: 0 },

    insightText: { type: String, default: '' },
    pulseId: { type: String, default: null },
    lastCalculatedAt: { type: Date, default: Date.now },
    lastCalculatedBy: { type: String, enum: ['AUTO_OPEN', 'HAWK', 'CASE_RUN'], default: 'AUTO_OPEN' },

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
