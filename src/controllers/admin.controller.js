const { db } = require('../models/index.model.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RESPONSE = require('../../utils/response.js');

// Admin Signup
exports.adminSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return RESPONSE.error(res, 400, 1002, 'Username, email and password are required');
        }
        const existingAdmin = await db.Admin.findOne({ email });
        if (existingAdmin) {
            return RESPONSE.error(res, 400, 1003, 'Admin already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await db.Admin.create({ username, email, password: hashedPassword });

        /* 
        // Current Solution: 1 year expiry
        const token = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '365d' });
        */

        // Active Solution 1: Refresh Token support
        const accessToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET_REFRESH || 'refresh_secret', { expiresIn: '365d' });

        admin.refreshToken = refreshToken;
        await admin.save();

        return RESPONSE.success(res, 201, 1004, { admin, accessToken, refreshToken });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Admin Login
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return RESPONSE.error(res, 400, 1002, 'Email and password are required');
        }
        const admin = await db.Admin.findOne({ email });
        if (!admin) {
            return RESPONSE.error(res, 401, 1005, 'Invalid email or password');
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return RESPONSE.error(res, 401, 1005, 'Invalid email or password');
        }
        /* 
        // Current Solution: 1 year expiry
        const token = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '365d' });
        */

        // Active Solution 1: Refresh Token support
        const accessToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET_REFRESH || 'refresh_secret', { expiresIn: '365d' });

        admin.refreshToken = refreshToken;
        await admin.save();

        return RESPONSE.success(res, 200, 1006, { admin, accessToken, refreshToken });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get All Audit Logs
exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await db.AuditLog.find()
            .populate('userId', 'email name')
            .sort({ createdAt: -1 })
            .limit(100); // Limit to last 100 for now

        return RESPONSE.success(res, 200, 1001, logs);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
