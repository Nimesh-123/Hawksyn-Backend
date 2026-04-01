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
        const { email } = req.query || req.body;
        if (!email) return RESPONSE.error(res, 400, 3003, "Email is required");

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 30 * 1000);
        await db.OTP.findOneAndUpdate(
            { email },
            { otp: otpHash, expiresAt, failCount: 0 },
            { upsert: true, new: true }
        );

        console.log(`[DEV Auth] OTP for ${email}: ${otp} (Valid for 30s)`);

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const sendEmail = require('../../utils/email.js');
                await sendEmail({
                    email,
                    subject: 'Your Hawksyn OTP Verification Code',
                    message: `Your OTP is ${otp}. It will expire in 30 seconds.`,
                    html: `<b>Your OTP is ${otp}</b><p>It will expire in 30 seconds.</p>`
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
 
        const commonPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
        if (commonPins.includes(mPin)) {
            return RESPONSE.error(res, 400, 3004, "Common PINs like 1234, 1111 and 0000 are not allowed for security reasons.");
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
        } catch (e) { return RESPONSE.error(res, 401, 3002, "Invalid Google Token."); }

        const { email, name, picture, sub: googleId } = ticket.getPayload();

        let user = await db.User.findOne({ email });
        if (user && user.isDeleted) {
            user.isDeleted = false;
            user.deletedAt = null;
        }

        if (!user) {
            user = new db.User({ email, fullName: name, avatar: picture, googleId, isEmailVerified: true });
            const region = detectRegionFromIP(req.ip);
            user.countryCode = region.countryCode;
            user.preferredCurrency = region.currency;
        } else if (!user.googleId) {
            user.googleId = googleId;
            if (!user.avatar) user.avatar = picture;
        }

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;
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
            user.isDeleted = true;
            user.deletedAt = new Date();
            await user.save();
            await createAuditLog(req, 'ACCOUNT_DELETED', user._id, { email: user.email });
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
        if (!req.file) return RESPONSE.error(res, 400, 1002, "No file provided.");

        const file = req.file;
        if (file.mimetype !== 'application/pdf') return RESPONSE.error(res, 400, 1002, "Only PDF files allowed.");
        if (file.size > 10 * 1024 * 1024) return RESPONSE.error(res, 400, 1002, "Limit 10MB exceeded.");

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `resumes/${req.user.id}-${uniqueSuffix}.pdf`;
        const fileUrl = await uploadFile(file.buffer, fileName, file.mimetype);

        let extractedData = null;
        let parserStatus = "FAILED";
        let errorReason = null;

        try {
            extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype);
            
            if (extractedData && extractedData.isCv === false) {
                await deleteFile(fileName);
                return RESPONSE.error(res, 400, 1002, "Not a valid CV.");
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
