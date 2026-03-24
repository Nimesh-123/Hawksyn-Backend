const express = require('express');
const router = express.Router();
const cc = require('../controllers/commandCenterController');
const auth = require('../../middleware/auth');


// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /command-center/{userId}/command-center:
 *   get:
 *     summary: Get user-specific command center data (clocks, insights, validity)
 *     tags: [8. Command Center & Trends]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Command center payload
 *       401:
 *         description: Unauthorized
 *     security:
 *       - bearerAuth: []
 */
router.get('/:userId/command-center', cc.getCommandCenter);

/**
 * @swagger
 * /command-center/{userId}/hawk:
 *   post:
 *     summary: Run Hawk recalibration (Manual refresh, consumes 1 credit if no active case)
 *     tags: [8. Command Center & Trends]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recalibration successful
 *     security:
 *       - bearerAuth: []
 */
router.post('/:userId/hawk', cc.runHawk);

/**
 * @swagger
 * /command-center/{userId}/clock-refresh-from-case:
 *   post:
 *     summary: (Internal) Refresh clocks when a case expert is assigned
 *     tags: [8. Command Center & Trends]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Clocks refreshed from case
 *     security:
 *       - bearerAuth: []
 */
router.post('/:userId/clock-refresh-from-case', cc.refreshClocksFromCase);

/**
 * @swagger
 * /command-center/{userId}/credits:
 *   get:
 *     summary: Get user's recalibration (Hawk) credit balance
 *     tags: [8. Command Center & Trends]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User credit balance and transactions
 *     security:
 *       - bearerAuth: []
 */
const { runTrendEngine } = require('../crons/trendEngine.cron.js');

/**
 * @swagger
 * /command-center/admin/run-trend-engine:
 *   get:
 *     summary: (Admin) Manually trigger the Trend Engine
 *     tags: [8. Command Center & Trends]
 *     responses:
 *       200:
 *         description: Trend engine triggered
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/run-trend-engine', async (req, res) => {
    try {
        await runTrendEngine();
        res.status(200).json({ success: true, message: 'Trend Engine run complete' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/:userId/credits', cc.getCredits);

module.exports = router;
