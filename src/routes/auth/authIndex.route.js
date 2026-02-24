const express = require('express');
const route = express.Router();
const adminRoute = require('./admin.route.js');
const userRoute = require('./user.route.js');

route.use('/admin', adminRoute);
route.use('/user', userRoute);

module.exports = route;
