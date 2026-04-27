const { db } = require('../models/index.model.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RESPONSE = require('../../utils/response.js');
const { generateOTP } = require('../../utils/function.js');
const { createAuditLog } = require('../../utils/auditLogger.js');
const { uploadFile, deleteFile } = require('../../utils/s3');
const { smartCVParser } = require('../../utils/aiParser');
const { getUserActiveCv } = require('../../utils/cvHelper.js');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { detectRegionFromIP } = require('../../utils/regionHelper.js');


const prepareUserResponse = async (user) => {
    const userActiveCv = await getUserActiveCv(user._id);
    const userResponse = user.toObject();
    
    if (userActiveCv) {
        userResponse.cvUrl = userActiveCv.cvUrl;
        userResponse.cvUploadedAt = userActiveCv.cvUploadedAt;
        userResponse.parsedCvData = userActiveCv.parsedCvData;
    }
    
    delete userResponse.mPin;
    delete userResponse.refreshToken;
    return userResponse;
};

const generateToken = (payload) => {
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_REFRESH || 'refresh_secret', { expiresIn: '365d' });
    return { accessToken, refreshToken };
};

exports.sendOTP = async (req, res) => {
    try {
        const email = req.body.email || req.query.email;
        if (!email) return RESPONSE.error(res, 400, 1003, "Email is required");

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await db.OTP.findOneAndUpdate(
            { email },
            { otp: otpHash, expiresAt, failCount: 0 },
            { upsert: true, new: true }
        );

        console.log(`[DEV Auth] OTP for ${email}: ${otp} (Valid for 5 mins)`);

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const sendEmail = require('../../utils/email.js');
                await sendEmail({
                    email,
                    subject: 'Your Hawksyn OTP Verification Code',
                    message: `Your OTP is ${otp}. It will expire in 5 minutes.`,
                    html: `<b>Your OTP is ${otp}</b><p>It will expire in 5 minutes.</p>`
                });
            } catch (e) { console.error("[Mail] Failed:", e.message); }
        }

        return RESPONSE.success(res, 200, 2003, { email });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const otpRecord = await db.OTP.findOne({ email });
        if (!otpRecord) return RESPONSE.error(res, 404, 3003, "OTP expired or not found.");

        if (otpRecord.failCount >= 3) return RESPONSE.error(res, 403, 3008, "Too many failed attempts. Please request a new OTP.");

        const isMatch = await bcrypt.compare(otp, otpRecord.otp);
        if (!isMatch) {
            otpRecord.failCount += 1;
            await otpRecord.save();
            return RESPONSE.error(res, 400, 3002);
        }

        let user = await db.User.findOne({ email, isDeleted: false });
        let isNewUser = false;
        
        if (!user) {
            user = new db.User({ email });
            isNewUser = true;
        }

        const region = detectRegionFromIP(req.ip);
        user.countryCode = region.countryCode;
        user.preferredCurrency = region.currency;
        user.isEmailVerified = true;
        
        // Save FCM Token if provided during login
        if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;

        otpRecord.isUsed = true;
        otpRecord.expiresAt = new Date();        await otpRecord.save();

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;
        await user.save();

        if (isNewUser) await createAuditLog(req, 'USER_CREATED', user._id, { email: user.email });

        const userResponse = await prepareUserResponse(user);
        return RESPONSE.success(res, 200, 2004, { user: userResponse, ...tokens });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.setPin = async (req, res) => {
    try {
        const { email, mPin, confirmMPin } = req.body;
        if (mPin !== confirmMPin) return RESPONSE.error(res, 400, 3005);
 
        const commonPins = ['1234', '1111', '0000', '1212', '2580', '1379'];
        if (commonPins.includes(mPin)) {
            return RESPONSE.error(res, 400, 3013);
        }

        const user = await db.User.findOne({ email, isDeleted: false });
        if (!user) return RESPONSE.error(res, 404, 3001);

        user.mPin = await bcrypt.hash(mPin, 10);
        user.mPinSet = true;
        user.wrongPinCount = 0;
        user.isBlocked = false;

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;
        await user.save();

        const userResponse = await prepareUserResponse(user);
        await createAuditLog(req, 'MPIN_SET', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 2005, { user: userResponse, ...tokens });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.loginWithPin = async (req, res) => {
    try {
        const { email, mPin } = req.body;
        const user = await db.User.findOne({ email, isDeleted: false });

        if (!user) return RESPONSE.error(res, 404, 3001);
        if (user.isBlocked) return RESPONSE.error(res, 403, 3008);
        if (!user.mPin) return RESPONSE.error(res, 400, 3004, "M-PIN not set");

        if (!(await bcrypt.compare(mPin, user.mPin))) {
            user.wrongPinCount += 1;
            if (user.wrongPinCount >= 5) user.isBlocked = true;
            await user.save();
            return RESPONSE.error(res, 401, 3004);
        }

        user.wrongPinCount = 0;
        const region = detectRegionFromIP(req.ip);
        user.countryCode = region.countryCode;
        user.preferredCurrency = region.currency;
        
        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;

        // Save FCM Token if provided during login
        if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;

        await user.save();

        const userResponse = await prepareUserResponse(user);
        await createAuditLog(req, 'LOGIN_WITH_PIN', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 2001, { user: userResponse, ...tokens });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return RESPONSE.error(res, 400, 3003, "Google ID Token is required");

        let ticket;
        try {
            ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        } catch (e) { return RESPONSE.error(res, 401, 1002, "Invalid Google Token."); }

        const { email, name, picture, sub: googleId } = ticket.getPayload();

        let user = await db.User.findOne({ email });
        if (user && user.isDeleted) {
            user.isDeleted = false;
            user.deletedAt = null;
        }

        if (!user) {
            user = new db.User({ email, fullName: name, avatar: picture, googleId, isEmailVerified: true, loginType: 'google' });
            const region = detectRegionFromIP(req.ip);
            user.countryCode = region.countryCode;
            user.preferredCurrency = region.currency;
        } else if (!user.googleId) {
            user.googleId = googleId;
            if (!user.avatar) user.avatar = picture;
        }

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;

        // Save FCM Token if provided during login
        if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;

        await user.save();

        const userResponse = await prepareUserResponse(user);
        await createAuditLog(req, 'LOGIN_WITH_GOOGLE', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 2001, { 
            user: userResponse, 
            ...tokens, 
            isNewUser: !user.mPinSet 
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { hardDelete } = req.query;
        const user = await db.User.findById(userId);
        if (!user) return RESPONSE.error(res, 404, 3001);

        if (hardDelete === 'true') {
            const runs = await db.Runs.find({ userId }).select('runId');
            const runIds = runs.map(r => r.runId);

            if (runIds.length > 0) {
                await db.Ras.deleteMany({ runId: { $in: runIds } });
                await db.CaseFile.deleteMany({ runId: { $in: runIds } });
            }

            await db.Runs.deleteMany({ userId });
            await db.Payments.deleteMany({ userId });
            await db.UserProfile.deleteMany({ userId });
            await db.DocumentUploads.deleteMany({ userId });
            await db.UserClocks.deleteMany({ userId });
            await db.ClockHistory.deleteMany({ userId });
            await db.UserCredits.deleteMany({ userId });
            await db.AuditLog.deleteMany({ userId });
            await db.User.findByIdAndDelete(userId);

            return RESPONSE.success(res, 200, 2002, { message: "Account permanently deleted." });
        } else {
            const { reason, comment } = req.body;
            user.isDeleted = true;
            user.deletedAt = new Date();
            user.deletionReason = reason || "No reason provided";
            user.deletionComment = comment || "";
            await user.save();
            await createAuditLog(req, 'ACCOUNT_DELETED', user._id, { email: user.email, reason, comment });
            return RESPONSE.success(res, 200, 2002);
        }
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.forgotPin = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.User.findOne({ email, isDeleted: false });
        if (!user) return RESPONSE.error(res, 404, 3001);

        return exports.sendOTP(req, res);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.uploadCV = async (req, res) => {
    try {
        if (!req.file) return RESPONSE.error(res, 400, 3009, "No file provided.");

        const file = req.file;
        if (file.mimetype !== 'application/pdf') return RESPONSE.error(res, 400, 3009, "Only PDF files allowed.");
        if (file.size > 10 * 1024 * 1024) return RESPONSE.error(res, 400, 3009, "Limit 10MB exceeded.");

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `resumes/${req.user.id}-${uniqueSuffix}.pdf`;
        const uploadRes = await uploadFile(file.buffer, fileName, file.mimetype);
        const fileUrl = uploadRes.url;

        let extractedData = null;
        let parserStatus = "FAILED";
        let errorReason = null;

        try {
            extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype);
            
            if (extractedData && extractedData.isCv === false) {
                await deleteFile(fileName);

                // Save the failed attempt to DocumentUploads for audit tracking
                const userId = req.user.id;
                await db.DocumentUploads.create({
                    userId,
                    fileName: file.originalname,
                    cvUrl: null,
                    parsedCvData: null,
                    parserStatus: 'NOT_A_CV',
                    errorReason: 'Detected as non-CV document.',
                    parserMetadata: extractedData ? {
                        modelUsed: extractedData.modelUsed,
                        duration: extractedData.totalPipelineDuration,
                        tokenUsage: extractedData.tokenUsage
                    } : null,
                    isActive: false
                });

                await createAuditLog(req, 'CV_REJECTED', userId, { reason: 'NOT_A_CV', fileName: file.originalname });

                return RESPONSE.error(res, 400, 3009, "Not a valid CV.");
            }

            if (extractedData) {
                try {
                    const { sanitizeParsedData } = require('../../utils/cvSanitizer.js');
                    extractedData = sanitizeParsedData(extractedData);
                    parserStatus = "SUCCESS";
                } catch (e) { parserStatus = "SUCCESS"; }
            }
        } catch (aiError) { console.error("[AI Fail]", aiError.message); }

        const isExtractionBlank = !extractedData || 
                                (extractedData.aeuList.length < 3 && 
                                 (!extractedData.structured.work?.experience?.length) && 
                                 (!extractedData.structured.composition?.skills?.technical?.length));

        if (isExtractionBlank && parserStatus !== "FAILED") {
            parserStatus = "EMPTY";
            errorReason = "AI returned blank data.";
        }

        if (extractedData && extractedData.isCv === false) {
            parserStatus = "NOT_A_CV";
            errorReason = "Detected as non-CV document.";
        } else if (parserStatus === "FAILED") {
            errorReason = "Pipeline failure.";
        }

        const userId = req.user.id;
        await db.DocumentUploads.updateMany({ userId }, { $set: { isActive: false } });

        const newCv = await db.DocumentUploads.create({
            userId,
            fileName: file.originalname,
            cvUrl: fileUrl,
            parsedCvData: extractedData ? JSON.parse(JSON.stringify(extractedData)) : null,
            parserStatus,
            errorReason,
            parserMetadata: extractedData ? {
                modelUsed: extractedData.modelUsed,
                duration: extractedData.totalPipelineDuration,
                tokenUsage: extractedData.tokenUsage
            } : null,
            isActive: true
        });

        await db.UserProfile.findOneAndUpdate(
            { userId },
            {
                lastCvUploadId: newCv._id,
                cvUrl: fileUrl,
                originalParsedData: newCv.parsedCvData,
                confirmedProfile: null,
                isConfirmed: false
            },
            { upsert: true }
        );

        await createAuditLog(req, 'CV_UPLOADED', userId, { cvUploadId: newCv._id });

        return RESPONSE.success(res, 200, 1001, {
            message: "CV processed successfully",
            cvUrl: fileUrl,
            parsedData: extractedData
        });
    } catch (error) {
        console.error("[Upload Fail]", error.message);
        return RESPONSE.error(res, 500, 9999, "Failed to upload CV.");
    }
};

/**
 * GET /user/trends
 * Fetch personalized, CV-derived market trends and benchmarks (Slide 14)
 */
exports.getTrends = async (req, res) => {
    try {
        const userId = req.user.id;
        const clocks = await db.UserClocks.findOne({ userId });

        if (!clocks) {
            return RESPONSE.error(res, 404, 3001, "No trend data found. Please upload your CV first.");
        }

        // 1. Build Trends List (15-20 derived items)
        const trends = [];

        // Primary Insight (from Trend Engine Pulse)
        if (clocks.insightText) {
            trends.push({
                type: 'MARKET_INSIGHT',
                label: 'Market Momentum',
                value: clocks.insightText,
                icon: 'trending_up',
                priority: 'HIGH'
            });
        }

        // AI Exposure Trend
        if (clocks.aiExposureJustification) {
            trends.push({
                type: 'AI_EXPOSURE',
                label: 'AI Disruption Risk',
                value: clocks.aiExposureJustification,
                score: clocks.aiExposureScore,
                delta: clocks.previousAiExposureScore ? clocks.aiExposureScore - clocks.previousAiExposureScore : 0,
                priority: clocks.aiExposureScore > 70 ? 'CRITICAL' : 'MEDIUM'
            });
        }

        // Skill Relevance Trend
        if (clocks.skillRelevanceJustification) {
            trends.push({
                type: 'SKILL_VALUATION',
                label: 'Skill Market Value',
                value: clocks.skillRelevanceJustification,
                score: clocks.skillRelevanceScore,
                priority: clocks.skillRelevanceScore < 40 ? 'HIGH' : 'LOW'
            });
        }

        // Career Momentum Trend
        if (clocks.careerMomentumJustification) {
            trends.push({
                type: 'CAREER_VELOCITY',
                label: 'Sector Velocity',
                value: clocks.careerMomentumJustification,
                runway: `${clocks.careerMomentumMonths || 18} Months`,
                priority: 'MEDIUM'
            });
        }

        // Opportunity Window Trend
        if (clocks.opportunityWindowJustification) {
            trends.push({
                type: 'OPPORTUNITY_WINDOW',
                label: 'Role Sustainability',
                value: clocks.opportunityWindowJustification,
                window: `${clocks.opportunityWindowYears || 2} Years`,
                priority: 'HIGH'
            });
        }

        // Market Trigger
        if (clocks.trendTrigger) {
            trends.push({
                type: 'MARKET_TRIGGER',
                label: 'Top Market Driver',
                value: clocks.trendTrigger,
                priority: 'HIGH'
            });
        }

        // Add dynamically calculated peer benchmarks as trends
        const { getPeerBenchmarks } = require('../services/clockService');
        const aiBench = getPeerBenchmarks(clocks.aiExposureScore, 'AI_EXPOSURE');
        
        trends.push({
            type: 'BENCHMARK',
            label: 'Peer AI Resilience',
            value: `You are in the ${aiBench.userState} for AI Resilience in your sector.`,
            meta: aiBench
        });

        // Response structure
        const responseData = {
            userId,
            lastUpdated: clocks.updatedAt || clocks.lastCalculatedAt,
            overview: {
                aiExposure: clocks.aiExposureScore,
                momentum: clocks.careerMomentumScore,
                skillRelevance: clocks.skillRelevanceScore,
                opportunityWindow: clocks.opportunityWindowScore
            },
            trends: trends
        };

        return RESPONSE.success(res, 200, 1001, responseData);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Update User's FCM Token for Push Notifications
 */
exports.updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        if (!fcmToken) return RESPONSE.error(res, 400, 1002, "FCM Token is required");

        await db.User.findByIdAndUpdate(req.user.id, { $set: { fcmToken } });

        return RESPONSE.success(res, 200, 1001, { message: "FCM Token updated successfully" });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Logout from all devices by clearing the refresh token
 */
exports.logoutAll = async (req, res) => {
    try {
        await db.User.findByIdAndUpdate(req.user.id, { $set: { refreshToken: null } });
        return RESPONSE.success(res, 200, 2004, { message: "Logged out from all devices successfully." });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Change M-PIN using the old PIN
 */
exports.changeMPin = async (req, res) => {
    try {
        const { oldPin, newPin } = req.body;
        const user = await db.User.findById(req.user.id);
        
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(String(oldPin), user.mPin);
        if (!isMatch) return RESPONSE.error(res, 401, 3012, "Incorrect old PIN.");

        user.mPin = await bcrypt.hash(String(newPin), 10);
        await user.save();

        return RESPONSE.success(res, 200, 1001, { message: "M-PIN changed successfully." });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * DPDP Compliance: Download all user data in JSON format
 */
exports.downloadUserData = async (req, res) => {
    try {
        const userId = req.user.id;
        const [user, profile, runs, payments, credits] = await Promise.all([
            db.User.findById(userId).select('-mPin -refreshToken').lean(),
            db.UserProfile.findOne({ userId }).lean(),
            db.Runs.find({ userId }).lean(),
            db.Payments.find({ userId }).lean(),
            db.UserCredits.findOne({ userId }).lean()
        ]);

        const dataDump = {
            account: user,
            profileSnapshot: profile,
            auditHistory: runs,
            financialTransactions: payments,
            creditsBalance: credits,
            exportedAt: new Date()
        };

        return res.status(200).json({
            success: true,
            message: "Data export successful.",
            data: dataDump
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * User requests to become an Expert (Auditor)
 * Sets role to 'expert' and creates a pending record in RiskAuditorRegistry
 */
exports.applyAsExpert = async (req, res) => {
    try {
        const user = await db.User.findById(req.user.id);
        if (!user) return RESPONSE.error(res, 404, 3001);

        // Mark as applicant, but role stays 'user' until admin promotion
        user.isExpertApplicant = true;
        user.isExpert = false;
        await user.save();

        // Create an initial record in RiskAuditorRegistry if not exists
        let expertRecord = await db.RiskAuditorRegistry.findOne({ email: user.email });
        if (!expertRecord) {
            // Hardcode a simple ID generation if utility is not available or complex
            const auditorId = `AUD-${Math.floor(1000 + Math.random() * 9000)}`;
            
            expertRecord = await db.RiskAuditorRegistry.create({
                auditorId,
                auditorName: user.fullName || user.name || 'New Expert applicant',
                email: user.email,
                password: user.mPin || 'Expert@Hks123!', // Link to their PIN initially
                status: 'PENDING_SETUP', 
                isActive: false, 
                caseCategories: [], // No categories yet
            });
        }

        await createAuditLog(req, 'EXPERT_APPLICATION_SUBMITTED', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 1001, { 
            message: "Expert application submitted. You are now in pending activation state.",
            role: user.role,
            isExpert: user.isExpert,
            isExpertApplicant: user.isExpertApplicant,
            status: expertRecord.status
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
