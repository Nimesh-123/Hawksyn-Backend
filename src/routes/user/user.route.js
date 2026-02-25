const express = require('express');
const route = express.Router();

const userController = require('../../controllers/user.controller.js');
const upload = require('../../../middleware/multer.js');

/**
 * @swagger
 * /user/send-otp:
 *   post:
 *     summary: Send OTP to email
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Success
 */
route.post('/send-otp', userController.sendOTP);

/**
 * @swagger
 * /user/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Success
 */
route.post('/verify-otp', userController.verifyOTP);

/**
 * @swagger
 * /user/set-pin:
 *   post:
 *     summary: Set M-PIN
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               mPin:
 *                 type: string
 *               confirmMPin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
route.post('/set-pin', userController.setPin);

/**
 * @swagger
 * /user/login-with-pin:
 *   post:
 *     summary: Login using Email and M-PIN
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               mPin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT Token.
 */
route.post('/login-with-pin', userController.loginWithPin);

/**
 * @swagger
 * /user/account:
 *   delete:
 *     summary: Soft delete user account
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */
route.delete('/account', userController.deleteAccount);

/**
 * @swagger
 * /user/forgot-pin:
 *   post:
 *     summary: Request OTP for Forgot PIN
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent
 */
route.post('/forgot-pin', userController.forgotPin);

/**
 * @swagger
 * /user/upload-cv:
 *   post:
 *     summary: Upload and Parse User CV (PDF only, max 10MB)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulk
 *         schema:
 *           type: boolean
 *         description: If true, uses Gemini directly for cheaper/faster bulk parsing.
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
 *                 description: PDF file of the CV (Strictly PDF)
 *     responses:
 *       200:
 *         description: CV uploaded and parsed successfully. Returns stored S3 URL and structured AEU JSON data.
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
 *                     message:
 *                       type: string
 *                     cvUrl:
 *                       type: string
 *                     parsedData:
 *                       type: object
 *                       description: Normalized AEU JSON structure
 *       400:
 *         description: Invalid file type (Non-PDF) or file too large (>10MB)
 *       404:
 *         description: User not found
 */
route.post('/upload-cv', upload.single('cv'), userController.uploadCV);

module.exports = route;
