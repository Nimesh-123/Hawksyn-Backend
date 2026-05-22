const mongoose = require('mongoose');

const LedgerSchema = new mongoose.Schema({
    ledgerId: {
        type: String,
        required: true,
        unique: true
    },
    transactionType: {
        type: String,
        enum: ['REVENUE', 'REFUND', 'CHARGEBACK', 'ADJUSTMENT'],
        required: true
    },
    amount: { type: Number, required: true }, // Positive for Revenue, Negative for Refund
    currency: { type: String, default: 'INR' },
    
    paymentId: { type: String, required: true },
    invoiceId: { type: String, default: null },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    description: { type: String },
    
    // For Audit Tracking
    balanceAfter: { type: Number, default: 0 }, // Optional: Running balance of user account if applicable
    
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'finance_ledger'
});

LedgerSchema.index({ userId: 1 });
LedgerSchema.index({ paymentId: 1 });
LedgerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ledger', LedgerSchema);
