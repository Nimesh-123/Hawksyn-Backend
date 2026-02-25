const express = require('express');
const route = express.Router();

const authRoute = require('./auth/authIndex.route.js');
const userRoute = require('./user/userIndex.route.js');
const adminRoute = require('./admin/adminIndex.route.js');
const testRoute = require('./test/test.route.js');

route.use('/auth', authRoute);
route.use('/admin', adminRoute);
route.use('/user', userRoute);
route.use('/test', testRoute);

module.exports = route;
