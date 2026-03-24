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
        
        // Auto-assign admin role to the VERY FIRST admin in the system
        const adminCount = await db.Admin.countDocuments();
        const role = adminCount === 0 ? 'admin' : 'sub_admin';

        const admin = await db.Admin.create({ 
            username, 
            email, 
            password: hashedPassword,
            role: role
        });

        /* 
        // Current Solution: 1 year expiry
        const token = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '365d' });
        */

        // Active Solution 1: Refresh Token support
        const accessToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, process.env.JWT_SECRET_REFRESH || 'refresh_secret', { expiresIn: '365d' });

        admin.refreshToken = refreshToken;
        await admin.save();

        const adminResponse = admin.toObject();
        delete adminResponse.password;
        delete adminResponse.refreshToken;

        return RESPONSE.success(res, 201, 1004, { admin: adminResponse, accessToken, refreshToken });
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

        const adminResponse = admin.toObject();
        delete adminResponse.password;
        delete adminResponse.refreshToken;

        return RESPONSE.success(res, 200, 1006, { admin: adminResponse, accessToken, refreshToken });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get All Users (Active + Deleted)
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const users = await db.User.find()
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.User.countDocuments();

        return RESPONSE.success(res, 200, 1001, { users, total, page: Number(page) });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Only Active Users
exports.getActiveUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const users = await db.User.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.User.countDocuments({ isDeleted: false });

        return RESPONSE.success(res, 200, 1001, { users, total, page: Number(page) });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Soft-Deleted Users (History)
