const express = require('express');
const route = express.Router();

const authRoute = require('./auth/authIndex.route.js');
const userRoute = require('./user/userIndex.route.js');
const adminRoute = require('./admin/adminIndex.route.js');
const caseRoutes = require('./caseRoutes.js');
const paymentRoutes = require('./paymentRoutes.js');
const cvRoutes = require('./cvRoutes.js');

route.use('/auth', authRoute);
route.use('/admin', adminRoute);
route.use('/user', userRoute);
route.use('/cases', caseRoutes);
route.use('/payment', paymentRoutes);
route.use('/runs', cvRoutes);


module.exports = route;

