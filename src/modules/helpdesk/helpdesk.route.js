const express = require('express');
const route = express.Router();
const helpdeskController = require('./helpdesk.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

route.get('/tickets', authMiddleware, helpdeskController.getAllTickets);
route.post('/tickets', authMiddleware, helpdeskController.createTicket);
route.get('/tickets/:id', authMiddleware, helpdeskController.getTicketThread);
route.post('/tickets/:id/reply', authMiddleware, helpdeskController.replyToTicket);

module.exports = route;
