const CaseRegistry = require('../models/CaseRegistry.model');
const CaseIntentConfig = require('../models/CaseIntentConfig.model');
const Playbooks = require('../models/Playbooks.model');
const Payments = require('../models/Payments.model');
const Runs = require('../models/Runs.model');
const User = require('../models/user.model');
const crypto = require('crypto');
const { generateFormattedId } = require('../../utils/idGenerator');

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

/**
 * API 2 — POST /api/payment/initiate
 */
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

        // [RELAXED CHECK] Check UserProfile — Allow the flow to continue even for unconfirmed profiles for testing
        const { UserProfile } = require('../models/index.model.js').db;
        const userProfile = await UserProfile.findOne({ userId }); 
        
        if (!userProfile) {
             console.warn(`[Payment] No profile found for ${userId}. Run will be created but cvSnapshot may be empty.`);
        }

        // --- NEW: Deterministic Idempotency Check (Task 1) ---
        // We use purchaseId as a natural requestId for the run
        const requestId = `REQ_${purchaseId}`;
        let run = await Runs.findOne({ requestId });

        if (!run) {
            // Check legacy weak match (same intent, just created, no requestId yet)
            run = await Runs.findOne({ userId, caseId, intentId, status: 'CREATED', requestId: { $exists: false } });
        }

        if (!run) {
            // Generate runId
            const runId = await generateFormattedId(Runs, 'RUN', 'runId');
            run = new Runs({
                runId,
                requestId, // Enforce uniqueness
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
                reRunSetup: {
                    eligibleForFreeReRun: false, 
                    freeReRunExpiryDate: null,
                    reRunPriceOverride: null
                }
            });
            await run.save();
        } else if (!run.requestId) {
            // Self-correction for legacy runs
            run.requestId = requestId;
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
                status: "CREATED",
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

        // 2. Check for ANY run (active or completed) for this case/intent
        let activeRun = null;
        if (completedPayment && completedPayment.runId) {
            activeRun = await Runs.findOne({ runId: completedPayment.runId });
        } else {
            activeRun = await Runs.findOne({ userId, caseId, intentId }).sort({ createdAt: -1 });
        }

        // --- RE-RUN LOGIC ---
        // If the latest run is already complete, we should NOT force a resume.
        // Instead, we allow the user to start a new "Re-run" flow.
        const isRunFinished = activeRun && ['REPORT_COMPLETE', 'EXPERT_ASSIGNED'].includes(activeRun.status);

        if ((completedPayment || activeRun) && !isRunFinished) {
            return res.status(200).json({
                success: true,
                data: {
                    isPaid: true,
                    hasActiveRun: !!activeRun,
                    runId: activeRun ? activeRun.runId : (completedPayment ? completedPayment.runId : null),
                    status: activeRun ? "RESUME_RUN" : "PAYMENT_DONE_RUN_NOT_STARTED",
                    runStatus: activeRun ? activeRun.status : null,
                    message: activeRun && ['QUESTIONS_CONFIRMED', 'SIGNALS_COLLECTED', 'INTEGRITY_COMPLETE'].includes(activeRun.status)
                        ? "Questions already answered. Proceed to analysis."
                        : activeRun ? "Resume your current run." : "Payment complete. Start your run."
                }
            });
        }

        // If a run is finished, we tell the frontend that a Re-run is possible
        if (isRunFinished) {
            return res.status(200).json({
                success: true,
                data: {
                    isPaid: true, // TEMPORARY BYPASS: Set to true so frontend shows Start button
                    canReRun: true,
                    previousRunId: activeRun.runId,
                    status: "CAN_RE_RUN",
                    message: "You have a completed report for this case. You can start a re-run."
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
/**
 * API 5 — GET /api/payment/detail/:paymentId
 * Purpose: Get full receipt details for a specific payment
 */
exports.getPaymentDetail = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user.id;

        const payment = await Payments.findOne({ paymentId, userId });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        // Fetch Case and Intent names for the receipt
        const caseData = await CaseRegistry.findOne({ caseId: payment.caseId });
        const intentData = await require('../models/IntentTaxonomy.model').findOne({ intentId: payment.intentId });

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

/**
 * API 6 — GET /api/payment/list
 * Purpose: Get list of all payments for the authenticated user
 */
exports.getAllPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        const query = { userId };
        if (status) query.status = status;

        const payments = await Payments.find(query).sort({ createdAt: -1 });

        // Map payments to include full details for each record in the list
        const enrichedList = await Promise.all(payments.map(async (p) => {
            const caseData = await CaseRegistry.findOne({ caseId: p.caseId });
            const intentData = await require('../models/IntentTaxonomy.model').findOne({ intentId: p.intentId });

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


