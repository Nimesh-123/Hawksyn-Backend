const express = require('express');
const router = express.Router();
const expertAuthController = require('../../controllers/expertAuth.controller');
const expertController = require('../../controllers/expertController');
const adminController = require('../../controllers/admin.controller');
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
router.get('/auth/profile', authenticate, expertAuthController.getExpertProfile);

/**
 * --- Expert Panel Operations ---
 */

/**
 * @swagger
 * /expert/inbox:
 *   get:
 *     summary: Get expert's pending query inbox
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 */
router.get('/inbox', authenticate, expertController.getAuditorInbox);
router.get('/queries/:runId', authenticate, expertController.getExpertQueries);

/**
 * @swagger
 * /expert/reply:
 *   post:
 *     summary: Reply to a specific user query
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reply', authenticate, expertController.replyToQuery);

/**
 * @swagger
 * /expert/audit-review/{runId}:
 *   post:
 *     summary: Submit final expert review and verdict override
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 */
router.post('/audit-review/:runId', authenticate, adminController.submitExpertReview);

module.exports = router;
