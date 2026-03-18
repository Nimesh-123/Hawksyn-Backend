const mongoose = require('mongoose');

const PaymentsSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    runId: { type: String, default: null },
    caseId: { type: String, required: true },
    intentId: { type: String, required: true },
    platform: {
        type: String,
        enum: ['ios', 'android', 'test'],
        default: 'test'
    },
    productId: { type: String, required: true },
    purchaseId: {
        type: String,
        required: true,
        unique: true
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    },
    isTestPayment: { type: Boolean, default: true },
    paymentMethod: { type: String, default: 'test_gateway' },
    verifiedAt: { type: Date, default: null }
}, {
    timestamps: true,
    collection: 'payments'
});

// Indexes

PaymentsSchema.index({ userId: 1, status: 1 });
PaymentsSchema.index({ runId: 1 });

module.exports = mongoose.model('Payments', PaymentsSchema);
