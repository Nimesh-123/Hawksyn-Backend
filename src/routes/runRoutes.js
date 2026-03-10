const express = require('express');
const router = express.Router();
const questionsController = require('../controllers/questionsController');
const cvController = require('../controllers/cvController');
const auth = require('../middleware/auth');
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

module.exports = router;
