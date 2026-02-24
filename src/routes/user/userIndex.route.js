const express = require('express');
const route = express.Router();
const userRoute = require('./user.route.js');

route.use('/', userRoute);

module.exports = route;
