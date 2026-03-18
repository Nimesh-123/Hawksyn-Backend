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

module.exports = mongoose.model('ExpertQuery', ExpertQuerySchema);
