const express = require('express');
const router = express.Router();
const questionsController = require('../controllers/questionsController');
const cvController = require('../controllers/cvController');
const integrityController = require('../controllers/integrityController');
const reportController = require('../controllers/reportController');
const expertController = require('../controllers/expertController');
const signalsController = require('../controllers/signalsController');
const caseFileController = require('../controllers/caseFileController');
const caseController = require('../controllers/caseController');
const upload = require('../../middleware/multer.js');


/**
 * @swagger
 * /runs/pipeline/summary:
 *   get:
 *     summary: (Admin Only) Fetch Kanban-style summary of all runs grouped by staging
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pipeline summary grouped by logical stages
 */
router.get('/pipeline/summary', caseController.getPipelineSummary);
/**
 * @swagger
 * /runs/{runId}/snapshot:
 *   get:
 *     summary: (Admin Only) Fetch a comprehensive snapshot of a specific run and its artifacts
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *     responses:
 *       200:
 *         description: Consolidated run details and artifact manifest returned
 */
router.get('/:runId/snapshot', caseController.getRunSnapshot);

/**
 * @swagger
 * /runs/{runId}/revert:
 *   post:
 *     summary: (Admin Only) Revert a specific run to a previous status (Safety Switch)
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetStatus]
 *             properties:
 *               targetStatus:
 *                 type: string
 *                 enum: [PROFILE_CONFIRMED, QUESTIONS_CONFIRMED, SIGNALS_COLLECTED]
 *     responses:
 *       200:
 *         description: Run reverted and associated future data cleaned up
 */
router.post('/:runId/revert', caseController.revertRunStatus);


/**
 * --- CV Related Routes ---
 */

/**
 * @swagger
 * /runs/{runId}/cv/keep-existing:
 *   post:
 *     summary: Continue with existing CV for a specific run
 *     tags: ["4. Payments & Run Initiation"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *         example: RUN_20260310_0001
 *     responses:
 *       200:
 *         description: CV attached successfully
 *       404:
 *         description: Run not found
 */
router.post('/:runId/cv/keep-existing', cvController.keepExistingCv);

/**
 * @swagger
 * /runs/{runId}/cv/upload:
 *   post:
 *     summary: Upload and Parse new CV for a specific run
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *         example: RUN_20260310_0001
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: CV uploaded, parsed and attached to run
 */
router.post('/:runId/cv/upload', upload.single('cv'), cvController.uploadRunCv);

/**
 * --- Questions AI Flow (Under /runs/:runId/questions) ---
 */

/**
 * @swagger
 * /runs/{runId}/questions/next:
 *   get:
 *     summary: Return next batch of unanswered questions for this run
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *         example: RUN_20260310_0001
 *     responses:
 *       200:
 *         description: Next batch of questions
 */
router.get('/:runId/questions/next', questionsController.getNextQuestions);

/**
 * @swagger
 * /runs/{runId}/questions/answers:
 *   post:
 *     summary: Save and confirm batch of answers into RAS
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [batchNumber, answers]
 *             properties:
 *               batchNumber:
 *                 type: number
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answerValue:
 *                       type: string
 *                     answerLabel:
 *                       type: string
 *     responses:
 *       200:
 *         description: Answers saved successfully
 */
router.post('/:runId/questions/answers', questionsController.saveAnswers);

/**
 * @swagger
 * /runs/{runId}/questions/status:
 *   get:
 *     summary: Return overall progress of questions for this run
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current progress status
 */
router.get('/:runId/questions/status', questionsController.getQuestionsStatus);


/**
 * --- Step 4: Integrity Engine ---
 */

/**
 * @swagger
 * /runs/{runId}/integrity/run:
 *   post:
 *     summary: Run the full integrity engine for this run
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Integrity audit completed successfully
 */
router.post('/:runId/integrity/run', integrityController.runIntegrityEngine);

/**
 * @swagger
 * /runs/{runId}/signals/collect:
 *   post:
 *     summary: Collect external market signals for this run
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: External signals collected successfully
 */
router.post('/:runId/signals/collect', signalsController.collectSignals);

/**
 * @swagger
 * /runs/{runId}/case-file/build:
 *   post:
 *     summary: Build an immutable Case File combining all parsed data, objective inputs, and signals
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Case File built and locked successfully
 */
router.post('/:runId/case-file/build', caseFileController.buildCaseFile);

/**
 * @swagger
 * /runs/{runId}/case-file:
 *   get:
 *     summary: Retrieve the locked Case File for this run 
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A fully built Case File object returned
 */
router.get('/:runId/case-file', caseFileController.getCaseFile);

/**
 * --- Step 5: Report Generation ---
 */

/**
 * @swagger
 * /runs/{runId}/report/generate:
 *   post:
 *     summary: Generate the final comprehensive report for this run
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report generated successfully
 */
router.post('/:runId/report/generate', reportController.generateReport);
router.post('/:runId/report/section/refresh', reportController.refreshReportSection);

/**
 * @swagger
 * /runs/{runId}/report/download:
 *   get:
 *     summary: Download the AI report in PDF format
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file returned
 */
router.get('/:runId/report/download', reportController.downloadReport);

/**
 * @swagger
 * /runs/{runId}/report/email:
 *   post:
 *     summary: Send the AI report PDF to the user's registered email
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 */
router.post('/:runId/report/email', reportController.sendReportEmail);

/**
 * --- Step 6: Expert Assignment ---
 */

/**
 * @swagger
 * /runs/{runId}/expert/assign:
 *   post:
 *     summary: Assign a specialized expert to this run for review
 *     tags: ["5. Run Operations (AI Flow)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Expert assigned successfully
 */
router.post('/:runId/expert/assign', expertController.assignExpert);


/**
 * @swagger
 * /runs/experts/price:
 *   get:
 *     summary: Fetch price for N expert queries (Slide 54)
 *     tags: ["7. Expert Support & Chat"]
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *         example: 2
 *     responses:
 *       200:
 *         description: Price fetched
 */
router.get('/experts/price', expertController.getExpertQueryPrice);

/**
 * @swagger
 * /runs/experts/ask:
 *   post:
 *     summary: Ask a specific query to the assigned expert (Consumes 2 Hawk Checks)
 *     tags: ["7. Expert Support & Chat"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [runId, queryText]
 *             properties:
 *               runId:
 *                 type: string
 *               queryText:
 *                 type: string
 *               queryType:
 *                 type: string
 *                 enum: [RISK_DEEP_DIVE, REMEDIATION_STRATEGY, MARKET_CLARITY, CUSTOM]
 *     responses:
 *       200:
 *         description: Query sent. Credits deducted.
 *       402:
 *         description: Insufficient credits
 */
router.post('/experts/ask', expertController.askExpertQuery);

/**
 * @swagger
 * /runs/experts/queries/{runId}:
 *   get:
 *     summary: Get all expert queries for a specific run
 *     tags: ["7. Expert Support & Chat"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/experts/queries/:runId', expertController.getExpertQueries);

/**
 * @swagger
 * /runs/{runId}/chat/attempts:
 *   get:
 *     summary: Get chat attempts and credit balance for expert support (Slide 52)
 *     tags: ["7. Expert Support & Chat"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *     responses:
 *       200:
 *         description: Attempt details
 */
router.get('/:runId/chat/attempts', expertController.getChatAttempts);

module.exports = router;
