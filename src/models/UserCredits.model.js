const mongoose = require('mongoose');

const UserCreditsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    checksBalance: { type: Number, default: 0 },
    expertChatBalance: { type: Number, default: 0 },
    transactions: [
        {
            type: { type: String, enum: ['PURCHASE', 'HAWK_CONSUME', 'EXPERT_QUERY_PURCHASE', 'EXPERT_QUERY_CONSUME', 'BONUS', 'REFUND'], required: true },
            amount: { type: Number, required: true },
            balanceAfter: { type: Number, required: true },
            note: { type: String },
            createdAt: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true,
    collection: 'user_credits'
});

// UserCreditsSchema.index({ userId: 1 }); // Removed redundant index (already unique: true in field definition)

module.exports = mongoose.model('UserCredits', UserCreditsSchema);
