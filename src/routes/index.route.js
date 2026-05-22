const express = require('express');
const route = express.Router();

const authRoute = require('../modules/auth/authIndex.route.js');
const userRoute = require('../modules/user/userIndex.route.js');
const adminRoute = require('../modules/admin/adminIndex.route.js');
const chatRoute = require('../modules/expert/chat.route.js'); 
const caseRoutes = require('../modules/cases/case.route.js');
const paymentRoutes = require('../modules/billing/payment.route.js');
const runRoutes = require('../modules/assurance/run.route.js');
const recordsRoutes = require('../modules/assurance/records.route.js');
const commandCenterRoutes = require('../modules/commandCenter/commandCenter.route.js');
const expertAuthRoute = require('../modules/expert/expertAuth.route.js');
const expertRoute = require('../modules/expert/expert.route.js');
const notificationRoutes = require('../modules/notification/notification.route.js');
const contentRoutes = require('../modules/support/content.route.js');

// 1. PUBLIC ROUTES (Login / Signup)
route.use('/auth', authRoute);
route.use('/content', contentRoutes); // /api/v1/content/faq
route.use('/legal', contentRoutes);   // /api/v1/legal/content

// 2. PROTECTED ROUTES (Requires valid JWT Token)
route.use('/admin', adminRoute);
route.use('/chat', chatRoute); 
route.use('/user', userRoute);
route.use('/users', recordsRoutes);
route.use('/cases', caseRoutes);
route.use('/payment', paymentRoutes);
route.use('/runs', runRoutes);
route.use('/command-center', commandCenterRoutes);
route.use('/expert', expertAuthRoute);
route.use('/expert', expertRoute);
route.use('/notifications', notificationRoutes);

module.exports = route;
