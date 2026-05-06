const express = require('express');
const route = express.Router();

const adminController = require('../../controllers/admin.controller.js');
const adminUserRoute = require('./adminUser.route.js');
const adminAuditRoute = require('./adminAudit.route.js');
const adminProfileRoute = require('./adminProfile.route.js');
const adminManageRoute = require('./adminManage.route.js');
const adminReportsRoute = require('./adminReports.route.js');
const adminPlaybookRoute = require('./adminPlaybook.route.js');
const adminConfigRoute = require('./adminConfig.route.js');
const paymentController = require('../../controllers/paymentController');


// Mount Sub-Routes
route.use('/users', adminUserRoute);
route.use('/audit', adminAuditRoute);
route.use('/profile', adminProfileRoute);
route.use('/manage', adminManageRoute);
route.use('/reports', adminReportsRoute); // AI Training Data — Report Rating
route.use('/playbook', adminPlaybookRoute);
route.use('/config', adminConfigRoute);

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
route.get('/signals/summary', adminController.getDashboardStats);
route.get('/signals/volume', adminController.getSignalVolumeSummary);

// Financials
route.get('/payments/all', paymentController.adminGetAllPayments);
route.get('/payments/export', paymentController.adminExportPaymentsCSV);

// Operational Pipeline (Kanban Board)
const caseController = require('../../controllers/caseController');
route.get('/pipeline/summary', caseController.getPipelineSummary);
route.post('/runs/:runId/revert', caseController.revertRunStatus);

// Content Management (FAQ & Legal)
const supportController = require('../../controllers/supportContentController');
route.get('/content/faq', supportController.getFAQs);
route.post('/content/faq', supportController.createFAQ);
route.patch('/content/faq/:id', supportController.updateFAQ);
route.delete('/content/faq/:id', supportController.deleteFAQ);

route.get('/content/legal', supportController.getLegalContent);
route.post('/content/legal', supportController.upsertLegalContent);

module.exports = route;
