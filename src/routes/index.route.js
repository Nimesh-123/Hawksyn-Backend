const express = require('express');
const route = express.Router();

const authRoute = require('./auth/authIndex.route.js');
const userRoute = require('./user/userIndex.route.js');
const adminRoute = require('./admin/adminIndex.route.js');
const chatRoute = require('./chat.route.js'); 
const caseRoutes = require('./caseRoutes.js');
const paymentRoutes = require('./paymentRoutes.js');
const runRoutes = require('./runRoutes.js');
const recordsRoutes = require('./records.routes.js');
const commandCenterRoutes = require('./commandCenterRoutes.js');
const expertAuthRoute = require('./expert/expertAuth.route.js');

// 1. PUBLIC ROUTES (Login / Signup / Chat for testing)
route.use('/auth', authRoute);
route.use('/chat', chatRoute); // ✅ Moved to public for testing

// 2. PROTECTED ROUTES (Requires valid JWT Token)
route.use('/admin', adminRoute);
route.use('/user', userRoute);
route.use('/users', recordsRoutes);
route.use('/cases', caseRoutes);
route.use('/payment', paymentRoutes);
route.use('/runs', runRoutes);
route.use('/command-center', commandCenterRoutes);
route.use('/expert', expertAuthRoute);

module.exports = route;
