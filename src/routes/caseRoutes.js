const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');



/**
 * @swagger
 * /cases:
 *   get:
 *     summary: Get all active cases with pagination and sorting
 *     tags: ["3. Discovery (Explore Cases)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [minPrice, maxPrice, caseName, createdAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated list of active cases
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
 *                     cases:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           caseId:
 *                             type: string
 *                           caseName:
 *                             type: string
 *                           caseCategory:
 *                             type: string
 *                           caseDescription:
 *                             type: string
 *                           defaultCurrency:
 *                             type: string
 *                           minPrice:
 *                             type: number
 *                           maxPrice:
 *                             type: number
 *                           logoSvg:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean

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
 *     summary: Get valid intents for a case with pagination
 *     tags: ["3. Discovery (Explore Cases)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         example: CASE_AI_JOB_RISK
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Paginated list of valid intents
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
 *                     intents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           intentId:
 *                             type: string
 *                           intentName:
 *                             type: string
 *                           intentHorizonDays:
 *                             type: number
 *                           intentType:
 *                             type: string
 *                           isDefault:
 *                             type: boolean
 *                           isAvailable:
 *                             type: boolean
 *                           availabilityLabel:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean

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
 *     tags: ["3. Discovery (Explore Cases)"]
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
 *                     documentMandatory:
 *                       type: boolean
 *                     allowedDocumentFormats:
 *                       type: string
 *                     adversarialMirrorEnabled:
 *                       type: boolean
 *                     allowedLlms:
 *                       type: string
 *                     mandatoryDocumentFields:
 *                       type: string
 *                     outputContracts:
 *                       type: string
 *                     layerGuardrails:
 *                       type: object
 *       404:
 *         description: Playbook not found
 *       500:
 *         description: Server error
 */
router.get('/:caseId/intents/:intentId/playbook', caseController.getPlaybook);

module.exports = router;
