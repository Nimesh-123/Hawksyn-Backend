const mongoose = require('mongoose');

const ExpertQuerySchema = new mongoose.Schema({
    queryId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    runId: { type: String, required: true },
    expertId: { type: String, required: true },
    
    queryType: { type: String, enum: ['RISK_DEEP_DIVE', 'REMEDIATION_STRATEGY', 'MARKET_CLARITY', 'CUSTOM'], default: 'CUSTOM' },
    queryText: { type: String, required: true },
    
    status: { type: String, enum: ['PENDING', 'ANSWERED', 'REJECTED'], default: 'PENDING' },
    answerText: { type: String },
    
    creditCost: { type: Number, default: 2 },
    paymentStatus: { type: String, enum: ['PAID', 'PENDING'], default: 'PAID' },
    
    answeredAt: { type: Date },
    answeredBy: { type: String } // AuditorId
}, {
    timestamps: true,
    collection: 'expert_queries'
});

// Indexes
ExpertQuerySchema.index({ userId: 1, status: 1 });
ExpertQuerySchema.index({ runId: 1 });
ExpertQuerySchema.index({ expertId: 1, status: 1 });
ExpertQuerySchema.index({ createdAt: -1 });

module.exports = mongoose.model('ExpertQuery', ExpertQuerySchema);
