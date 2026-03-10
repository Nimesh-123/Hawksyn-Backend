const express = require('express');
const route = express.Router();
const userRoute = require('./user.route.js');
const userProfileRoutes = require('../userProfileRoutes');

route.use('/', userRoute);
route.use('/', userProfileRoutes);


module.exports = route;
