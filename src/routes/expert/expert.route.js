const express = require('express');
const router = express.Router();
const expertController = require('../../controllers/expertController');
const { authenticate, authorize } = require('../../../middleware/authorization/authorization.js');
const adminController = require('../../controllers/admin.controller');
/**
 * EXPERT PROFILE ROUTES
 */

/**
 * @swagger
 * /expert/profile:
 *   get:
 *     summary: Get expert profile details
 *     tags: ["12. Expert Panel: Auth"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile details fetched successfully
 */
router.get('/profile', authenticate, authorize('expert'), expertController.getExpertProfile);

/**
 * @swagger
 * /expert/profile/setup:
 *   patch:
 *     summary: Set up expert profile (Designation, UPI, Bio)
 *     description: Sets expert professional details. If designation and UPI are provided, status moves to ACTIVE.
 *     tags: ["12. Expert Panel: Auth"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               designation: { type: string }
 *               upiId: { type: string }
 *               profileNote: { type: string }
 *               currentOrganization: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/profile/setup', authenticate, authorize('expert'), expertController.updateExpertProfile);

/**
 * @swagger
 * /expert/availability:
 *   patch:
 *     summary: Toggle expert availability ON/OFF
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Availability status toggled
 */
router.patch('/availability', authenticate, authorize('expert'), expertController.toggleAvailability);

/**
 * @swagger
 * /expert/cases:
 *   get:
 *     summary: Get expert case queue (Assigned or Completed)
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema:
 *           type: string
 *           enum: [ASSIGNED, COMPLETED]
 *         description: Case status tab
 *     responses:
 *       200:
 *         description: Case list fetched successfully
 */
router.get('/cases', authenticate, authorize('expert'), expertController.getExpertCases);

/**
 * @swagger
 * /expert/inbox:
 *   get:
 *     summary: Get unread messages and active chat sessions
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inbox list fetched successfully
 */
router.get('/inbox', authenticate, authorize('expert'), expertController.getAuditorInbox);

/**
 * @swagger
 * /expert/chat/reply:
 *   post:
 *     summary: Send a reply to a user query
 *     description: Replies to user messages and triggers push notification.
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [runId, content]
 *             properties:
 *               runId: { type: string }
 *               content: { type: string }
 *               type: { type: string, default: TEXT }
 *     responses:
 *       200:
 *         description: Reply sent successfully
 */
router.post('/chat/reply', authenticate, authorize('expert'), expertController.replyToQuery);

/**
 * @swagger
 * /expert/queries/{runId}:
 *   get:
 *     summary: Get chat history for a specific run
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat history fetched
 */
router.get('/queries/:runId', authenticate, authorize('expert'), expertController.getExpertQueries);

/**
 * @swagger
 * /expert/audit-review/{runId}:
 *   post:
 *     summary: Submit final expert review and verdict override
 *     tags: ["13. Expert Panel: Operations"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review submitted successfully
 */

router.post('/audit-review/:runId', authenticate, authorize('expert'), adminController.submitExpertReview);

module.exports = router;
