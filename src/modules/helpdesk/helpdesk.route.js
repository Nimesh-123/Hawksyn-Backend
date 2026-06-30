const express = require('express');
const route = express.Router();
const helpdeskController = require('./helpdesk.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

/**
 * @swagger
 * /helpdesk/tickets:
 *   get:
 *     summary: Get all helpdesk tickets for the logged-in user
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of tickets
 *       500:
 *         description: Server error
 */
route.get('/tickets', authMiddleware, helpdeskController.getAllTickets);

/**
 * @swagger
 * /helpdesk/tickets:
 *   post:
 *     summary: Create a new helpdesk ticket
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - description
 *             properties:
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *               deviceInfo:
 *                 type: object
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
route.post('/tickets', authMiddleware, helpdeskController.createTicket);

/**
 * @swagger
 * /helpdesk/tickets/{id}:
 *   get:
 *     summary: Get a specific ticket thread
 *     tags: [Helpdesk]
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
 *         description: Ticket thread details
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
route.get('/tickets/:id', authMiddleware, helpdeskController.getTicketThread);

/**
 * @swagger
 * /helpdesk/tickets/{id}/reply:
 *   post:
 *     summary: Reply to an existing open ticket
 *     tags: [Helpdesk]
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
 *     responses:
 *       201:
 *         description: Reply sent successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Ticket is closed
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
route.post('/tickets/:id/reply', authMiddleware, helpdeskController.replyToTicket);

module.exports = route;
