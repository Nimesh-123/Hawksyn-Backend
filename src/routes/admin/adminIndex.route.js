const express = require('express');
const route = express.Router();

const adminController = require('../../controllers/admin.controller.js');

const { authorize } = require('../../../middleware/authorization/authorization.js');

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Get all audit logs (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of audit logs
 */
route.get('/logs', adminController.getAuditLogs);

module.exports = route;
