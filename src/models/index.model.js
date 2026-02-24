const db = {};

db.Admin = require('../models/admin.model.js');
db.User = require('../models/user.model.js');
db.OTP = require('../models/otp.model.js');
db.AuditLog = require('../models/auditLog.model.js');

module.exports = { db };
