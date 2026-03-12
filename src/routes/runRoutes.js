const express = require('express');
const router = express.Router();
const questionsController = require('../controllers/questionsController');
const cvController = require('../controllers/cvController');
const integrityController = require('../controllers/integrityController');
const reportController = require('../controllers/reportController');
const expertController = require('../controllers/expertController');
const auth = require('../../middleware/auth');
const upload = require('../../middleware/multer.js');

// All routes require JWT authentication
router.use(auth);

/**
 * --- CV Related Routes ---
 */

/**
 * @swagger
 * /runs/{runId}/cv/keep-existing:
 *   post:
 *     summary: Continue with existing CV for a specific run
 *     tags: [4. Payments & Run Setup]
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
 *     tags: [5. Run Operations (Specific Actions)]
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
 *     tags: [5. Run Operations (Specific Actions)]
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
 *     tags: [5. Run Operations (Specific Actions)]
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
 *     tags: [5. Run Operations (Specific Actions)]
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
 *     tags: [5. Run Operations (Specific Actions)]
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
 * --- Step 5: Report Generation ---
 */

/**
 * @swagger
 * /runs/{runId}/report/generate:
 *   post:
 *     summary: Generate the final comprehensive report for this run
 *     tags: [5. Run Operations (Specific Actions)]
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

/**
 * --- Step 6: Expert Assignment ---
 */

/**
 * @swagger
 * /runs/{runId}/expert/assign:
 *   post:
 *     summary: Assign a specialized expert to this run for review
 *     tags: [5. Run Operations (Specific Actions)]
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

module.exports = router;
