const { db } = require('../../models/index.model.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RESPONSE = require('../../../utils/response.js');
const { generateOTP } = require('./helpers/function.js');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { uploadFile, deleteFile } = require('../../../utils/s3');
const { smartCVParser, GuardrailError } = require('../../../utils/aiParser');
const { getUserActiveCv } = require('../cv/helpers/cvHelper.js');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { detectRegionFromIP } = require('../../../utils/regionHelper.js');
const { calculateAICost } = require('../admin/helpers/aiCostHelper.js');


const prepareUserResponse = async (user) => {
    const userActiveCv = await getUserActiveCv(user._id);
    const userResponse = user.toObject();

    if (userActiveCv) {
        userResponse.cvUrl = userActiveCv.cvUrl;
        userResponse.cvUploadedAt = userActiveCv.cvUploadedAt;
        userResponse.parsedCvData = userActiveCv.parsedCvData;
    }

    const userProfile = await db.UserProfile.findOne({ userId: user._id });
    userResponse.profileConfirmed = userProfile ? userProfile.isConfirmed : false;

    if (userResponse.profilePhoto && userResponse.profilePhoto.includes('amazonaws.com')) {
        const baseUrl = process.env.API_URL || 'http://localhost:3002/api/v1';
        userResponse.profilePhoto = `${baseUrl}/user/profile-photo/${userResponse._id}`;
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
                const sendEmail = require('../../../utils/email.js');
                sendEmail({
                    email,
                    subject: 'Your Hawksyn OTP Verification Code',
                    message: `Your OTP is ${otp}. It will expire in 5 minutes.`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Welcome to Hawksyn</h2>
                            <p>Your verification code is: <strong>${otp}</strong></p>
                            <p>This code will expire in 5 minutes.</p>
                        </div>
                    `
                }).catch(e => console.error('[Email Worker Error]', e));
            } catch (emailError) {
                console.error("Failed to enqueue email:", emailError.message);
            }
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
        
        // Unblock account on successful OTP verify
        user.isBlocked = false;
        user.wrongPinCount = 0;

        // Save FCM Token if provided during login
        if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;

        otpRecord.isUsed = true;
        otpRecord.expiresAt = new Date(); await otpRecord.save();

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
        if (!mPin || !confirmMPin) return RESPONSE.error(res, 400, 3005, "MPIN is required");
        if (mPin !== confirmMPin) return RESPONSE.error(res, 400, 3005, "MPIN and Confirm MPIN do not match");

        if (mPin.length !== 6) {
            return RESPONSE.error(res, 400, 3013, "M-PIN must be exactly 6 digits");
        }

        const commonPins = ['123456', '000000', '111111', '222222', '333333', '123123', '654321', '987654'];
        if (commonPins.includes(mPin)) {
            return RESPONSE.error(res, 400, 3013, "The provided PIN is too common and is blocked for security reasons.");
        }

        let user;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            const token = req.headers.authorization.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                user = await db.User.findById(decoded.id);
            } catch(e) {
                console.warn("[Set PIN] Auth token invalid, falling back to email if provided");
            }
        }

        if (!user && email) {
            user = await db.User.findOne({ email, isDeleted: false });
        }

        if (!user) return RESPONSE.error(res, 404, 3001, "User not found or email required");

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
        if (user.isBlocked) return RESPONSE.error(res, 403, 3008, "Account locked. Too many incorrect attempts. You need to re-verify your identity to reset your PIN.");
        if (!user.mPin) return RESPONSE.error(res, 400, 3004, "M-PIN not set");

        if (!(await bcrypt.compare(mPin, user.mPin))) {
            user.wrongPinCount += 1;
            
            if (user.wrongPinCount >= 3) {
                user.isBlocked = true;
                await user.save();
                return RESPONSE.error(res, 403, 3008, "Account locked. Too many incorrect attempts.");
            }
            
            await user.save();
            const attemptsRemaining = 3 - user.wrongPinCount;
            return RESPONSE.error(res, 401, 3004, `Incorrect PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`);
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
            await db.ExtractedCV.deleteMany({ candidate_id: userId });
            await db.PSDEResult.deleteMany({ candidate_id: userId });
            await db.AEUAuditLog.deleteMany({ candidate_id: userId });
            await db.HipProfile.deleteMany({ userId });
            await db.Notifications.deleteMany({ userId });
            await db.ExpertQuery.deleteMany({ userId });
            await db.ChatMessage.deleteMany({ senderId: userId }); // Delete chats sent by user
            await db.UserClocks.deleteMany({ userId });
            await db.ClockHistory.deleteMany({ userId });
            await db.UserCredits.deleteMany({ userId });
            await db.AuditLog.deleteMany({ userId });
            await db.User.findByIdAndDelete(userId);

            return RESPONSE.success(res, 200, 2002, { message: "Account permanently deleted." });
        } else {
            const { reason, comment } = req.body || {};
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
        const userId = req.user.id;
        
        // --- RERUN PAYMENT VALIDATION ---
        const userDoc = await db.User.findById(userId);
        const existingCV = await db.DocumentUploads.findOne({ userId, parserStatus: 'SUCCESS' });
        
        let isPaidRerun = false;
        // If the user already uploaded a successful CV before, this is a Re-upload (Rerun).
        if (existingCV) {
            if (!userDoc.hasPaidForRerun) {
                return RESPONSE.error(res, 402, 4002, "Payment Required. Please purchase a CV Re-upload activation to proceed.");
            }
            // Consume the paid status since they are now uploading the CV
            userDoc.hasPaidForRerun = false;
            await userDoc.save();
            isPaidRerun = true;
        }
        // --- END PAYMENT VALIDATION ---

        if (!req.file) return RESPONSE.error(res, 400, 3009, "No file provided.");

        const file = req.file;
        if (file.mimetype !== 'application/pdf') return RESPONSE.error(res, 400, 3009, "Only PDF files allowed.");
        if (file.size > 10 * 1024 * 1024) return RESPONSE.error(res, 400, 3009, "Limit 10MB exceeded.");

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `resumes/${req.user.id}-${uniqueSuffix}.pdf`;
        const uploadRes = await uploadFile(file.buffer, fileName, file.mimetype);
        const fileUrl = uploadRes.url;

        // Run the AI parsing asynchronously in the background
        (async () => {
            let extractedData = null;
            let parserStatus = "FAILED";
            let errorReason = null;

            try {
                extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype, req.user.id, fileUrl);

                if (extractedData && extractedData.isCv === false) {
                    await deleteFile(fileName);

                    // Update the already created DocumentUploads record with NOT_A_CV status
                    const userId = req.user.id;
                    await db.DocumentUploads.findOneAndUpdate(
                        { userId, isActive: true },
                        {
                            $set: {
                                cvUrl: null,
                                parsedCvData: null,
                                parserStatus: 'NOT_A_CV',
                                errorReason: 'Detected as non-CV document.',
                                parserMetadata: extractedData ? {
                                    llm: extractedData.llm,
                                    model: extractedData.model,
                                    modelUsed: extractedData.modelUsed,
                                    duration: extractedData.totalPipelineDuration || extractedData.parsingDuration,
                                    tokenUsage: extractedData.tokenUsage
                                } : null,
                                isActive: false
                            }
                        }
                    );

                    await createAuditLog({ ip: req.ip, user: req.user, headers: req.headers }, 'CV_REJECTED', userId, { reason: 'NOT_A_CV', fileName: file.originalname });
                    
                    const socketService = require('../../sockets/socketService');
                    const io = socketService.getIO();
                    if (io) {
                        io.to(userId.toString()).emit('cv_parse_update', {
                            status: 'COMPLETED',
                            parserStatus: 'NOT_A_CV',
                            errorReason: 'Detected as non-CV document.'
                        });
                    }
                    if (isPaidRerun) {
                        await db.User.findByIdAndUpdate(userId, { $set: { hasPaidForRerun: true } });
                    }
                    return;
                }

                if (extractedData) {
                    try {
                        const { sanitizeParsedData } = require('../cv/helpers/cvSanitizer.js');
                        extractedData = sanitizeParsedData(extractedData);
                        parserStatus = "SUCCESS";
                    } catch (e) { parserStatus = "SUCCESS"; }
                }
            } catch (aiError) {
                if (aiError.name === 'GuardrailError') {
                    await deleteFile(fileName);
                    
                    const userId = req.user.id;
                    // No need to create DocumentUploads record here since smartCVParser already created the rejected log.

                    await createAuditLog({ ip: req.ip, user: req.user, headers: req.headers }, 'CV_REJECTED', userId, {
                        reason: aiError.userMessage,
                        ruleId: aiError.ruleId,
                        layer: aiError.layer,
                        fileName: file.originalname
                    });

                    const socketService = require('../../sockets/socketService');
                    const io = socketService.getIO();
                    if (io) {
                        io.to(userId.toString()).emit('cv_parse_update', {
                            status: 'COMPLETED',
                            parserStatus: 'REJECTED',
                            errorReason: aiError.userMessage
                        });
                    }
                    if (isPaidRerun) {
                        await db.User.findByIdAndUpdate(userId, { $set: { hasPaidForRerun: true } });
                    }
                    return;
                }
                console.error("[AI Fail]", aiError.message);
            }

            const isExtractionBlank = !extractedData ||
                (extractedData.aeuList?.length < 3 &&
                    (!extractedData.structured?.work?.experience?.length) &&
                    (!extractedData.structured?.composition?.skills?.technical?.length));

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

            // Update the active DocumentUploads record created by smartCVParser
            const newCv = await db.DocumentUploads.findOneAndUpdate(
                { userId, isActive: true },
                {
                    $set: {
                        parsedCvData: extractedData ? JSON.parse(JSON.stringify(extractedData)) : null,
                        parserStatus,
                        errorReason,
                        parserMetadata: extractedData ? {
                            llm: extractedData.llm,
                            model: extractedData.model,
                            modelUsed: extractedData.modelUsed,
                            duration: extractedData.totalPipelineDuration || extractedData.parsingDuration,
                            tokenUsage: extractedData.tokenUsage
                        } : null
                    }
                },
                { new: true }
            );

            await db.UserProfile.findOneAndUpdate(
                { userId },
                {
                    lastCvUploadId: newCv?._id || null,
                    cvUrl: fileUrl,
                    originalParsedData: newCv?.parsedCvData || null,
                    confirmedProfile: null,
                    isConfirmed: false
                },
                { upsert: true }
            );

            if (newCv?._id) {
                await createAuditLog({ ip: req.ip, user: req.user, headers: req.headers }, 'CV_UPLOADED', userId, { cvUploadId: newCv._id });
            }

            if (extractedData) {
                await createAuditLog({ ip: req.ip, user: req.user, headers: req.headers }, 'PROFILE_CV_PARSED', userId, {
                    extractedRoles: extractedData.aeuList?.length || 0
                });
            }

            const socketService = require('../../sockets/socketService');
            const io = socketService.getIO();
            if (io) {
                io.to(userId.toString()).emit('cv_parse_update', {
                    status: 'COMPLETED',
                    parserStatus: parserStatus,
                    errorReason: errorReason
                });
            }

            if (isPaidRerun && parserStatus !== "SUCCESS") {
                await db.User.findByIdAndUpdate(userId, { $set: { hasPaidForRerun: true } });
            }

        })().catch(async (backgroundError) => {
            console.error("[Background Parse Error]", backgroundError);
            if (isPaidRerun) {
                await db.User.findByIdAndUpdate(req.user.id, { $set: { hasPaidForRerun: true } });
            }
        });

        return RESPONSE.success(res, 202, 1001, {
            message: "CV uploaded. AI parsing started in background.",
            cvUrl: fileUrl,
            status: "PROCESSING"
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getCvStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const doc = await db.DocumentUploads.findOne({ userId }).sort({ createdAt: -1 });

        if (!doc) {
            return RESPONSE.success(res, 200, 2000, {
                status: 'PROCESSING',
                message: 'CV upload initializing',
                parserStatus: 'PENDING',
                liveMetrics: {}
            });
        }

        if (doc.parserStatus === 'SUCCESS' || doc.parserStatus === 'EMPTY' || doc.parserStatus === 'NOT_A_CV' || doc.parserStatus === 'FAILED' || doc.parserStatus === 'REJECTED') {
            return RESPONSE.success(res, 200, 2000, {
                status: 'COMPLETED',
                message: 'CV processing completed',
                parserStatus: doc.parserStatus,
                parsedData: doc.parsedCvData,
                errorReason: doc.errorReason
            });
        }

        return RESPONSE.success(res, 200, 2000, {
            status: 'PROCESSING',
            message: 'CV is currently being processed by AI',
            parserStatus: doc.parserStatus,
            liveMetrics: doc.parserLiveMetrics || {}
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

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
        const { getPeerBenchmarks } = require('../../services/clockService');
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

exports.logoutAll = async (req, res) => {
    try {
        await db.User.findByIdAndUpdate(req.user.id, { $set: { refreshToken: null } });
        return RESPONSE.success(res, 200, 2004, { message: "Logged out from all devices successfully." });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.changeMPin = async (req, res) => {
    try {
        const { oldPin, newPin } = req.body;
        const user = await db.User.findById(req.user.id);

        if (!user || !user.mPin) return RESPONSE.error(res, 404, 3001, "User or current PIN not found.");

        const isMatch = await bcrypt.compare(String(oldPin), user.mPin);
        if (!isMatch) return RESPONSE.error(res, 401, 3012, "The old PIN you entered is incorrect.");

        const pinStr = String(newPin);
        if (pinStr.length !== 6) {
            return RESPONSE.error(res, 400, 3013, "M-PIN must be exactly 6 digits");
        }

        const commonPins = ['123456', '000000', '111111', '222222', '333333', '123123', '654321', '987654'];
        if (commonPins.includes(pinStr)) {
            return RESPONSE.error(res, 400, 3013, "The new PIN is too common. Please choose a more secure one.");
        }

        user.mPin = await bcrypt.hash(String(newPin), 10);
        await user.save();

        return RESPONSE.success(res, 200, 1001, { message: "M-PIN changed successfully." });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

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
                auditorName: user.fullName || user.name || 'Expert applicant',
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

exports.sendWhatsAppOTP = async (req, res) => {
    try {
        const { whatsappNumber } = req.body;
        if (!whatsappNumber) return RESPONSE.error(res, 400, 1003, "WhatsApp number is required");

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        await db.OTP.findOneAndUpdate(
            { whatsappNumber },
            { otp: otpHash, expiresAt, failCount: 0 },
            { upsert: true, new: true }
        );

        console.log(`[DEV WhatsApp] OTP for ${whatsappNumber}: ${otp} (Valid for 10 mins)`);

        // Send push notification as a fallback since WhatsApp API is not yet integrated
        if (req.user && req.user.id) {
            const user = await db.User.findById(req.user.id);
            if (user && user.fcmToken) {
                const notificationService = require('../../services/notificationService');
                await notificationService.sendPushNotification(
                    user.fcmToken,
                    'Verification Code',
                    `Your OTP for WhatsApp verification is ${otp}`,
                    { type: 'WHATSAPP_OTP', otp }
                );
                console.log(`[Push Notification] OTP sent to FCM token for user ${req.user.id}`);
            }
        }

        return RESPONSE.success(res, 200, 2003, { message: "WhatsApp code sent successfully" });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

const generateClocksWithSteps = async (userId) => {
    try {
        const profile = await db.UserProfile.findOne({ userId }).lean();
        const mergedProfile = profile?.confirmedProfile || profile?.originalParsedData?.structured || {};
        const clockService = require('../../services/clockService.js');
        const socketService = require('../../sockets/socketService');
        const io = socketService.getIO();

        const emitStatus = (status) => {
            if (io) io.to(userId.toString()).emit('clock_generation_update', { status });
        };
        
        // Step 1: AI Exposure (initial)
        await db.UserClocks.updateOne({ userId }, { $set: { generationStatus: 'MARKET_VELOCITY' } });
        emitStatus('MARKET_VELOCITY');
        await new Promise(r => setTimeout(r, 2000));
        
        // Step 2: Market Velocity
        await db.UserClocks.updateOne({ userId }, { $set: { generationStatus: 'SKILL_HALFLIFE' } });
        emitStatus('SKILL_HALFLIFE');
        await new Promise(r => setTimeout(r, 2000));
        
        // Step 3: Skill Halflife
        await db.UserClocks.updateOne({ userId }, { $set: { generationStatus: 'OPPORTUNITY_WINDOW' } });
        emitStatus('OPPORTUNITY_WINDOW');
        
        // Actual Generation (takes a few seconds)
        await clockService.recalibrateForUser(userId, mergedProfile);
        
        // Step 4: Completed
        await db.UserClocks.updateOne({ userId }, { $set: { generationStatus: 'COMPLETED' } });
        emitStatus('COMPLETED');
    } catch (err) {
        console.error("[Clock Gen Worker] Error generating clocks:", err);
        await db.UserClocks.updateOne({ userId }, { $set: { generationStatus: 'PENDING' } });
        const socketService = require('../../sockets/socketService');
        const io = socketService.getIO();
        if (io) io.to(userId.toString()).emit('clock_generation_update', { status: 'PENDING', error: err.message });
    }
};

exports.verifyWhatsAppOTP = async (req, res) => {
    try {
        const { whatsappNumber, otp } = req.body;

        const otpRecord = await db.OTP.findOne({ whatsappNumber });
        if (!otpRecord) return RESPONSE.error(res, 404, 3003, "OTP expired or not found.");

        if (otpRecord.failCount >= 5) return RESPONSE.error(res, 403, 3008, "Too many failed attempts.");

        const isMatch = await bcrypt.compare(otp, otpRecord.otp);
        if (!isMatch) {
            otpRecord.failCount += 1;
            await otpRecord.save();
            return RESPONSE.error(res, 400, 3002, "Incorrect code. Please try again.");
        }

        const user = await db.User.findById(req.user.id);
        if (!user) return RESPONSE.error(res, 404, 3001);

        user.isPhoneVerified = true;
        user.whatsappNumber = whatsappNumber;
        await user.save();

        otpRecord.isUsed = true;
        otpRecord.expiresAt = new Date(); 
        await otpRecord.save();

        let clock = await db.UserClocks.findOne({ userId: req.user.id });
        if (!clock) {
            clock = await db.UserClocks.create({ userId: req.user.id, generationStatus: 'AI_EXPOSURE' });
        } else {
            clock.generationStatus = 'AI_EXPOSURE';
            await clock.save();
        }

        // Run background generation
        generateClocksWithSteps(req.user.id);

        return RESPONSE.success(res, 200, 1001, { message: "Phone verified. Starting your clocks..." });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getClocksStatus = async (req, res) => {
    try {
        const clock = await db.UserClocks.findOne({ userId: req.user.id }).lean();
        if (!clock) {
            return RESPONSE.success(res, 200, 1001, { status: "PENDING" });
        }
        return RESPONSE.success(res, 200, 1001, { status: clock.generationStatus });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Mock Razorpay Order Creation for CV Re-upload
 * POST /api/v1/user/payment/razorpay/create-order
 */
exports.createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Mock order ID generation
        const crypto = require('crypto');
        const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;

        return RESPONSE.success(res, 200, 1001, {
            order_id: mockOrderId,
            amount: 9900, // 99 INR in paise
            currency: "INR",
            message: "Razorpay mock order created."
        });
    } catch (error) {
        console.error('[Razorpay Order Error]', error);
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

/**
 * Verify Mock Razorpay Payment for CV Re-upload
 * POST /api/v1/user/payment/razorpay/verify
 */
exports.verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const userId = req.user.id;

        if (!razorpay_payment_id || !razorpay_order_id) {
            return RESPONSE.error(res, 400, 1003, 'Payment details are required');
        }

        // Ideally, here you verify the signature using crypto and RAZORPAY_KEY_SECRET.
        // For now, we mock the success.

        const newPayment = await db.Payments.create({
            paymentId: `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            userId,
            platform: 'web',
            productId: 'CV_RERUN',
            purchaseId: razorpay_payment_id,
            amount: 99,
            currency: 'INR',
            status: 'COMPLETED',
            isTestPayment: true,
            paymentMethod: 'RAZORPAY',
            verifiedAt: new Date(),
            metadata: { razorpay_order_id, razorpay_signature }
        });

        // Update the user profile to set hasPaidForRerun
        await db.User.findByIdAndUpdate(userId, { $set: { hasPaidForRerun: true } });

        return RESPONSE.success(res, 200, 1001, {
            message: 'Payment verified successfully. You can now re-upload your CV.',
            hasPaidForRerun: true,
            paymentId: newPayment.paymentId
        });

    } catch (error) {
        console.error('[Razorpay Verification Error]', error);
        return RESPONSE.error(res, 500, 9999, error.message);
    }
};

exports.uploadProfilePhoto = async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!req.file) return RESPONSE.error(res, 400, 3009, "No file provided.");
        
        const file = req.file;
        if (!file.mimetype.startsWith('image/')) return RESPONSE.error(res, 400, 3009, "Only image files allowed.");
        if (file.size > 5 * 1024 * 1024) return RESPONSE.error(res, 400, 3009, "Limit 5MB exceeded.");

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `profile-photos/${userId}-${uniqueSuffix}-${file.originalname}`;
    const uploadRes = await uploadFile(file.buffer, fileName, file.mimetype);
    const fileUrl = uploadRes.url;

    // Update the user model
    await db.User.findByIdAndUpdate(userId, { profilePhoto: fileUrl });
    
    const baseUrl = process.env.API_URL || 'http://localhost:3002/api/v1';
    const proxyUrl = `${baseUrl}/user/profile-photo/${userId}`;

    return RESPONSE.success(res, 200, 1001, {
        message: "Profile photo updated successfully.",
        profilePhoto: proxyUrl
    });
} catch (err) {
    return RESPONSE.error(res, 500, 9999, err.message);
}
};

exports.downloadProfilePhotoS3 = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await db.User.findById(id);
        if (!user || !user.profilePhoto) return res.status(404).json({ success: false, message: 'Profile photo not found.' });

        const urlObj = new URL(user.profilePhoto);
        const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;

        const { getFileStream } = require('../../../utils/s3');
        const { Body, ContentType } = await getFileStream(key);

        res.setHeader('Content-Type', ContentType || 'image/jpeg');
        // Let it display inline
        return Body.pipe(res);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAuditTrail = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return RESPONSE.error(res, 401, 3001, "Unauthorized: User not found");
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const action = req.query.action;

        const query = { userId };
        if (action) {
            query.action = action;
        }

        const skip = (page - 1) * limit;

        const total = await db.AuditLog.countDocuments(query);
        const logs = await db.AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return RESPONSE.success(res, 200, 1001, {
            total,
            page,
            limit,
            logs
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
