const express = require('express');
const router = express.Router();
const expertAuthController = require('../../controllers/expertAuth.controller');
const { authenticate } = require('../../../middleware/authorization/authorization.js');

/**
 * @swagger
 * /expert/auth/login:
 *   post:
 *     summary: Expert login using email and password
 *     tags: ["12. Expert Panel: Auth"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 */
router.post('/auth/login', expertAuthController.expertLogin);

// Note: /expert/profile is now handled in expert.route.js with full documentation
// Keeping this for backward compatibility if needed, but expert.route.js is preferred
router.get('/auth/profile', authenticate, expertAuthController.getExpertProfile);

module.exports = router;
