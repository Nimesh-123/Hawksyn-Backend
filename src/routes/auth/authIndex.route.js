const express = require('express');
const route = express.Router();
const adminRoute = require('./admin.route.js');

route.use('/admin', adminRoute);

module.exports = route;
