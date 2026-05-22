const express = require('express');
const route = express.Router();
const userRoute = require('./user.route.js');
const userProfileRoutes = require('./userProfile.route.js');

route.use('/', userRoute);
route.use('/', userProfileRoutes);


module.exports = route;
