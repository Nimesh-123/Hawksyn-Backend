const express = require('express');
const route = express.Router();

const adminController = require('../../controllers/admin.controller.js');
const adminUserRoute = require('./adminUser.route.js');
const adminAuditRoute = require('./adminAudit.route.js');
const adminProfileRoute = require('./adminProfile.route.js');
const adminManageRoute = require('./adminManage.route.js');
const adminReportsRoute = require('./adminReports.route.js');

// Mount Sub-Routes
route.use('/users', adminUserRoute);
route.use('/audit', adminAuditRoute);
route.use('/profile', adminProfileRoute);
route.use('/manage', adminManageRoute);
route.use('/reports', adminReportsRoute); // AI Training Data — Report Rating

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     summary: Get overview stats for the Admin Dashboard
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *       403:
 *         description: Permission denied
 */
route.get('/dashboard/stats', adminController.getDashboardStats);

module.exports = route;
