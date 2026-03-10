const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cvController');
const auth = require('../middleware/auth');
const upload = require('../../middleware/multer.js');

// All routes require JWT authentication
// router.use(auth);


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
 *         example: RUN_20260306_0001
 *     responses:
 *       200:
 *         description: CV attached successfully
 *       400:
 *         description: Validation or logic error
 *       403:
 *         description: Unauthorized or Payment not found
 *       404:
 *         description: Run not found
 */
router.post('/:runId/cv/keep-existing', auth, cvController.keepExistingCv);

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
 *         example: RUN_20260306_0001
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
 *       400:
 *         description: Validation error
 *       403:
 *         description: Payment missing or unauthorized
 *       404:
 *         description: Run not found
 */
router.post('/:runId/cv/upload', auth, upload.single('cv'), cvController.uploadRunCv);


module.exports = router;
