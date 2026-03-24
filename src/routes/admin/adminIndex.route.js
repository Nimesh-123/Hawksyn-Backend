const express = require('express');
const route = express.Router();

const adminController = require('../../controllers/admin.controller.js');
const adminUserRoute = require('./adminUser.route.js');
const adminAuditRoute = require('./adminAudit.route.js');
const adminProfileRoute = require('./adminProfile.route.js');
const adminManageRoute = require('./adminManage.route.js');

// Mount Sub-Routes
route.use('/users', adminUserRoute);
route.use('/audit', adminAuditRoute);
route.use('/profile', adminProfileRoute);
route.use('/manage', adminManageRoute);

// Dashboard Stats
route.get('/dashboard/stats', adminController.getDashboardStats);

module.exports = route;
