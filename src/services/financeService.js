const { db } = require('../models/index.model');
const { generateFormattedId } = require('../../utils/idGenerator');
const s3Service = require('../../utils/s3');
const { generatePdfFromHtml } = require('./pdfService');
const { buildInvoiceHtml } = require('../templates/invoiceTemplate');

/**
 * Finance Configuration
 */
const TAX_CONFIG = {
    INDIA_GST_RATE: 18, // Change this to update the tax rate globally
    IS_INCLUSIVE: true  // Set to true if product price already includes tax
};

/**
 * Finance Service — Handles Invoicing and Ledgering
 */
const financeService = {
    /**
     * Complete the financial post-processing after a payment is verified
     * @param {Object} payment - The payment object from DB
     * @param {Object} user - User details for billing
     */
    processPaymentFinalization: async (payment, user) => {
        try {
            // 1. Calculate Tax Breakdown (Standard 18% GST for India, 0% for Int.)
            const isIndia = user.countryCode === 'IN';
            const totalAmount = payment.amount;
            let baseAmount, taxAmount, taxDetails;

            if (isIndia) {
                // Inline GST calculation
                const rateFactor = 1 + (TAX_CONFIG.INDIA_GST_RATE / 100);
                baseAmount = Math.round((totalAmount / rateFactor) * 100) / 100;
                taxAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
                taxDetails = {
                    type: 'GST',
                    rate: TAX_CONFIG.INDIA_GST_RATE,
                    cgst: taxAmount / 2,
                    sgst: taxAmount / 2
                };
            } else {
                baseAmount = totalAmount;
                taxAmount = 0;
                taxDetails = { type: 'ZERO_TAX', rate: 0 };
            }

            // 2. Generate Unique Invoice Number (e.g., HS-2026-0001)
            const year = new Date().getFullYear();
            const count = await db.Invoice.countDocuments({ issuedAt: { $gte: new Date(`${year}-01-01`) } });
            const invoiceSuffix = String(count + 1).padStart(4, '0');
            const invoiceNumber = `HS-${year}-${invoiceSuffix}`;

            // 3. Create Invoice Record
            const invoiceId = await generateFormattedId(db.Invoice, 'INV', 'invoiceId');
            const invoice = await db.Invoice.create({
                invoiceId,
                invoiceNumber,
                paymentId: payment.paymentId,
                userId: user._id,
                runId: payment.runId,
                baseAmount,
                taxAmount,
                totalAmount,
                currency: payment.currency,
                taxDetails,
                billingAddress: {
                    name: user.name,
                    country: user.countryCode || 'IN',
                    // Note: City/State should ideally come from userProfile, but we use defaults for now
                },
                status: 'PAID'
            });

            // 4. Create Ledger Entry
            const ledgerId = await generateFormattedId(db.Ledger, 'LDG', 'ledgerId');
            await db.Ledger.create({
                ledgerId,
                transactionType: 'REVENUE',
                amount: totalAmount,
                currency: payment.currency,
                paymentId: payment.paymentId,
                invoiceId: invoice.invoiceId,
                userId: user._id,
                description: `Revenue for Case Run: ${payment.runId || 'N/A'}`,
                metadata: {
                    gateway: payment.paymentMethod,
                    taxType: taxDetails.type
                }
            });

            // 5. Generate and Upload PDF Invoice (Sprint 8)
            await financeService.generateAndUploadInvoicePdf(invoice, user);

            return { success: true, invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber };

        } catch (error) {
            console.error('[FinanceService] Error:', error);
            throw error;
        }
    },

    /**
     * Generate and Upload PDF Invoice to S3
     */
    generateAndUploadInvoicePdf: async (invoice, user) => {
        try {
            const html = buildInvoiceHtml({ invoice, user });
            const pdfBuffer = await generatePdfFromHtml(html);
            const s3Result = await s3Service.uploadFile(
                pdfBuffer, 
                `invoices/${invoice.invoiceNumber}.pdf`, 
                'application/pdf'
            );

            if (s3Result.success) {
                await db.Invoice.updateOne({ invoiceId: invoice.invoiceId }, { $set: { pdfUrl: s3Result.url } });
                return { success: true, pdfUrl: s3Result.url };
            }
            return { success: false, message: 'S3 upload failed' };
        } catch (pdfErr) {
            console.error('[FinanceService-PDF] PDF/S3 Flow Failed:', pdfErr.message);
            return { success: false, error: pdfErr.message };
        }
    }
};

module.exports = financeService;
