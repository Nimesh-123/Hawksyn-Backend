const express = require('express');
const route = express.Router();
const userController = require('../../controllers/user.controller.js');

/**
 * @swagger
 * /auth/user/refresh-token:
 *   post:
 *     summary: Get new Access Token using Refresh Token
 *     tags:
 *       - Auth
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
