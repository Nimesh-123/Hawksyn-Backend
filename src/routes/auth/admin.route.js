const express = require('express');
const route = express.Router();
const adminController = require('../../controllers/admin.controller.js');
const admin2faController = require('../../controllers/admin2faController');

/**
 * @swagger
 * /auth/admin/signup:
 *   post:
 *     summary: Register a new admin
 *     tags: ["1. Authentication & Security"]
 *     description: Register a new admin user with username, email, and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@admin.com
 *               password:
 *                 type: string
 *                 example: Admin@123
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Admin registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                     token:
 *                       type: string
 *       400:
 *         description: Bad request or admin already exists
 */
route.post('/signup', adminController.adminSignup);

route.patch('/change-password', adminController.changeAdminPassword);

// 2FA Management
route.get('/2fa/setup', admin2faController.setup2FA);
route.post('/2fa/enable', admin2faController.enable2FA);
route.post('/2fa/disable', admin2faController.disable2FA);

/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: ["1. Authentication & Security"]
 *     description: Login with email and password and receive a token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@admin.com
 *               password:
 *                 type: string
 *                 example: Admin@123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                     token:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Bad request
 */
route.post('/login', adminController.adminLogin);

/**
 * @route   POST /api/v1/auth/admin/verify-2fa
 * @desc    Verify 2FA token during login
 * @access  Public (Post-password)
 */
route.post('/verify-2fa', admin2faController.verify2FALogin);

module.exports = route;
