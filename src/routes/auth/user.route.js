const express = require('express');
const route = express.Router();
const userController = require('../../controllers/user.controller.js');

/**
 * @swagger
 * /auth/user/login:
 *   post:
 *     summary: User login (email or quick)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               identity:
 *                 type: string
 *               loginType:
 *                 type: string
 *                 enum: [email, quick]
 *     responses:
 *       200:
 *         description: Success
 */
route.post('/login', userController.loginWithPin);

module.exports = route;
