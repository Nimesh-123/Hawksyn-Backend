const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const auth = require('../middleware/auth');

// All routes require JWT authentication
router.use(auth);

/**
 * @swagger
 * tags:
 *   name: Cases
 *   description: Case and Intent management APIs
 */

/**
 * @swagger
 * /cases:
 *   get:
 *     summary: Get all active cases
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active cases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       caseId:
 *                         type: string
 *                       caseName:
 *                         type: string
 *                       caseCategory:
 *                         type: string
 *                       caseDescription:
 *                         type: string
 *                       defaultCurrency:
 *                         type: string
 *                       minPrice:
 *                         type: number
 *                       maxPrice:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', caseController.getCases);

/**
 * @swagger
 * /cases/{caseId}/intents:
 *   get:
 *     summary: Get valid intents for a case
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         example: CASE_AI_JOB_RISK
 *     responses:
 *       200:
 *         description: List of valid intents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       intentId:
 *                         type: string
 *                       intentName:
 *                         type: string
 *                       intentHorizonDays:
 *                         type: number
 *                       intentType:
 *                         type: string
 *                       isDefault:
 *                         type: boolean
 *       404:
 *         description: No active intents found
 *       500:
 *         description: Server error
 */
router.get('/:caseId/intents', caseController.getCaseIntents);

/**
 * @swagger
 * /cases/{caseId}/intents/{intentId}/playbook:
 *   get:
 *     summary: Load active playbook for case + intent
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         example: CASE_AI_JOB_RISK
 *       - in: path
 *         name: intentId
 *         required: true
 *         schema:
 *           type: string
 *         example: INT_STAY_12M_SAFE
 *     responses:
 *       200:
 *         description: Active playbook details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     playbookVersionId:
 *                       type: string
 *                     playbookName:
 *                       type: string
 *                     cvMandatory:
 *                       type: boolean
 *                     allowedCvFormats:
 *                       type: string
 *                     adversarialMirrorEnabled:
 *                       type: boolean
 *                     allowedLlms:
 *                       type: array
 *                       items:
 *                         type: string
 *                     mandatoryCvFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                     layerGuardrails:
 *                       type: object
 *       404:
 *         description: Playbook not found
 *       500:
 *         description: Server error
 */
router.get('/:caseId/intents/:intentId/playbook', caseController.getPlaybook);

module.exports = router;
