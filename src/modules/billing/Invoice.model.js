const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    invoiceId: {
        type: String,
        required: true,
        unique: true
    },
    invoiceNumber: {
        type: String, // e.g., HS-2026-0001
        required: true,
        unique: true
    },
    paymentId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    runId: { type: String, default: null },
    
    // Financial Details
    baseAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    
    taxDetails: {
        type: Object, // e.g., { type: 'GST', rate: 18, cgst: 9, sgst: 9 }
        default: {}
    },
    
    billingAddress: {
        name: String,
        addressLine1: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        gstin: String
    },
    
    status: {
        type: String,
        enum: ['ISSUED', 'CANCELLED', 'PAID'],
        default: 'ISSUED'
    },
    
    pdfUrl: { type: String, default: null }, // S3 Link
    issuedAt: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'invoices'
});

InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ userId: 1 });
InvoiceSchema.index({ paymentId: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
