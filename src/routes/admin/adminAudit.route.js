const express = require('express');
const route = express.Router();
const adminController = require('../../controllers/admin.controller.js');

/**
 * @swagger
 * /admin/audit/logs:
 *   get:
 *     summary: Get all audit logs (Admin only)
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter logs by specific User ID (Optional)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of audit logs (Paginated)
 */

route.get('/logs', adminController.getAuditLogs);

module.exports = route;
