const express = require('express');
const route = express.Router();

const userController = require('../../controllers/user.controller.js');
const upload = require('../../../middleware/multer.js');

/**
 * @swagger
 * /user/send-otp:
 *   post:
 *     summary: Send OTP to email
 *     tags: [1. Authentication & Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: developer01.app2026@gmail.com
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
 *     tags: [1. Authentication & Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: developer01.app2026@gmail.com
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
 *     tags: [1. Authentication & Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: developer01.app2026@gmail.com
 *               mPin:
 *                 type: string
 *                 example: "1234"
 *               confirmMPin:
 *                 type: string
 *                 example: "1234"
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
 *     tags: [1. Authentication & Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: developer01.app2026@gmail.com
 *               mPin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT Token.
 */
route.post('/login-with-pin', userController.loginWithPin);

/**
 * @swagger
 * /user/account:
 *   delete:
 *     summary: Delete user account (Soft or Hard)
 *     description: Default is soft delete. Pass hardDelete=true to permanently wipe all user data (runs, CVs, payments, profile).
 *     tags: [1. Authentication & Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hardDelete
 *         schema:
 *           type: boolean
 *         description: Set to true for permanent deletion of all data.
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
 *     tags: [1. Authentication & Security]
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
 *     tags: [2. Onboarding (Profile Setup)]
 *     security:
 *       - bearerAuth: []
 *     parameters: []
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

/**
 * @swagger
 * /user/refresh-token:
 *   post:
 *     summary: Get new Access Token using Refresh Token
 *     tags: [1. Authentication & Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid or expired refresh token
 */
route.post('/refresh-token', userController.refreshToken);

module.exports = route;
