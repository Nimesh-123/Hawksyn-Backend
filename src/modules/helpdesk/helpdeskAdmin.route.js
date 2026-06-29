const express = require('express');
const route = express.Router();
const helpdeskAdminController = require('./helpdeskAdmin.controller.js');
const authMiddleware = require('../../../middleware/auth.js');
// Optionally you might have an adminMiddleware or role check here.
// e.g. const { verifyAdmin } = require('../../../middleware/adminAuth.js');

route.get('/tickets', authMiddleware, helpdeskAdminController.getAllTicketsAdmin);
route.get('/tickets/:id', authMiddleware, helpdeskAdminController.getTicketThreadAdmin);
route.post('/tickets/:id/reply', authMiddleware, helpdeskAdminController.replyToTicketAdmin);
route.patch('/tickets/:id/status', authMiddleware, helpdeskAdminController.updateTicketStatus);

module.exports = route;
