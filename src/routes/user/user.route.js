const express = require('express');
const route = express.Router();

const userController = require('../../controllers/user.controller.js');
const recordsController = require('../../controllers/recordsController');
const expertController = require('../../controllers/expertController');
const upload = require('../../../middleware/multer.js');

/**
 * @swagger
 * /user/send-otp:
 *   post:
 *     summary: Send OTP to email
 *     tags: ["1. Authentication & Security"]
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
 *     tags: ["1. Authentication & Security"]
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
 *     tags: ["1. Authentication & Security"]
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
 *     tags: ["1. Authentication & Security"]
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
 * /user/auth/google:
 *   post:
 *     summary: Social Login using Google ID Token
 *     tags: ["1. Authentication & Security"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Identity Token received from Google Auth on Frontend.
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT Token.
 */
route.post('/auth/google', userController.googleLogin);

/**
 * @swagger
 * /user/account:
 *   delete:
 *     summary: Delete user account (Soft or Hard)
 *     description: Default is soft delete. Pass hardDelete=true to permanently wipe all user data (runs, CVs, payments, profile).
 *     tags: ["1. Authentication & Security"]
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
 *     tags: ["1. Authentication & Security"]
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
 *     tags: ["2. Onboarding (Profile Setup)"]
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
 * /user/trends:
 *   get:
 *     summary: Fetch personalized, CV-derived market trends and benchmarks (Slide 14)
 *     tags: ["8. Command Center & Trends"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personalized trends retrieved successfully
 *       404:
 *         description: No trend data found
 */
/**
 * @swagger
 * /user/runs/compare:
 *   get:
 *     summary: Deep comparison between two runs (Slide 45)
 *     tags: ["6. My Records & Reports"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: baseline
 *         required: true
 *       - in: query
 *         name: latest
 *         required: true
 *     responses:
 *       200:
 *         description: Comparison data
 */
route.get('/runs/compare', recordsController.compareRuns);

route.get('/trends', userController.getTrends);

/**
 * @swagger
 * /user/credits/unlock:
 *   post:
 *     summary: Use credits to unlock expert support for a specific run (Slide 53-54)
 *     tags: ["7. Expert Support & Chat"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [runId]
 *             properties:
 *               runId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Support unlocked
 *       402:
 *         description: Insufficient credits
 */
route.post('/credits/unlock', expertController.unlockExpertSupport);

route.post('/update-fcm-token', userController.updateFcmToken);

/**
 * @swagger
 * /user/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: ["1. Authentication & Security"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
route.post('/logout-all', userController.logoutAll);

/**
 * @swagger
 * /user/export-data:
 *   get:
 *     summary: Export all user data (DPDP Compliance)
 *     tags: ["1. Authentication & Security"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data export successful
 */
route.get('/export-data', userController.downloadUserData);
/**
 * @swagger
 * /user/change-pin:
 *   post:
 *     summary: Change M-PIN using the old PIN
 *     tags: ["1. Authentication & Security"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPin, newPin]
 *             properties:
 *               oldPin:
 *                 type: string
 *                 example: "1234"
 *               newPin:
 *                 type: string
 *                 example: "4321"
 *     responses:
 *       200:
 *         description: M-PIN changed successfully
 *       401:
 *         description: Incorrect old PIN
 */
route.post('/change-pin', userController.changeMPin);

route.post('/apply-expert', userController.applyAsExpert);


module.exports = route;
