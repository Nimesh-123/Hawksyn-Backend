const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../../middleware/auth');

// All routes require JWT authentication
router.use(auth);


/**
 * @swagger
 * /payment/product:
 *   get:
 *     summary: Get product and price details for a case
 *     tags: [4. Payments & Run Setup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         example: CASE_AI_JOB_RISK
 *     responses:
 *       200:
 *         description: Product details
 *       400:
 *         description: caseId missing
 *       404:
 *         description: Case not found
 */
router.get('/product', paymentController.getProduct);

/**
 * @swagger
 * /payment/status:
 *   get:
 *     summary: Check payment and run status for a case/intent
 *     tags: [4. Payments & Run Setup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: intentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status details
 */
router.get('/status', paymentController.getPaymentStatus);

/**
 * @swagger
 * /payment/initiate:
 *   post:
 *     summary: Initiate a mock payment
 *     tags: [4. Payments & Run Setup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caseId
 *               - intentId
 *             properties:
 *               caseId:
 *                 type: string
 *               intentId:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [ios, android, test]
 *                 default: test
 *     responses:
 *       200:
 *         description: Payment initiated
 */
router.post('/initiate', paymentController.initiatePayment);

/**
 * @swagger
 * /payment/verify:
 *   post:
 *     summary: Verify mock payment and create a Run
 *     tags: [4. Payments & Run Setup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purchaseId
 *               - caseId
 *               - intentId
 *             properties:
 *               purchaseId:
 *                 type: string
 *               caseId:
 *                 type: string
 *               intentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified and run created
 *       403:
 *         description: Forbidden (wrong user)
 *       404:
 *         description: Payment not found
 */
router.post('/verify', paymentController.verifyPayment);

module.exports = router;
