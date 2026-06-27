const express = require('express');
const router = express.Router();
const hipController = require('./hip.controller');

/**
 * @swagger
 * tags:
 *   name: HIP Profiles
 *   description: Hawksyn Intelligence Profile endpoints
 */

/**
 * @swagger
 * /hip/public/profile/{slug}:
 *   get:
 *     summary: Get Public HIP Profile
 *     description: Returns the raw HTML template of the generated HIP Profile injected with data.
 *     tags: [HIP Profiles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique slug of the generated profile (e.g., alex-mercer-1234)
 *     responses:
 *       200:
 *         description: Successfully returned the HTML profile
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server Error
 */
// GET: Serve the public HIP HTML Profile
router.get('/public/profile/:slug', hipController.getPublicProfile);

/**
 * @swagger
 * /hip/trigger:
 *   post:
 *     summary: Trigger HIP Generation
 *     description: Triggers the generation of the HIP Profile for a specific user. This makes 25 LLM calls and may take 30-60 seconds.
 *     tags: [HIP Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the User (candidate_id in PSDEResult) to generate the profile for.
 *                 example: 6a2ab160af418202adb4fbbc
 *     responses:
 *       200:
 *         description: Generation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 profileSlug:
 *                   type: string
 *       401:
 *         description: Unauthorized, missing token or user info
 *       500:
 *         description: Generation Error
 */
// POST: Trigger manual generation of a profile (internal/admin)
router.post('/trigger', hipController.triggerGeneration);

/**
 * @swagger
 * /hip/status:
 *   get:
 *     summary: Get HIP Generation Status
 *     description: Polling endpoint to get the status of the HIP generation.
 *     tags: [HIP Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully returned the status
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
// GET: Polling endpoint to check HIP generation status
router.get('/status', hipController.getHipStatus);


/**
 * @swagger
 * /hip/toggle-status:
 *   post:
 *     summary: Toggle HIP Status
 *     description: Toggles the profile status between Live (PUBLISHED) and Paused (DRAFT).
 *     tags: [HIP Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully toggled status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server Error
 */
router.post('/toggle-status', hipController.toggleHipStatus);


/**
 * @swagger
 * /hip/download-pdf:
 *   get:
 *     summary: Download HIP as PDF
 *     description: Generates a PDF of the user's HIP profile using Puppeteer and returns it as a downloadable file.
 *     tags: [HIP Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully downloaded PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server Error
 */
router.get('/download-pdf', hipController.downloadHipPdf);

module.exports = router;
