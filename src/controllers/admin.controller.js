const { db } = require('../models/index.model.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RESPONSE = require('../../utils/response.js');
const s3Service = require('../../utils/s3');
const notificationService = require('../services/notificationService');

/**
 * PHASE 2: Dashboard Overview Statistics
 * GET /api/v1/admin/dashboard/stats
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await db.User.countDocuments({ role: 'user' });
        const activeRuns = await db.Runs.countDocuments({ status: { $nin: ['REPORT_COMPLETE', 'FAILED'] } });
        
        // Pending Audits (Kanban Columns: INTAKE, ANALYSIS, REVIEW)
        const pendingAudits = await db.Runs.countDocuments({ 
            status: { $in: ['CREATED', 'CV_UPLOADED', 'ANALYSING', 'INTEGRITY_CHECK_PASSED', 'EXPERT_ASSIGNED'] } 
        });

        // Revenue (Sum of successful payments)
        const revenueData = await db.Payments.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        return RESPONSE.success(res, 200, 1001, {
            totalUsers,
            activeRuns,
            pendingAudits,
            totalRevenue,
            currency: 'INR'
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

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

// Get All Users (Role: User only, Active + Deleted)
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        // Filter by role: 'user' to exclude Experts/Admins from the customer list
        const query = { role: 'user' };

        const users = await db.User.find(query)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.User.countDocuments(query);

        return RESPONSE.success(res, 200, 1001, { users, total, page: Number(page) });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Only Active Users (Role: User)
exports.getActiveUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        // Exclude Experts/Admins AND Deleted users
        const query = { isDeleted: false, role: 'user' };

        const users = await db.User.find(query)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.User.countDocuments(query);

        return RESPONSE.success(res, 200, 1001, { users, total, page: Number(page) });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Soft-Deleted Users (Role: User)
exports.getDeletedUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        // Search deleted users who were previously 'user' role
        const query = { isDeleted: true, role: 'user' };

        const users = await db.User.find(query)
            .sort({ deletedAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.User.countDocuments(query);

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

// Toggle User as Expert (Promote/Demote)
exports.toggleUserExpertStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            isExpert,
            caseId,
            caseCategories,
            specializations,
            maxCaseload
        } = req.body; 

        const user = await db.User.findById(userId);
        if (!user) return RESPONSE.error(res, 404, 3001, 'User not found');

        if (!isExpert && user.isExpert) {
            return RESPONSE.error(res, 400, 1007, 'Expert status cannot be removed once granted. Please use the Block User feature if you wish to restrict access.');
        }

        user.isExpert = !!isExpert;
        user.role = isExpert ? 'expert' : 'user';
        if (isExpert) {
            user.isExpertApplicant = false;
        }
        await user.save();

        if (isExpert) {
            let expert = await db.RiskAuditorRegistry.findOne({ email: user.email });

            const auditorName = user.fullName || user.name || 'Expert Auditor';
            const finalSpecializations = specializations || ["Generalist"];
            
            // Handle caseCategories (allow both array and single caseId string for flexibility)
            let categories = [];
            if (Array.isArray(caseCategories)) {
                categories = caseCategories;
            } else if (caseCategories) {
                categories = [caseCategories];
            } else if (caseId) {
                categories = [caseId];
            } else {
                categories = ['GENERAL'];
            }

            const expertConfig = {
                auditorName,
                email: user.email,
                caseCategories: categories,
                specializations: finalSpecializations,
                maxCaseload: maxCaseload || 20,
                isActive: true,
                status: 'ACTIVE'
            };

            if (!expert) {
                expertConfig.auditorId = `EXP_${Math.floor(Date.now() / 1000)}_${Math.floor(1000 + Math.random() * 9000)}`;
                expertConfig.password = await bcrypt.hash('Expert@Hks123!', 10);
                await db.RiskAuditorRegistry.create(expertConfig);
            } else {
                await db.RiskAuditorRegistry.updateOne(
                    { email: user.email },
                    { $set: expertConfig }
                );
            }
        }

        const msg = isExpert ? 'Promoted to Expert with specific Categories/Specializations' : 'Expert status confirmed';
        return RESPONSE.success(res, 200, 1001, {
            message: `User role updated. ${msg}`,
            userId: user._id,
            isExpert: user.isExpert,
            caseCategories: isExpert ? (caseCategories || caseId) : undefined
        });
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

// ─────────────────────────────────────────────────────────────────────────────
// AI TRAINING DATA — Rate a Report (Gold Standard Labelling)
// POST /api/v1/admin/reports/:rasId/rate
// ─────────────────────────────────────────────────────────────────────────────
// Admin kisi bhi completed report ko 1-5 stars de sakta hai.
// Star 5 = "Gold Standard" → ye report AI ko training context ke roop mein
// report generation ke waqt diya jaata hai (RAG pattern).
// ─────────────────────────────────────────────────────────────────────────────
exports.rateReport = async (req, res) => {
    try {
        const { rasId } = req.params;
        const { rating } = req.body;

        // Validate rating
        const parsedRating = Number(rating);
        if (!parsedRating || parsedRating < 1 || parsedRating > 5 || !Number.isInteger(parsedRating)) {
            return RESPONSE.error(res, 400, 1002, 'Rating must be an integer between 1 and 5');
        }

        // Find the RAS artifact
        const rasDoc = await db.Ras.findOne({ rasId, artifactType: 'FINAL_REPORT' });
        if (!rasDoc) {
            return RESPONSE.error(res, 404, 3001, 'Report RAS artifact not found. Ensure rasId is correct and artifact is a FINAL_REPORT.');
        }

        // Save the rating
        rasDoc.qualityRating = parsedRating;
        rasDoc.qualityRatedBy = req.user.id;
        rasDoc.qualityRatedAt = new Date();
        await rasDoc.save();

        const label = parsedRating === 5
            ? '⭐ Gold Standard — AI will use this as training context'
            : `Rated ${parsedRating}/5`;

        return RESPONSE.success(res, 200, 1001, {
            message: `Report rated successfully. ${label}`,
            rasId,
            qualityRating: parsedRating,
            isGoldStandard: parsedRating === 5
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * PHASE 3: AUDIT FLOW REFINEMENT
 * Submit Expert Review (Verdict Override + Deep Comments)
 * POST /api/v1/admin/reports/:runId/audit-finalize
 */
exports.submitExpertReview = async (req, res) => {
    try {
        const { runId } = req.params;
        const { verdictOverride, auditComments, rating, expertId } = req.body;

        if (!auditComments) {
            return RESPONSE.error(res, 400, 1002, 'Audit comments are required for finalization');
        }

        // 1. Find the Run
        const run = await db.Runs.findOne({ runId });
        if (!run) return RESPONSE.error(res, 404, 3001, 'Run not found');

        // 2. Create/Update EXPERT_REVIEW Artifact in RAS
        const reviewArtifact = await db.Ras.create({
            rasId: `RAS_REV_${runId}_${Date.now()}`,
            runId,
            artifactType: 'EXPERT_REVIEW',
            status: 'FINAL',
            artifactJson: {
                verdictOverride: verdictOverride || run.verdict,
                originalVerdict: run.verdict,
                comments: auditComments,
                reviewedBy: req.user.id,
                reviewRole: req.user.role,
                assignedExpertId: expertId || run.expertId // Track which expert was assigned during this review
            },
            qualityRating: rating || null,
            qualityRatedBy: req.user.id,
            qualityRatedAt: new Date()
        });

        // 3. Update Run with Override and SLA completion
        const updateData = {
            expertReviewedAt: new Date(),
            status: 'REPORT_COMPLETE'
        };

        if (expertId) {
            updateData.expertId = expertId;
            updateData.expertAssignedAt = new Date();
        }

        if (verdictOverride) {
            updateData.verdict = verdictOverride;
        }

        await db.Runs.updateOne({ runId }, { $set: updateData });

        // --- NEW: Auditor Review Complete Notification (#6) ---
        try {
            const user = await db.User.findById(run.userId);
            if (user) {
                await notificationService.notifyAuditorReviewComplete(runId, user);
            }
        } catch (notifErr) {
            console.error('[Admin-Notify] Failed to send review completion alert:', notifErr.message);
        }

        return RESPONSE.success(res, 200, 1001, {
            message: 'Expert review submitted and case finalized',
            runId,
            finalVerdict: verdictOverride || run.verdict,
            reviewRasId: reviewArtifact.rasId
        });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI TRAINING DATA — Get All Rated Reports (Leaderboard)
// GET /api/v1/admin/reports/rated
// ─────────────────────────────────────────────────────────────────────────────
exports.getRatedReports = async (req, res) => {
    try {
        const { minRating = 1, caseId, intentId, page = 1, limit = 20 } = req.query;

        const filter = {
            artifactType: 'FINAL_REPORT',
            qualityRating: { $gte: Number(minRating), $ne: null }
        };

        if (caseId) filter['artifactJson.caseId'] = caseId;
        if (intentId) filter['artifactJson.intentId'] = intentId;

        const reports = await db.Ras.find(filter)
            .select('rasId runId artifactJson.caseId artifactJson.intentId artifactJson.verdict artifactJson.accuracyScore qualityRating qualityRatedAt qualityRatedBy createdAt')
            .sort({ qualityRating: -1, createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.Ras.countDocuments(filter);
        const goldStandardCount = await db.Ras.countDocuments({ ...filter, qualityRating: 5 });

        return RESPONSE.success(res, 200, 1001, {
            reports,
            total,
            goldStandardCount,
            page: Number(page),
            tip: 'Gold Standard reports (rating=5) are automatically used as AI context during report generation.'
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN REVIEW — Get Complete Report Package for Rating
// GET /api/v1/admin/reports/:runId/review
// ─────────────────────────────────────────────────────────────────────────────

exports.getReportForReview = async (req, res) => {
    try {
        const { runId } = req.params;

        // 1. Run & basic meta
        const run = await db.Runs.findOne({ runId }).lean();
        if (!run) return RESPONSE.error(res, 404, 3010, `Run with ID ${runId} doesn't exist`);

        // 2. User info
        const user = await db.User.findById(run.userId).select('name email phone createdAt').lean();

        // 3. CV — Parsed Profile (Step 2 RAS)
        const profileRas = await db.Ras.findOne({
            runId,
            artifactType: 'PROFILE_CONFIRMED',
            status: 'FINAL'
        }).lean();

        const cvProfile = profileRas?.artifactJson?.confirmedProfile
            || profileRas?.artifactJson?.profile
            || profileRas?.artifactJson?.parsedData
            || run.cvSnapshot?.parsedData   // fallback
            || null;

        // CV URL (for viewing raw PDF if needed)
        const cvUrl = run.cvSnapshot?.cvUrl || null;
        const cvSource = run.cvSnapshot?.source || null; // 'EXISTING' or 'REUPLOADED'

        // 4. User Answers (all Q&A batches — Step 3)
        const allAnswerRas = await db.Ras.find({
            runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            status: 'FINAL'
        }).lean();
        const allAnswers = allAnswerRas.flatMap(r => r.artifactJson?.answers || []);

        // Enrich answers with question text for readability
        const questionIds = allAnswers.map(a => a.questionId);
        const questionDocs = await db.Questions.find({ questionId: { $in: questionIds } })
            .select('questionId questionText questionType optionsJson')
            .lean();
        const questionsMap = {};
        for (const q of questionDocs) questionsMap[q.questionId] = q;

        const enrichedAnswers = allAnswers.map(ans => ({
            questionId: ans.questionId,
            questionText: questionsMap[ans.questionId]?.questionText || ans.questionId,
            questionType: questionsMap[ans.questionId]?.questionType || 'UNKNOWN',
            answer: ans.answerLabel || ans.answerValue
        }));

        // 5. Integrity Pack (Step 4)
        const integrityRas = await db.Ras.findOne({
            runId,
            artifactType: 'INTEGRITY_PACK',
            status: 'FINAL'
        }).lean();
        const integrityPack = integrityRas?.artifactJson || null;

        // 6. External Signals (Step 5)
        const signalsRas = await db.Ras.findOne({
            runId,
            artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
            status: 'FINAL'
        }).lean();
        const externalSignals = signalsRas?.artifactJson?.signals || null;

        // 7. Final Report + current rating
        const reportRas = await db.Ras.findOne({
            runId,
            artifactType: 'FINAL_REPORT',
            status: 'FINAL'
        }).select('rasId artifactJson qualityRating qualityRatedBy qualityRatedAt createdAt').lean();

        if (!reportRas) {
            // Log for debug but don't crash, but if we did error, we'd use 3011
            console.log(`[Admin-Review] Report Pending: Showing partial preview for Run ${runId}`);
        }

        // ── Build Review Package ──
        return RESPONSE.success(res, 200, 1001, {
            reviewPackage: {
                // Meta
                runId,
                rasId: reportRas?.rasId || null,
                caseId: run.caseId,
                intentId: run.intentId,
                runStatus: run.status,
                generatedAt: reportRas?.createdAt || null,
                isReRun: !!run.previousRunId,
                previousRunId: run.previousRunId || null,

                // User
                user: user || { note: 'User data not found' },

                // CV & Profile
                cv: {
                    parsedProfile: cvProfile,
                    cvUrl,
                    cvSource,
                    note: cvUrl
                        ? 'Use cvUrl to open the raw PDF'
                        : 'No CV URL available (profile was built via questions only)'
                },

                // Q&A
                questionnaire: {
                    totalAnswers: enrichedAnswers.length,
                    answers: enrichedAnswers
                },

                // Integrity
                integrity: integrityPack
                    ? {
                        accuracyScore: integrityPack.accuracy?.score || 0,
                        accuracyBand: integrityPack.accuracy?.band || 'UNKNOWN',
                        totalPenalty: integrityPack.accuracy?.totalPenalty || 0,
                        redFlags: integrityPack.redFlags?.triggered || [],
                        contradictions: integrityPack.contradictions?.triggered || [],
                        hasTerminalFailure: integrityPack.hasTerminalFailure || false,
                        warnings: integrityPack.warnings || []
                    }
                    : { note: 'Integrity data not available' },

                // Market Signals
                externalSignals: externalSignals || { note: 'No external signals captured' },

                // Generated Report
                report: {
                    verdict: reportRas?.artifactJson?.verdict || 'PENDING',
                    accuracyScore: reportRas?.artifactJson?.accuracyScore || 0,
                    accuracyBand: reportRas?.artifactJson?.accuracyBand || 'UNKNOWN',
                    sections: reportRas?.artifactJson?.sections || [],
                    redFlags: reportRas?.artifactJson?.redFlags || [],
                    warnings: reportRas?.artifactJson?.warnings || []
                },

                // Re-Run Policy Setup
                reRunSetup: run.reRunSetup || {
                    eligibleForFreeReRun: false,
                    freeReRunExpiryDate: null,
                    reRunPriceOverride: null
                },

                // Current Rating (null if not yet rated)
                currentRating: {
                    rating: reportRas?.qualityRating || null,
                    ratedBy: reportRas?.qualityRatedBy || null,
                    ratedAt: reportRas?.qualityRatedAt || null,
                    isGoldStandard: reportRas?.qualityRating === 5
                },

                // Admin Tip
                ratingGuide: {
                    5: 'Gold Standard — Verdict correct, advice specific, data fully reflected in report',
                    4: 'Good — Minor gaps but overall accurate',
                    3: 'Average — Verdict ok but advice is generic',
                    2: 'Poor — Advice not aligned with user data',
                    1: 'Fail — Wrong verdict or report does not reflect user situation'
                }
            }
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN REVIEW — List All Completed Runs (Pending + Rated)
// GET /api/v1/admin/reports/runs

exports.getAllCompletedRuns = async (req, res) => {
    try {
        const { rated, caseId, intentId, page = 1, limit = 20 } = req.query;

        // Build Run filter — Default is REPORT_COMPLETE for reports tab, 
        // but 'all' for the Operations Pipeline board.
        const runFilter = (rated === 'all' || req.query.status === 'all') 
            ? {} 
            : { status: 'REPORT_COMPLETE' };
            
        if (caseId) runFilter.caseId = caseId;
        if (intentId) runFilter.intentId = intentId;

        const runs = await db.Runs.find(runFilter)
            .select('runId userId caseId intentId status verdict previousRunId createdAt updatedAt')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        // Get rating status for each run in one query
        const runIds = runs.map(r => r.runId);
        const reportRasList = await db.Ras.find({
            runId: { $in: runIds },
            artifactType: 'FINAL_REPORT',
            status: 'FINAL'
        }).select('runId rasId qualityRating qualityRatedAt').lean();

        const ratingMap = {};
        for (const ras of reportRasList) ratingMap[ras.runId] = ras;

        // Build response list with rating info
        let result = runs.map(run => ({
            runId: run.runId,
            rasId: ratingMap[run.runId]?.rasId || null,
            caseId: run.caseId,
            intentId: run.intentId,
            verdict: run.verdict,
            isReRun: !!run.previousRunId,
            createdAt: run.createdAt,
            rating: ratingMap[run.runId]?.qualityRating || null,
            ratedAt: ratingMap[run.runId]?.qualityRatedAt || null,
            isGoldStandard: ratingMap[run.runId]?.qualityRating === 5,
            reviewUrl: `/api/v1/admin/reports/${run.runId}/review`  // direct link
        }));

        // Filter by rated status if requested
        if (rated === 'true') result = result.filter(r => r.rating !== null);
        if (rated === 'false') result = result.filter(r => r.rating === null);

        const total = await db.Runs.countDocuments(runFilter);
        const pendingRating = result.filter(r => r.rating === null).length;

        return RESPONSE.success(res, 200, 1001, {
            runs: result,
            total,
            page: Number(page),
            pendingRatingCount: pendingRating,
            tip: 'Use reviewUrl to fetch the full review package for any run, then rate it.'
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Update Re-Run Policy for a Specific Run (Admin only)
exports.updateReRunPolicy = async (req, res) => {
    try {
        const { runId } = req.params;
        const { eligibleForFreeReRun, freeReRunExpiryDate, reRunPriceOverride } = req.body;

        const run = await db.Runs.findOne({ runId });
        if (!run) return RESPONSE.error(res, 404, 3001, 'Run not found');

        // Initialize reRunSetup if default didn't kick in
        if (!run.reRunSetup) {
            run.reRunSetup = {
                eligibleForFreeReRun: false,
                freeReRunExpiryDate: null,
                reRunPriceOverride: null
            };
        }

        if (eligibleForFreeReRun !== undefined) run.reRunSetup.eligibleForFreeReRun = eligibleForFreeReRun;

        if (freeReRunExpiryDate !== undefined) {
            let parsedDate = null;
            if (freeReRunExpiryDate && typeof freeReRunExpiryDate === 'string' && freeReRunExpiryDate.includes('/')) {
                const parts = freeReRunExpiryDate.split(' ');
                const datePart = parts[0];
                const timePart = parts[1] || '00:00';
                const [day, month, year] = datePart.split('/');
                parsedDate = new Date(`${year}-${month}-${day}T${timePart}:00`);
            } else {
                parsedDate = freeReRunExpiryDate ? new Date(freeReRunExpiryDate) : null;
            }

            // --- Validation: Don't allow setting a date in the past ---
            if (parsedDate && parsedDate < new Date()) {
                return RESPONSE.error(res, 400, 1002, "Expiry date cannot be in the past. Please select a future time.");
            }

            run.reRunSetup.freeReRunExpiryDate = parsedDate;
        }

        if (reRunPriceOverride !== undefined) {
            run.reRunSetup.reRunPriceOverride = reRunPriceOverride === null ? null : Number(reRunPriceOverride);
        }

        run.markModified('reRunSetup');
        await run.save();

        // PUSH NOTIFICATION: Trigger if it's explicitly unlocked for free
        if (eligibleForFreeReRun === true) {
            const notificationService = require('../services/notificationService');
            await notificationService.notifyReRunAvailable(runId);
        }

        return RESPONSE.success(res, 200, 1001, {
            message: 'Re-run policy updated successfully and user notified',
            runId,
            reRunSetup: run.reRunSetup
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// --- Expert Management (Admin/Sub-Admin Only) ---

// Create a New Expert (Risk Auditor)
exports.createExpert = async (req, res) => {
    try {
        const { auditorId, auditorName, email, password, caseId, specializations, maxCaseload } = req.body;

        if (!auditorId || !auditorName || !email || !password || !caseId) {
            return RESPONSE.error(res, 400, 1002, 'All primary fields (ID, Name, Email, Password, CaseId) are required');
        }

        const existingExpert = await db.RiskAuditorRegistry.findOne({ $or: [{ email }, { auditorId }] });
        if (existingExpert) {
            return RESPONSE.error(res, 400, 1003, 'Expert with this Email or AuditorID already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newExpert = await db.RiskAuditorRegistry.create({
            auditorId,
            auditorName,
            email,
            password: hashedPassword,
            caseId,
            specializations: specializations || [],
            maxCaseload: maxCaseload || 20,
            isActive: true
        });

        const expertResponse = newExpert.toObject();
        delete expertResponse.password;

        return RESPONSE.success(res, 201, 1004, {
            message: 'Expert created successfully',
            expert: expertResponse
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get All Registered Experts
exports.getAllExperts = async (req, res) => {
    try {
        const experts = await db.RiskAuditorRegistry.find().select('-password -refreshToken').sort({ createdAt: -1 });
        return RESPONSE.success(res, 200, 1001, { total: experts.length, experts });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Delete Expert
exports.deleteExpert = async (req, res) => {
    try {
        const { id } = req.params; // Using MongoDB _id
        const deleted = await db.RiskAuditorRegistry.findByIdAndDelete(id);
        if (!deleted) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        return RESPONSE.success(res, 200, 1001, { message: 'Expert removed successfully' });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Update Existing Expert
exports.updateExpert = async (req, res) => {
    try {
        const { id } = req.params; // Expert's MongoDB _id
        const { auditorName, caseId, specializations, maxCaseload, isActive, status } = req.body;

        const expert = await db.RiskAuditorRegistry.findById(id);
        if (!expert) return RESPONSE.error(res, 404, 1005, 'Expert not found');

        // Build update object
        const updateData = {};
        if (auditorName) updateData.auditorName = auditorName;
        if (caseId) updateData.caseId = caseId;
        if (specializations) updateData.specializations = specializations;
        if (maxCaseload !== undefined) updateData.maxCaseload = maxCaseload;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (status) updateData.status = status;

        const updatedExpert = await db.RiskAuditorRegistry.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        ).select('-password -refreshToken');

        return RESPONSE.success(res, 200, 1001, {
            message: 'Expert details updated successfully',
            expert: updatedExpert
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * GET — CV Processing Audit Logs for Admin
 * Supports: Pagination, Status filter, Search by Email
 */
exports.getCvAuditLogs = async (req, res) => {
    try {
        const { status, email, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build base aggregation pipeline to filter deleted users
        const pipeline = [
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            { $match: { 'user.isDeleted': false } }
        ];

        // Add status filter if provided
        if (status) {
            pipeline.push({ $match: { parserStatus: status } });
        }

        // Add email search if provided
        if (email) {
            pipeline.push({ $match: { 'user.email': new RegExp(email, 'i') } });
        }

        // Count total matching records for pagination
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await db.DocumentUploads.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        // Fetch paginated logs
        pipeline.push({ $sort: { createdAt: -1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: parseInt(limit) });

        const logs = await db.DocumentUploads.aggregate(pipeline);

        // Bulk fetch UserProfiles for the filtered logs
        const userIds = logs.map(l => l.userId);
        const profiles = await db.UserProfile.find({ userId: { $in: userIds } }).lean();
        const profileMap = {};
        profiles.forEach(p => profileMap[p.userId.toString()] = p);

        const formattedLogs = logs.map(l => {
            const profile = profileMap[l.userId.toString()];
            const confirmedName = profile?.confirmedProfile?.identity?.fullName || 
                                 profile?.originalParsedData?.structured?.identity?.fullName;

            return {
                id: l._id,
                userName: confirmedName || 
                          l.user?.fullName || 
                          l.user?.name || 
                          l.parsedCvData?.identity?.fullName || 
                          l.parsedCvData?.name || 
                          'Anonymous User',
                email: l.user?.email || 'N/A',
                fileName: l.fileName,
                status: l.parserStatus,
                errorReason: l.errorReason,
                metadata: l.parserMetadata,
                uploadedAt: l.uploadedAt || l.createdAt
            };
        });

        const response = {
            logs: formattedLogs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        };

        return res.status(200).json({ success: true, data: response });

    } catch (error) {
        console.error('[Admin CV Audit Error]', error);
        return res.status(500).json({ success: false, message: "Failed to fetch CV audit logs." });
    }
};
/**
 * API — Securely Download Invoice from S3
 */
const { GetObjectCommand } = require('@aws-sdk/client-s3');

exports.downloadInvoiceS3 = async (req, res) => {
    try {
        const { runId } = req.params;
        const invoice = await db.Invoice.findOne({ runId });
        if (!invoice || !invoice.pdfUrl) return res.status(404).json({ success: false, message: 'Invoice not found on S3.' });

        const key = `invoices/${invoice.invoiceNumber}.pdf`;
        
        // 1. Get from S3 as Stream
        const { Body, ContentType } = await s3Service.getFileStream(key);
        
        // 2. Set Headers for Direct Download
        res.setHeader('Content-Type', ContentType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
        
        // 3. Pipe the S3 stream to Response
        return Body.pipe(res);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.downloadReportS3 = async (req, res) => {
    try {
        const { runId } = req.params;
        const run = await db.Runs.findOne({ runId });
        if (!run || !run.reportPdfUrl) return res.status(404).json({ success: false, message: 'Report PDF not found on S3.' });

        const key = `reports/Report_${runId}.pdf`;
        
        // 1. Get from S3 as Stream
        const { Body, ContentType } = await s3Service.getFileStream(key);
        
        // 2. Set Headers
        res.setHeader('Content-Type', ContentType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Report_${runId}.pdf`);
        
        return Body.pipe(res);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PHASE 2: Signal Volume Summary for Analytics Dashboard
 * GET /api/v1/admin/signals/summary
 */
exports.getSignalVolumeSummary = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 1. Domain-wise Distribution (based on caseId)
        const domainDist = await db.ExternalEvidenceDataPool.aggregate([
            { $group: { _id: "$caseId", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // 2. Daily Ingestion Trend (Last 7 Days)
        const trend = await db.ExternalEvidenceDataPool.aggregate([
            { $match: { fetchedAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$fetchedAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 3. Source Distribution
        const sourceDist = await db.ExternalEvidenceDataPool.aggregate([
            { $group: { _id: "$sourceId", count: { $sum: 1 } } },
            { $limit: 10 },
            { $sort: { count: -1 } }
        ]);

        // 4. Overalls
        const totalSignals = await db.ExternalEvidenceDataPool.countDocuments();
        const freshSignals = await db.ExternalEvidenceDataPool.countDocuments({ 
            freshnessExpiresAt: { $gt: new Date() } 
        });

        return RESPONSE.success(res, 200, 1001, {
            summary: {
                total: totalSignals,
                fresh: freshSignals,
                inactive: totalSignals - freshSignals
            },
            charts: {
                domainDistribution: domainDist,
                sourceDistribution: sourceDist,
                sevenDayTrend: trend
            }
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * PHASE 2: Financial Ledger API
 * GET /api/v1/admin/payments/all
 */
exports.getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const payments = await db.Payments.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        const total = await db.Payments.countDocuments(filter);

        return RESPONSE.success(res, 200, 1001, {
            payments,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * PHASE 2: Export All Payments as CSV
 * GET /api/v1/admin/payments/export
 */
exports.exportPaymentsCSV = async (req, res) => {
    try {
        const payments = await db.Payments.find({}).sort({ createdAt: -1 }).lean();
        
        // CSV Headers - Updated to be more clear
        let csv = 'Date,PaymentId,PurchaseId/GatewayID,Amount,Currency,Status,Gateway,CaseId,UserId\n';
        
        payments.forEach(p => {
            const rawDate = p.verifiedAt || p.createdAt || null;
            const date = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : 'N/A';
            const gateway = p.paymentMethod || 'Stripe';
            csv += `${date},${p.paymentId},${p.purchaseId || 'N/A'},${p.amount},${p.currency || 'INR'},${p.status},${gateway},${p.caseId},${p.userId}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=Hawksyn_Transactions.csv');
        
        return res.status(200).send(csv);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
