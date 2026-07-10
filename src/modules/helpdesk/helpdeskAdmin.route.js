const express = require('express');
const route = express.Router();
const helpdeskAdminController = require('./helpdeskAdmin.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

/**
 * @swagger
 * /admin/helpdesk/tickets:
 *   get:
 *     summary: Get all tickets for admin
 *     tags: [Admin Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (e.g. OPEN, CLOSED)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by specific user ID
 *     responses:
 *       200:
 *         description: Tickets fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
route.get('/tickets', authMiddleware, helpdeskAdminController.getAllTicketsAdmin);

/**
 * @swagger
 * /admin/helpdesk/tickets/{id}:
 *   get:
 *     summary: Get details and thread for a specific ticket
 *     tags: [Admin Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ticket ID
 *     responses:
 *       200:
 *         description: Ticket details and thread fetched successfully
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
route.get('/tickets/:id', authMiddleware, helpdeskAdminController.getTicketThreadAdmin);

/**
 * @swagger
 * /admin/helpdesk/tickets/{id}/reply:
 *   post:
 *     summary: Reply to a ticket as an admin
 *     tags: [Admin Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The reply message
 *     responses:
 *       201:
 *         description: Reply sent successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
route.post('/tickets/:id/reply', authMiddleware, helpdeskAdminController.replyToTicketAdmin);

/**
 * @swagger
 * /admin/helpdesk/tickets/{id}/status:
 *   patch:
 *     summary: Update a ticket's status
 *     tags: [Admin Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, CLOSED]
 *                 description: The new status for the ticket
 *     responses:
 *       200:
 *         description: Ticket status updated successfully
 *       400:
 *         description: Bad request or Invalid status
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
route.patch('/tickets/:id/status', authMiddleware, helpdeskAdminController.updateTicketStatus);

/**
 * @swagger
 * /admin/helpdesk/tickets/{id}/read:
 *   patch:
 *     summary: Mark messages from user as read
 *     tags: [Admin Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ticket ID
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
route.patch('/tickets/:id/read', authMiddleware, helpdeskAdminController.markTicketAsReadAdmin);

module.exports = route;
