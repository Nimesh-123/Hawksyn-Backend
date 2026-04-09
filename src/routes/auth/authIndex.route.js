const express = require('express');
const route = express.Router();
const adminRoute = require('./admin.route.js');
const authController = require('../../controllers/auth.controller.js');

route.use('/admin', adminRoute);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Get new Access Token using Refresh Token
 *     tags: ["1. Authentication & Security"]
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
route.post('/refresh-token', authController.refreshToken);

module.exports = route;
