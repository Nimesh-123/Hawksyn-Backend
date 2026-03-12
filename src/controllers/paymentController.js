const CaseRegistry = require('../models/CaseRegistry.model');
const CaseIntentConfig = require('../models/CaseIntentConfig.model');
const Playbooks = require('../models/Playbooks.model');
const Payments = require('../models/Payments.model');
const Runs = require('../models/Runs.model');
const crypto = require('crypto');

/**
 * Helper: Generate IDs in format TYPE_YYYYMMDD_XXXX
 */
const generateFormattedId = async (Model, prefix, fieldName) => {
    const now = new Date();
    // Use local components for consistency with the day-based sequence
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Find the current highest sequence for this specific prefix + date
    const regex = new RegExp(`^${prefix}_${dateStr}_`);
    const lastRecord = await Model.findOne({ [fieldName]: regex })
        .sort({ [fieldName]: -1 })
        .lean();

    let sequence = 1;
    if (lastRecord && lastRecord[fieldName]) {
        const parts = lastRecord[fieldName].split('_');
        if (parts.length >= 3) {
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
                sequence = lastSeq + 1;
            }
        }
    }

    const sequenceStr = sequence.toString().padStart(4, '0');
    return `${prefix}_${dateStr}_${sequenceStr}`;
};

/**
 * API 1 — GET /api/payment/product
 */
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

        return res.status(200).json({
            success: true,
            data: {
                caseId: caseData.caseId,
                caseName: caseData.caseName,
                productId: "ai_job_risk_report",
                price: caseData.minPrice,
                currency: caseData.defaultCurrency || "INR",
                isTestMode: true
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 2 — POST /api/payment/initiate
 */
exports.initiatePayment = async (req, res) => {
    try {
        const { caseId, intentId, platform = 'test' } = req.body;
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

        // Check for existing COMPLETED payment (Avoid double payment)
        const completedPayment = await Payments.findOne({ userId, caseId, intentId, status: 'COMPLETED' });
        if (completedPayment) {
            return res.status(200).json({
                success: true,
                data: {
                    paymentId: completedPayment.paymentId,
                    purchaseId: completedPayment.purchaseId,
                    status: "COMPLETED",
                    runId: completedPayment.runId,
                    isPaid: true,
                    message: "You have already completed the payment for this case and intent."
                }
            });
        }

        // Check for existing PENDING payment
        const existingPayment = await Payments.findOne({ userId, caseId, intentId, status: 'PENDING' });
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

        const newPayment = new Payments({
            paymentId,
            userId,
            caseId,
            intentId,
            platform,
            productId: 'ai_job_risk_report',
            purchaseId,
            amount: caseData.minPrice,
            currency: caseData.defaultCurrency || 'INR',
            status: 'PENDING',
            isTestPayment: true
        });

        await newPayment.save();

        return res.status(200).json({
            success: true,
            data: {
                paymentId,
                purchaseId,
                amount: newPayment.amount,
                currency: newPayment.currency,
                status: "PENDING",
                isTestMode: true,
                message: "Test payment initiated. Call /verify to complete."
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 3 — POST /api/payment/verify
 */
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
                    status: "IN_PROGRESS",
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

        // [LOGIC UPDATE] Check UserProfile confirmation
        const { UserProfile } = require('../models/index.model.js').db;
        const userProfile = await UserProfile.findOne({ userId, isConfirmed: true });
        if (!userProfile) {
            return res.status(400).json({
                success: false,
                message: "Please complete your profile setup before starting validation.",
                code: "PROFILE_NOT_CONFIRMED"
            });
        }

        // Check existing run

        let run = await Runs.findOne({ userId, caseId, intentId, status: 'IN_PROGRESS' });

        if (!run) {
            // Generate runId
            const runId = await generateFormattedId(Runs, 'RUN', 'runId');
            run = new Runs({
                runId,
                userId,
                caseId,
                intentId,
                playbookVersionId: config.playbookVersionId,
                status: 'IN_PROGRESS',
                cvSnapshot: {
                    cvUploadId: userProfile.lastCvUploadId,
                    cvUrl: userProfile.cvUrl,
                    parsedData: userProfile.confirmedProfile,
                    attachedAt: userProfile.confirmedAt || new Date(),
                    source: 'EXISTING'
                }
            });
            await run.save();
        }

        // Update payment
        payment.status = 'COMPLETED';
        payment.verifiedAt = new Date();
        payment.runId = run.runId;
        await payment.save();

        return res.status(200).json({
            success: true,
            data: {
                paymentId: payment.paymentId,
                runId: run.runId,
                caseId,
                intentId,
                playbookVersionId: config.playbookVersionId,
                status: "IN_PROGRESS",
                cvRequired: playbook.documentMandatory,
                message: "Payment verified. Run created successfully."
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 4 — GET /api/payment/status
 * Purpose: Check if user has already paid for a specific case/intent before showing payment UI.
 */
exports.getPaymentStatus = async (req, res) => {
    try {
        const { caseId, intentId } = req.query;
        const userId = req.user.id;

        if (!caseId || !intentId) {
            return res.status(400).json({ success: false, message: 'caseId and intentId are required' });
        }

        // 1. Check for completed payment
        const completedPayment = await Payments.findOne({ userId, caseId, intentId, status: 'COMPLETED' });

        // 2. Check for active run
        const activeRun = await Runs.findOne({ userId, caseId, intentId, status: 'IN_PROGRESS' });

        if (completedPayment || activeRun) {
            return res.status(200).json({
                success: true,
                data: {
                    isPaid: true,
                    hasActiveRun: !!activeRun,
                    runId: activeRun ? activeRun.runId : (completedPayment ? completedPayment.runId : null),
                    status: activeRun ? "RESUME_RUN" : "PAYMENT_DONE_RUN_NOT_STARTED"
                }
            });
        }

        // 3. Check for pending payment
        const pendingPayment = await Payments.findOne({ userId, caseId, intentId, status: 'PENDING' });

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
