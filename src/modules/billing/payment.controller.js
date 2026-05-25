const CaseRegistry = require('../cases/CaseRegistry.model.js');
const RESPONSE = require('../../../utils/response.js');

const CaseIntentConfig = require('../cases/CaseIntentConfig.model.js');
const Playbooks = require('../assurance/Playbooks.model');
const Payments = require('./Payments.model');
const Runs = require('../assurance/Runs.model');
const User = require('../user/user.model.js');
const { db } = require('../../models/index.model.js');
const crypto = require('crypto');
const { generateFormattedId } = require('../../../utils/idGenerator');
const financeService = require('./services/financeService');
const notificationService = require('../../services/notificationService');
const { createAuditLog } = require('../../../utils/auditLogger.js');

exports.getProduct = async (req, res) => {
    try {
        const { caseId } = req.query;
        if (!caseId) {
            return res.status(400).json({ success: false, message: 'caseId is required' });
        }

        const caseData = await CaseRegistry.findOne({ caseId, isActive: true });
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        const user = await User.findById(req.user.id);
        const isInternational = user?.countryCode !== 'IN';
        
        let displayPrice = caseData.minPrice;
        let currency = caseData.defaultCurrency || "INR";
        
        if (isInternational) {
            // Assume 1 USD = 80 INR or fixed $7.99 for international
            displayPrice = 7.99; 
            currency = 'USD';
        }

        return res.status(200).json({
            success: true,
            data: {
                caseId: caseData.caseId,
                caseName: caseData.caseName,
                productId: "ai_job_risk_report",
                price: displayPrice,
                currency: currency,
                gateway: isInternational ? 'STRIPE' : 'RAZORPAY',
                isTestMode: true
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.initiatePayment = async (req, res) => {
    try {
        const { caseId, intentId, platform = 'test', paymentMethod = 'test_gateway', previousRunId } = req.body;
        const userId = req.user.id;

        if (!caseId || !intentId) {
            return res.status(400).json({ success: false, message: 'caseId and intentId are required' });
        }

        const caseData = await CaseRegistry.findOne({ caseId, isActive: true });
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        const intentConfig = await CaseIntentConfig.findOne({ caseId, intentId, isActive: true });
        if (!intentConfig) {
            return res.status(400).json({ success: false, message: 'This intent is not available' });
        }

        // ── Check for existing PENDING payment ──
        // Only allow one active pending payment at a time to avoid spam
        const existingPayment = await Payments.findOne({ userId, caseId, intentId, status: 'PENDING' }).sort({ createdAt: -1 });
        if (existingPayment) {
            return res.status(200).json({
                success: true,
                data: {
                    paymentId: existingPayment.paymentId,
                    purchaseId: existingPayment.purchaseId,
                    amount: existingPayment.amount,
                    currency: existingPayment.currency,
                    status: existingPayment.status,
                    isTestMode: existingPayment.isTestPayment,
                    message: "Existing pending payment found."
                }
            });
        }

        // Generate IDs
        const paymentId = await generateFormattedId(Payments, 'PAY', 'paymentId');
        const purchaseId = `TEST_PURCHASE_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        // Detect region
        const user = await User.findById(req.user.id);
        const isInternational = user?.countryCode !== 'IN';
        let amount = isInternational ? 7.99 : caseData.minPrice;
        const currency = isInternational ? 'USD' : (caseData.defaultCurrency || 'INR');
        const gateway = isInternational ? 'STRIPE' : 'RAZORPAY';

        // Apply Re-run Price Override if applicable
        if (previousRunId) {
            const previousRun = await Runs.findOne({ runId: previousRunId });
            if (previousRun?.reRunSetup?.reRunPriceOverride) {
                amount = previousRun.reRunSetup.reRunPriceOverride;
            }
        }

        // ── Handle Chat Extension Product (7-Day Validity) ──
        if (req.body.productId === 'CHAT_EXTENSION') {
            const chatRunId = req.body.runId;
            if (!chatRunId) return res.status(400).json({ success: false, message: 'runId is required for chat extension' });
            
            const chatRun = await Runs.findOne({ runId: chatRunId });
            if (!chatRun) return res.status(404).json({ success: false, message: 'Run not found' });

            amount = isInternational ? 1.99 : 100; // Static price
            const chatPaymentId = await generateFormattedId(Payments, 'PAY', 'paymentId');
            const chatPurchaseId = `CHAT_EXT_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

            const chatPayment = new Payments({
                paymentId: chatPaymentId,
                userId,
                caseId: chatRun.caseId,
                intentId: chatRun.intentId,
                runId: chatRunId,
                productId: 'CHAT_EXTENSION',
                purchaseId: chatPurchaseId,
                amount: amount,
                currency: isInternational ? 'USD' : 'INR',
                status: 'PENDING',
                isTestPayment: true,
                paymentMethod: gateway
            });

            await chatPayment.save();
            return res.status(200).json({
                success: true,
                data: {
                    paymentId: chatPaymentId,
                    purchaseId: chatPurchaseId,
                    amount: amount,
                    currency: chatPayment.currency,
                    gateway: gateway,
                    message: "Chat extension payment initiated."
                }
            });
        }

        const newPayment = new Payments({
            paymentId,
            userId,
            caseId,
            intentId,
            platform,
            productId: 'ai_job_risk_report',
            purchaseId,
            amount: amount,
            currency: currency,
            status: 'PENDING',
            isTestPayment: true,
            paymentMethod: gateway,
            previousRunId: previousRunId || null
        });

        await newPayment.save();

        await createAuditLog(req, 'PAYMENT_INITIATED', userId, {
            paymentId,
            purchaseId,
            amount: newPayment.amount,
            currency: newPayment.currency,
            productId: newPayment.productId
        });

        return res.status(200).json({
            success: true,
            data: {
                paymentId,
                purchaseId,
                amount: newPayment.amount,
                currency: newPayment.currency,
                gateway: gateway,
                status: "PENDING",
                isTestMode: true,
                message: `Payment initiated via ${gateway}. Call /verify to complete.`
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { purchaseId, caseId, intentId } = req.body;
        const userId = req.user.id;

        if (!purchaseId || !caseId || !intentId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const payment = await Payments.findOne({ purchaseId, userId });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.caseId !== caseId) {
            return res.status(400).json({ success: false, message: 'Payment does not match this case' });
        }

        // Handle already completed
        if (payment.status === 'COMPLETED') {
            return res.status(200).json({
                success: true,
                data: {
                    paymentId: payment.paymentId,
                    runId: payment.runId,
                    status: "CREATED",
                    alreadyVerified: true,
                    message: "Payment already verified."
                }
            });
        }

        // Load Playbook
        const config = await CaseIntentConfig.findOne({ caseId, intentId, isActive: true });
        if (!config) {
            return res.status(400).json({ success: false, message: 'No active playbook for this case and intent' });
        }

        const playbook = await Playbooks.findOne({ playbookVersionId: config.playbookVersionId });
        if (!playbook) {
            return res.status(400).json({ success: false, message: 'Playbook not found' });
        }

        // Check UserProfile
        const { UserProfile } = require('../../models/index.model.js').db;
        const userProfile = await UserProfile.findOne({ userId }); 
        
        // --- NEW: Deterministic Idempotency Check (Task 1) ---
        const requestId = `REQ_${purchaseId}`;
        let run = await Runs.findOne({ requestId });

        if (!run) {
            // Check legacy weak match
            run = await Runs.findOne({ userId, caseId, intentId, status: 'CREATED', requestId: { $exists: false } }).sort({ createdAt: -1 });
        }

        if (!run) {
            // Generate runId
            const runId = await generateFormattedId(Runs, 'RUN', 'runId');
            run = new Runs({
                runId,
                requestId,
                userId,
                caseId,
                intentId,
                playbookVersionId: config.playbookVersionId,
                status: 'CREATED',
                cvSnapshot: {
                    cvUploadId: userProfile?.lastCvUploadId || null,
                    cvUrl: userProfile?.cvUrl || null,
                    parsedData: userProfile?.confirmedProfile || {},
                    attachedAt: userProfile?.confirmedAt || new Date(),
                    source: 'EXISTING'
                },
                previousRunId: payment.previousRunId || null,
                // B32: Re-run Policy managed by Admin (Default: Paid)
                reRunSetup: {
                    eligibleForFreeReRun: false,
                    freeReRunExpiryDate: null,
                    reRunPriceOverride: null
                }
            });
            await run.save();
        } else if (!run.requestId) {
            run.requestId = requestId;
            await run.save();
        }

        // Update payment
        payment.status = 'COMPLETED';
        payment.verifiedAt = new Date();
        
        // --- NEW: Chat Extension Logic ---
        if (payment.productId === 'CHAT_EXTENSION') {
            const runToExtend = await Runs.findOne({ runId: payment.runId });
            if (runToExtend) {
                const currentExpiry = runToExtend.chatExpiryDate || new Date();
                const newExpiry = new Date(currentExpiry.getTime() + 7 * 24 * 60 * 60 * 1000);
                runToExtend.chatExpiryDate = newExpiry;
                await runToExtend.save();
                
                return res.status(200).json({
                    success: true,
                    data: {
                        paymentId: payment.paymentId,
                        runId: runToExtend.runId,
                        newChatExpiryDate: newExpiry,
                        message: "Chat validity extended by 7 days."
                    }
                });
            }
        }

        payment.runId = run.runId;
        await payment.save();

        await createAuditLog(req, 'PAYMENT_VERIFIED', userId, {
            paymentId: payment.paymentId,
            runId: run.runId,
            amount: payment.amount,
            currency: payment.currency
        });

        // --- NEW: Finance & Audit Finalization (Sprint 8) ---
        try {
            const userRecord = await User.findById(userId);
            if (userRecord) {
                const finData = await financeService.processPaymentFinalization(payment, userRecord);
                if (finData.success) {
                    const invoice = await db.Invoice.findOne({ invoiceId: finData.invoiceId });
                    await notificationService.notifyPaymentSuccess(payment, userRecord, invoice);
                }
            }
        } catch (finErr) {
            console.error('[Payment-Verify] Post-processing Finance Error:', finErr);
        }

        return res.status(200).json({
            success: true,
            data: {
                paymentId: payment.paymentId,
                runId: run.runId,
                caseId,
                intentId,
                playbookVersionId: config.playbookVersionId,
                status: "CREATED",
                cvRequired: playbook.documentMandatory,
                message: "Payment verified. Run created successfully."
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPaymentStatus = async (req, res) => {
    try {
        const { caseId, intentId } = req.query;
        const userId = req.user.id;

        if (!caseId || !intentId) {
            return res.status(400).json({ success: false, message: 'caseId and intentId are required' });
        }

        // Find the LATEST completed payment to determine if current session is active
        const completedPayment = await Payments.findOne({ userId, caseId, intentId, status: 'COMPLETED' }).sort({ createdAt: -1 });

        let activeRun = null;
        if (completedPayment && completedPayment.runId) {
            activeRun = await Runs.findOne({ runId: completedPayment.runId });
        } else {
            // Fallback: Find the latest run if payment logic is bypassed or handled elsewhere
            activeRun = await Runs.findOne({ userId, caseId, intentId }).sort({ createdAt: -1 });
        }

        const reRunSetup = activeRun?.reRunSetup;
        const isEligibleForFree = reRunSetup?.eligibleForFreeReRun === true && 
                                 (!reRunSetup?.freeReRunExpiryDate || new Date() <= new Date(reRunSetup.freeReRunExpiryDate));

        // A run is considered "Finished" if it reached report stage
        const isRunFinished = activeRun && ['REPORT_COMPLETE', 'EXPERT_ASSIGNED'].includes(activeRun.status);

        // --- CORE FIX: If the latest run is finished, we MUST allow a new payment (Re-run) ---
        if (isRunFinished) {
            return res.status(200).json({
                success: true,
                data: {
                    isPaid: isEligibleForFree, 
                    canReRun: true,
                    isFreeReRun: isEligibleForFree,
                    previousRunId: activeRun.runId,
                    status: "CAN_RE_RUN",
                    message: isEligibleForFree 
                        ? "You are eligible for a free re-run!" 
                        : "You have a completed report for this case. You can start a new re-run."
                }
            });
        }

        // If a payment exists but the run is NOT finished, we resume the session
        if (completedPayment && activeRun && !isRunFinished) {
            return res.status(200).json({
                success: true,
                data: {
                    isPaid: true,
                    hasActiveRun: true,
                    runId: activeRun.runId,
                    status: "RESUME_RUN",
                    runStatus: activeRun.status,
                    message: "Resume your current run."
                }
            });
        }

        // Check for payments that haven't been linked to a run yet
        const unlinkedPayment = await Payments.findOne({ userId, caseId, intentId, status: 'COMPLETED', runId: { $exists: false } }).sort({ createdAt: -1 });
        if (unlinkedPayment) {
             return res.status(200).json({
                success: true,
                data: {
                    isPaid: true,
                    hasActiveRun: false,
                    paymentId: unlinkedPayment.paymentId,
                    status: "PAYMENT_DONE_RUN_NOT_STARTED",
                    message: "Payment complete. Start your run."
                }
            });
        }

        const pendingPayment = await Payments.findOne({ userId, caseId, intentId, status: 'PENDING' }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                isPaid: false,
                hasActiveRun: false,
                hasPending: !!pendingPayment,
                paymentId: pendingPayment ? pendingPayment.paymentId : null,
                status: pendingPayment ? "PAYMENT_PENDING" : "NOT_PAID"
            }
        });


    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPaymentDetail = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user.id;

        const payment = await Payments.findOne({ paymentId, userId });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        const caseData = await CaseRegistry.findOne({ caseId: payment.caseId });
        const intentData = await require('../../models/IntentTaxonomy.model').findOne({ intentId: payment.intentId });

        return res.status(200).json({
            success: true,
            data: {
                paymentId: payment.paymentId,
                purchaseId: payment.purchaseId,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                productId: payment.productId,
                platform: payment.platform,
                paymentMethod: payment.paymentMethod || 'N/A',
                caseId: payment.caseId,
                caseName: caseData ? caseData.caseName : "N/A",
                intentId: payment.intentId,
                intentName: intentData ? intentData.intentName : "N/A",
                runId: payment.runId,
                paidAt: payment.verifiedAt || payment.updatedAt,
                isTestPayment: payment.isTestPayment
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        const query = { userId };
        if (status) query.status = status;

        const payments = await Payments.find(query).sort({ createdAt: -1 });

        const enrichedList = await Promise.all(payments.map(async (p) => {
            const caseData = await CaseRegistry.findOne({ caseId: p.caseId });
            const intentData = await require('../assurance/IntentTaxonomy.model').findOne({ intentId: p.intentId });

            return {
                paymentId: p.paymentId,
                purchaseId: p.purchaseId,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                productId: p.productId,
                platform: p.platform,
                paymentMethod: p.paymentMethod || 'N/A',
                caseId: p.caseId,
                caseName: caseData ? caseData.caseName : "N/A",
                intentId: p.intentId,
                intentName: intentData ? intentData.intentName : "N/A",
                runId: p.runId,
                paidAt: p.verifiedAt || p.updatedAt,
                isTestPayment: p.isTestPayment,
                createdAt: p.createdAt
            };
        }));

        return res.status(200).json({
            success: true,
            count: enrichedList.length,
            data: enrichedList
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.verifyAndRecover = async (req, res) => {
    try {
        const { purchaseId, paymentId } = req.body;
        const userId = req.user.id;

        const query = { userId };
        if (purchaseId) query.purchaseId = purchaseId;
        else if (paymentId) query.paymentId = paymentId;
        else return res.status(400).json({ success: false, message: 'purchaseId or paymentId is required' });

        const payment = await Payments.findOne(query);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });

        const now = new Date();
        const created = new Date(payment.createdAt);
        const diffMinutes = (now - created) / (1000 * 60);

        if (diffMinutes < 10 && payment.status === 'PENDING') {
            return res.status(429).json({
                success: false,
                message: 'Recovery is too early. Please wait at least 10 minutes for bank sync.',
                coolingRemainingMinutes: Math.ceil(10 - diffMinutes)
            });
        }

        if (payment.status === 'COMPLETED') {
            return res.status(200).json({
                success: true,
                status: 'RECOVERED_ALREADY',
                runId: payment.runId,
                message: 'Payment was already recovered/verified.'
            });
        }

        const isDebitConfirmed = true; 

        if (isDebitConfirmed) {
            req.body.purchaseId = payment.purchaseId;
            req.body.caseId = payment.caseId;
            req.body.intentId = payment.intentId;
            
            return await exports.verifyPayment(req, res);
        }

        return res.status(400).json({
            success: false,
            message: 'No successful debit found at the gateway for this ID.'
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const s3Service = require('../../../utils/s3');

exports.downloadUserInvoice = async (req, res) => {
    try {
        const { runId } = req.params;
        const userId = req.user.id;

        const invoice = await db.Invoice.findOne({ runId, userId });
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice record not found.' });
        }

        if (!invoice.pdfUrl) {
            const userRecord = await db.User.findById(userId);
            const regenResult = await financeService.generateAndUploadInvoicePdf(invoice, userRecord);
            
            if (!regenResult.success) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Invoice PDF is not ready yet.',
                    error: regenResult.error 
                });
            }
            invoice.pdfUrl = regenResult.pdfUrl;
        }

        const key = 'invoices/' + invoice.invoiceNumber + '.pdf';
        const { Body, ContentType } = await s3Service.getFileStream(key);
        
        res.setHeader('Content-Type', ContentType || 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=' + invoice.invoiceNumber + '.pdf');
        
        return Body.pipe(res);

    } catch (err) {
        console.error('[User Invoice Error]', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.adminGetAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const payments = await db.Payments.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        const total = await db.Payments.countDocuments(filter);

        return RESPONSE.success(res, 200, 1001, {
            payments,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.adminExportPaymentsCSV = async (req, res) => {
    try {
        const payments = await db.Payments.find({}).sort({ createdAt: -1 }).lean();

        // CSV Headers - Updated to be more clear
        let csv = 'Date,PaymentId,PurchaseId/GatewayID,Amount,Currency,Status,Gateway,CaseId,UserId\n';

        payments.forEach(p => {
            const rawDate = p.verifiedAt || p.createdAt || null;
            const date = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : 'N/A';
            const gateway = p.paymentMethod || 'Stripe';
            csv += `${date},${p.paymentId},${p.purchaseId || 'N/A'},${p.amount},${p.currency || 'INR'},${p.status},${gateway},${p.caseId},${p.userId}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=Hawksyn_Transactions.csv');

        return res.status(200).send(csv);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

module.exports = exports;
