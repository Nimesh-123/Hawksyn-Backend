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
            specializations, 
            maxCaseload 
        } = req.body; // Accept professional details from admin

        const user = await db.User.findById(userId);
        if (!user) return RESPONSE.error(res, 404, 3001, 'User not found');

        // Check if user is already an expert and we're trying to set to false
        if (!isExpert && user.isExpert) {
            return RESPONSE.error(res, 400, 1007, 'Expert status cannot be removed once granted. Please use the Block User feature if you wish to restrict access.');
        }

        // Update User Role/Flag
        user.isExpert = !!isExpert;
        user.role = isExpert ? 'expert' : 'user';
        await user.save();

        if (isExpert) {
            // Check if they already exist in RiskAuditorRegistry
            let expert = await db.RiskAuditorRegistry.findOne({ email: user.email });
            
            // --- Basic Mapping (Manual Admin Data) ---
            const auditorName = user.fullName || user.name || 'Expert Auditor';
            const finalSpecializations = specializations || ["Generalist"];

            const expertConfig = {
                auditorName, 
                email: user.email,
                caseId: caseId || 'GENERAL', 
                specializations: finalSpecializations,
                maxCaseload: maxCaseload || 20,
                isActive: true,
                status: 'ACTIVE'
            };

            if (!expert) {
                // Generate a skeleton expert record (ID: EXP_timestamp_rand)
                expertConfig.auditorId = `EXP_${Math.floor(Date.now() / 1000)}_${Math.floor(1000 + Math.random() * 9000)}`;
                
                // Set default placeholder password
                expertConfig.password = await bcrypt.hash('Expert@Hks123!', 10); 

                await db.RiskAuditorRegistry.create(expertConfig);
            } else {
                // Update and reactive existing expert record with new settings
                await db.RiskAuditorRegistry.updateOne(
                    { email: user.email },
                    { $set: expertConfig }
                );
            }
        }

        const msg = isExpert ? 'Promoted to Expert with specific Case/Specialization' : 'Expert status confirmed';
        return RESPONSE.success(res, 200, 1001, { 
            message: `User role updated. ${msg}`,
            userId: user._id,
            isExpert: user.isExpert
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
        rasDoc.qualityRating  = parsedRating;
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

        if (caseId)   filter['artifactJson.caseId']   = caseId;
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
// Admin ek hi API call mein pura data dekhta hai:
//   ✅ User info (name, email)
//   ✅ CV / Parsed Profile (skills, experience, current role, etc.)
//   ✅ User ke saare Q&A answers
//   ✅ Integrity Score + Red Flags + Contradictions
//   ✅ External Market Signals
//   ✅ Generated Report (all sections + verdict)
//   ✅ Current rating (agar pehle de chuka hai)
// ─────────────────────────────────────────────────────────────────────────────
exports.getReportForReview = async (req, res) => {
    try {
        const { runId } = req.params;

        // 1. Run & basic meta
        const run = await db.Runs.findOne({ runId }).lean();
        if (!run) return RESPONSE.error(res, 404, 3001, `Run not found: ${runId}`);

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
            questionId:   ans.questionId,
            questionText: questionsMap[ans.questionId]?.questionText || ans.questionId,
            questionType: questionsMap[ans.questionId]?.questionType || 'UNKNOWN',
            answer:       ans.answerLabel || ans.answerValue
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

        if (!reportRas) return RESPONSE.error(res, 404, 3001, 'Report not yet generated for this run.');

        // ── Build Review Package ──
        return RESPONSE.success(res, 200, 1001, {
            reviewPackage: {
                // Meta
                runId,
                rasId:      reportRas.rasId,
                caseId:     run.caseId,
                intentId:   run.intentId,
                runStatus:  run.status,
                generatedAt: reportRas.createdAt,
                isReRun:    !!run.previousRunId,
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
                        accuracyScore:      integrityPack.accuracy?.score || 0,
                        accuracyBand:       integrityPack.accuracy?.band  || 'UNKNOWN',
                        totalPenalty:       integrityPack.accuracy?.totalPenalty || 0,
                        redFlags:           integrityPack.redFlags?.triggered || [],
                        contradictions:     integrityPack.contradictions?.triggered || [],
                        hasTerminalFailure: integrityPack.hasTerminalFailure || false,
                        warnings:           integrityPack.warnings || []
                    }
                    : { note: 'Integrity data not available' },

                // Market Signals
                externalSignals: externalSignals || { note: 'No external signals captured' },

                // Generated Report
                report: {
                    verdict:       reportRas.artifactJson?.verdict || 'UNKNOWN',
                    accuracyScore: reportRas.artifactJson?.accuracyScore || 0,
                    accuracyBand:  reportRas.artifactJson?.accuracyBand  || 'UNKNOWN',
                    sections:      reportRas.artifactJson?.sections || [],
                    redFlags:      reportRas.artifactJson?.redFlags || [],
                    warnings:      reportRas.artifactJson?.warnings || []
                },

                // Current Rating (null if not yet rated)
                currentRating: {
                    rating:       reportRas.qualityRating   || null,
                    ratedBy:      reportRas.qualityRatedBy  || null,
                    ratedAt:      reportRas.qualityRatedAt  || null,
                    isGoldStandard: reportRas.qualityRating === 5
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
// ─────────────────────────────────────────────────────────────────────────────
// Admin ko pata chale kaunse runs review ke liye available hain.
// Optionally filter by: rated=true/false, caseId, intentId
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllCompletedRuns = async (req, res) => {
    try {
        const { rated, caseId, intentId, page = 1, limit = 20 } = req.query;

        // Build Run filter
        const runFilter = { status: 'REPORT_COMPLETE' };
        if (caseId)   runFilter.caseId   = caseId;
        if (intentId) runFilter.intentId = intentId;

        const runs = await db.Runs.find(runFilter)
            .select('runId userId caseId intentId status verdict previousRunId createdAt')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        // Get rating status for each run in one query
        const runIds = runs.map(r => r.runId);
        const reportRasList = await db.Ras.find({
            runId:        { $in: runIds },
            artifactType: 'FINAL_REPORT',
            status:       'FINAL'
        }).select('runId rasId qualityRating qualityRatedAt').lean();

        const ratingMap = {};
        for (const ras of reportRasList) ratingMap[ras.runId] = ras;

        // Build response list with rating info
        let result = runs.map(run => ({
            runId:        run.runId,
            rasId:        ratingMap[run.runId]?.rasId || null,
            caseId:       run.caseId,
            intentId:     run.intentId,
            verdict:      run.verdict,
            isReRun:      !!run.previousRunId,
            createdAt:    run.createdAt,
            rating:       ratingMap[run.runId]?.qualityRating || null,
            ratedAt:      ratingMap[run.runId]?.qualityRatedAt || null,
            isGoldStandard: ratingMap[run.runId]?.qualityRating === 5,
            reviewUrl:    `/api/v1/admin/reports/${run.runId}/review`  // direct link
        }));

        // Filter by rated status if requested
        if (rated === 'true')  result = result.filter(r => r.rating !== null);
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
            run.reRunSetup.freeReRunExpiryDate = freeReRunExpiryDate ? new Date(freeReRunExpiryDate) : null;
        }

        if (reRunPriceOverride !== undefined) {
            run.reRunSetup.reRunPriceOverride = reRunPriceOverride === null ? null : Number(reRunPriceOverride);
        }

        run.markModified('reRunSetup');
        await run.save();

        return RESPONSE.success(res, 200, 1001, {
            message: 'Re-run policy updated successfully',
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

        // Using global db import from top of file
        
        let query = {};
        

        if (status) {
            query.parserStatus = status;
        }


        if (email) {
            const user = await db.User.findOne({ email: new RegExp(email, 'i') });
            if (user) {
                query.userId = user._id;
            } else {
                return res.status(200).json({
                    success: true,
                    data: {
                        logs: [],
                        pagination: { total: 0, page: parseInt(page), pages: 0 }
                    }
                });
            }
        }

        const total = await db.DocumentUploads.countDocuments(query);
        const logs = await db.DocumentUploads.find(query)
            .populate('userId', 'name email mobile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();


        const formattedLogs = logs.map(l => ({
            id: l._id,
            userName: l.userId?.name || 'Deleted User',
            email: l.userId?.email || 'N/A',
            fileName: l.fileName,
            status: l.parserStatus,
            errorReason: l.errorReason,
            metadata: l.parserMetadata,
            uploadedAt: l.uploadedAt || l.createdAt
        }));

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
