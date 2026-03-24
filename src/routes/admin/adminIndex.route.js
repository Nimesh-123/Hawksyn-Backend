const express = require('express');
const route = express.Router();

const adminUserRoute = require('./adminUser.route.js');
const adminAuditRoute = require('./adminAudit.route.js');
const adminProfileRoute = require('./adminProfile.route.js');

// Mount Sub-Routes
route.use('/users', adminUserRoute);
route.use('/audit', adminAuditRoute);
route.use('/profile', adminProfileRoute);

module.exports = route;