exports.getDeletedUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const users = await db.User.find({ isDeleted: true })
            .sort({ deletedAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.User.countDocuments({ isDeleted: true });

        return RESPONSE.success(res, 200, 1001, { users, total, page: Number(page) });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Full User Details & History
exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await db.User.findById(userId);
        if (!user) return RESPONSE.error(res, 404, 3001, 'User not found');

        // Fetch additional data for Admin to see
        const profile = await db.UserProfile.findOne({ userId });
        const runs = await db.Runs.find({ userId }).sort({ createdAt: -1 });
        const auditLogs = await db.AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(10);

        return RESPONSE.success(res, 200, 1001, {
            user,
            profile,
            runs,
            auditLogs
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Block/Unblock User
exports.blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isBlocked } = req.body;

        const user = await db.User.findById(userId);
        if (!user) return RESPONSE.error(res, 404, 3001, 'User not found');

        user.isBlocked = isBlocked;
        if (isBlocked) user.refreshToken = null; // Clear session on block
        await user.save();

        const status = isBlocked ? 'Blocked' : 'Unblocked';
        return RESPONSE.success(res, 200, 1001, { message: `User successfully ${status}` });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get All Audit Logs (With Pagination & Optional Filtering)
exports.getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, userId } = req.query;
        
        // Define Filter
        const filter = {};
        if (userId) filter.userId = userId;

        const logs = await db.AuditLog.find(filter)
            .populate('userId', 'email name')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.AuditLog.countDocuments(filter);

        return RESPONSE.success(res, 200, 1001, {
            logs,
            total,
            page: Number(page),
            limit: Number(limit),
            hasNextPage: total > page * limit
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Admin Profile
exports.getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;
        const admin = await db.Admin.findById(adminId).select('-password -refreshToken');
        if (!admin) {
            return RESPONSE.error(res, 404, 1005, 'Admin not found');
        }
        return RESPONSE.success(res, 200, 1001, { admin });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Update Admin Profile
exports.updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { username, email } = req.body;

        if (!username && !email) {
            return RESPONSE.error(res, 400, 1002, 'Username or email is required for update');
        }

        const updateData = {};
        if (username) updateData.username = username;
        if (email) {
            const existingAdmin = await db.Admin.findOne({ email, _id: { $ne: adminId } });
            if (existingAdmin) {
                return RESPONSE.error(res, 400, 1003, 'Email is already in use by another admin');
            }
            updateData.email = email;
        }

        const updatedAdmin = await db.Admin.findByIdAndUpdate(
            adminId,
            { $set: updateData },
            { new: true }
        ).select('-password -refreshToken');

        return RESPONSE.success(res, 200, 1001, {
            message: 'Profile updated successfully',
            admin: updatedAdmin
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Change Admin Password
exports.changeAdminPassword = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return RESPONSE.error(res, 400, 1002, 'Old password and new password are required');
        }

        const admin = await db.Admin.findById(adminId);
        if (!admin) {
            return RESPONSE.error(res, 404, 1005, 'Admin not found');
        }

        const isMatch = await bcrypt.compare(oldPassword, admin.password);
        if (!isMatch) {
            return RESPONSE.error(res, 401, 1005, 'Invalid old password');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        await admin.save();

        return RESPONSE.success(res, 200, 1001, { message: 'Password changed successfully' });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
// --- Sub-Admin Management (Super Admin Only) ---

// Create Sub-Admin
exports.createSubAdmin = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return RESPONSE.error(res, 403, 4444, 'Strict Permission Denied: Only primary Admin can carry out this action');
        }

        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return RESPONSE.error(res, 400, 1002, 'Username, email and password are required');
        }

        const existingAdmin = await db.Admin.findOne({ email });
        if (existingAdmin) {
            return RESPONSE.error(res, 400, 1003, 'Admin with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const subAdmin = await db.Admin.create({
            username,
            email,
            password: hashedPassword,
            role: 'sub_admin'
        });

        const subAdminResponse = subAdmin.toObject();
        delete subAdminResponse.password;

        return RESPONSE.success(res, 201, 1004, { 
            message: 'Sub-admin created successfully',
            admin: subAdminResponse 
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get All Sub-Admins
exports.getSubAdmins = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return RESPONSE.error(res, 403, 4444, 'Permission Denied: Only Admin can view sub-admin list');
        }

        const admins = await db.Admin.find({ role: 'sub_admin' }).select('-password -refreshToken');
        return RESPONSE.success(res, 200, 1001, { subAdmins: admins });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Delete Sub-Admin
exports.deleteSubAdmin = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return RESPONSE.error(res, 403, 4444, 'Permission Denied: Only primary Admin can delete sub-admins');
        }

        const { id } = req.params;
        const subAdmin = await db.Admin.findById(id);

        if (!subAdmin) return RESPONSE.error(res, 404, 1005, 'Sub-admin not found');
        if (subAdmin.role === 'admin') {
            return RESPONSE.error(res, 400, 4444, 'Cannot delete a primary Admin account');
        }

        await db.Admin.findByIdAndDelete(id);
        return RESPONSE.success(res, 200, 1001, { message: 'Sub-admin deleted successfully' });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     summary: Get overview stats for the Admin Dashboard
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *       403:
 *         description: Permission denied
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // 1. User & Report Summaries
        const totalUsers = await db.User.countDocuments();
        const newUsersToday = await db.User.countDocuments({ createdAt: { $gte: todayStart } });
        const totalRuns = await db.Runs.countDocuments();
        const completedRuns = await db.Runs.countDocuments({ status: 'REPORT_COMPLETE' });
        const processingRuns = await db.Runs.countDocuments({ status: { $nin: ['REPORT_COMPLETE'] } });

        // 2. Financial Metrics (Total & Breakdown by Case)
        const revenueResult = await db.Payments.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        const revenueByCase = await db.Payments.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: "$caseId", revenue: { $sum: "$amount" } } },
            {
                $lookup: {
                    from: 'case_registry',
                    localField: '_id',
                    foreignField: 'caseId',
                    as: 'caseDetails'
                }
            },
            {
                $project: {
                    caseId: "$_id",
                    revenue: 1,
                    caseName: { $arrayElemAt: ["$caseDetails.caseName", 0] }
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        // 3. Case Distribution (Pie Chart Data)
        const caseMix = await db.Runs.aggregate([
            { $group: { _id: "$caseId", count: { $sum: 1 } } },
            {
                $lookup: {
                    from: 'case_registry',
                    localField: '_id',
                    foreignField: 'caseId',
                    as: 'caseDetails'
                }
            },
            {
                $project: {
                    caseId: "$_id",
                    count: 1,
                    caseName: { $arrayElemAt: ["$caseDetails.caseName", 0] }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // 4. Daily Activity Trend (Last 7 Days)
        const dailyActivity = await db.Runs.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    runs: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return RESPONSE.success(res, 200, 1001, {
            stats: {
                summary: {
                    users: { total: totalUsers, newToday: newUsersToday },
                    reports: { total: totalRuns, completed: completedRuns, processing: processingRuns },
                    revenue: { total: totalRevenue, currency: 'INR' }
                },
                charts: {
                    caseDistribution: caseMix,
                    last7DaysTrend: dailyActivity,
                    revenueByCase: revenueByCase
                }
            }
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
 
