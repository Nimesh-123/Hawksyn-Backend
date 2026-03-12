const { db } = require('../models/index.model.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RESPONSE = require('../../utils/response.js');
const { generateOTP } = require('../../utils/function.js');
const { createAuditLog } = require('../../utils/auditLogger.js');
const { uploadFile, deleteFile } = require('../../utils/s3');
const { smartCVParser } = require('../../utils/aiParser');
const { get_message } = require('../../utils/message.js');
const { getUserActiveCv } = require('../../utils/cvHelper.js');

const generateToken = (payload) => {
    /* 
    // Current Solution: Long-lived token (1 year)
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '365d' });
    */

    // Active Solution 1: Refresh Token logic
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_REFRESH || 'refresh_secret', { expiresIn: '365d' });
    return { accessToken, refreshToken };
};

exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // 1. Check if user is deleted or blocked
        const userCheck = await db.User.findOne({ email });
        if (userCheck) {
            if (userCheck.isDeleted) return RESPONSE.error(res, 403, 4444, "Account is deleted.");
        }

        // 2. Upsert OTP record
        await db.OTP.findOneAndUpdate(
            { email },
            { otp: otpHash, expiresAt, failCount: 0 },
            { upsert: true, new: true }
        );

        console.log(`[DEV] OTP for ${email}: ${otp}`);

        // 3. Send Email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const sendEmail = require('../../utils/email.js');
                await sendEmail({
                    email,
                    subject: 'Your Hawksyn OTP Verification Code',
                    message: `Your OTP is ${otp}. It will expire in 5 minutes.`,
                    html: `<b>Your OTP is ${otp}</b><p>It will expire in 5 minutes.</p>`
                });
            } catch (e) {
                console.error("Email send failed:", e.message);
            }
        }

        await createAuditLog(req, 'OTP_SENT', userCheck ? userCheck._id : null, { email });

        return RESPONSE.success(res, 200, 2003, { email });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // 1. Find OTP record
        const otpRecord = await db.OTP.findOne({ email });
        if (!otpRecord) return RESPONSE.error(res, 404, 3003, "OTP expired or not found. Please request a new one.");

        // 2. Check failure count
        if (otpRecord.failCount >= 5) {
            return RESPONSE.error(res, 403, "Too many failed attempts. Please request a new OTP.", get_message(4444));
        }

        // 3. Verify Hash
        const isMatch = await bcrypt.compare(otp, otpRecord.otp);
        if (!isMatch) {
            otpRecord.failCount += 1;
            await otpRecord.save();
            return RESPONSE.error(res, 400, 3002);
        }

        // 4. On Success: Mark user as verified or create user
        let user = await db.User.findOne({ email });
        let isNewUser = false;
        if (!user) {
            user = new db.User({ email });
            isNewUser = true;
        }
        user.isEmailVerified = true;
        await user.save();

        if (isNewUser) {
            await createAuditLog(req, 'USER_CREATED', user._id, { email: user.email });
        }

        // 5. Update OTP record instead of deleting (Logic Update)
        otpRecord.isUsed = true;
        otpRecord.expiresAt = new Date(); // Optional: expire quickly now that it's used
        await otpRecord.save();

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;
        await user.save();

        const userActiveCv = await getUserActiveCv(user._id);
        const userResponse = user.toObject();
        if (userActiveCv) {
            userResponse.cvUrl = userActiveCv.cvUrl;
            userResponse.cvUploadedAt = userActiveCv.cvUploadedAt;
            userResponse.parsedCvData = userActiveCv.parsedCvData;
        }
        delete userResponse.mPin;
        delete userResponse.refreshToken;

        await createAuditLog(req, 'OTP_VERIFIED', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 2004, { user: userResponse, ...tokens });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.setPin = async (req, res) => {
    try {
        const { email, mPin, confirmMPin } = req.body;

        if (mPin !== confirmMPin) return RESPONSE.error(res, 400, 3005);

        const user = await db.User.findOne({ email });
        if (!user) return RESPONSE.error(res, 404, 3001);
        if (!user.isEmailVerified) return RESPONSE.error(res, 400, 4444, "Please verify your email first.");

        const hashedPin = await bcrypt.hash(mPin, 10);
        user.mPin = hashedPin;
        user.mPinSet = true;
        user.wrongPinCount = 0;
        user.isBlocked = false; // Unblock user on successful PIN reset
        await user.save();

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;
        await user.save();

        const userActiveCv = await getUserActiveCv(user._id);
        const userResponse = user.toObject();
        if (userActiveCv) {
            userResponse.cvUrl = userActiveCv.cvUrl;
            userResponse.cvUploadedAt = userActiveCv.cvUploadedAt;
            userResponse.parsedCvData = userActiveCv.parsedCvData;
        }
        delete userResponse.mPin;
        delete userResponse.refreshToken;

        await createAuditLog(req, 'MPIN_SET', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 2005, { user: userResponse, ...tokens });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.loginWithPin = async (req, res) => {
    try {
        const { email, mPin } = req.body;
        const user = await db.User.findOne({ email });

        if (!user) return RESPONSE.error(res, 404, 3001);
        if (user.isDeleted) return RESPONSE.error(res, 403, 4444, "Account is deleted.");
        if (user.isBlocked) return RESPONSE.error(res, 403, 3008);
        if (!user.mPin) return RESPONSE.error(res, 400, 3004, "M-PIN not set");

        // 1. Check PIN
        const isMatch = await bcrypt.compare(mPin, user.mPin);
        if (!isMatch) {
            user.wrongPinCount += 1;
            if (user.wrongPinCount >= 5) {
                user.isBlocked = true;
            }
            await user.save();
            return RESPONSE.error(res, 401, 3004);
        }

        // 2. Reset counters on success
        user.wrongPinCount = 0;
        await user.save();

        const tokens = generateToken({ id: user._id, email: user.email, role: user.role });
        user.refreshToken = tokens.refreshToken;
        await user.save();

        const userActiveCv = await getUserActiveCv(user._id);
        const userResponse = user.toObject();
        if (userActiveCv) {
            userResponse.cvUrl = userActiveCv.cvUrl;
            userResponse.cvUploadedAt = userActiveCv.cvUploadedAt;
            userResponse.parsedCvData = userActiveCv.parsedCvData;
        }
        delete userResponse.mPin;
        delete userResponse.refreshToken;

        await createAuditLog(req, 'LOGIN_WITH_PIN', user._id, { email: user.email });

        return RESPONSE.success(res, 200, 2001, { user: userResponse, ...tokens });
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
            console.log(`[Account Delete] Starting PERMANENT HARD DELETE for User ${userId}...`);

            // 1. Get all runIds for this user to cascade to RAS
            const runs = await db.Runs.find({ userId }).select('runId');
            const runIds = runs.map(r => r.runId);

            // 2. Cascade Delete Decision Assurance Data
            if (runIds.length > 0) {
                await db.Ras.deleteMany({ runId: { $in: runIds } });
            }

            // 3. Delete User Assets & Config
            await db.Runs.deleteMany({ userId });
            await db.Payments.deleteMany({ userId });
            await db.UserProfile.deleteMany({ userId });
            await db.DocumentUploads.deleteMany({ userId });

            
            // 4. Clean up Authentication & Logs
            await db.OTP.deleteMany({ email: user.email });
            await db.AuditLog.deleteMany({ userId });

            // 5. Finally delete the core User record
            await db.User.findByIdAndDelete(userId);

            console.log(`[Account Delete] Hard delete successful for user: ${userId}`);
            return RESPONSE.success(res, 200, 2002, { message: "Your account and all associated data have been permanently removed from our systems." });
        } else {
            // Soft Delete logic (Default)
            user.isDeleted = true;
            user.deletedAt = new Date();
            await user.save();

            await createAuditLog(req, 'ACCOUNT_DELETED', user._id, { email: user.email });

            return RESPONSE.success(res, 200, 2002);
        }
    } catch (err) {
        console.error(`[Account Delete Error] User ${req.user.id}: ${err.message}`);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.forgotPin = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.User.findOne({ email });

        if (!user) return RESPONSE.error(res, 404, 3001);
        if (user.isDeleted) return RESPONSE.error(res, 403, 4444, "Account is deleted.");

        await createAuditLog(req, 'FORGOT_PIN_REQUEST', user._id, { email: user.email });

        // Reuse sendOTP logic
        return exports.sendOTP(req, res);
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.uploadCV = async (req, res) => {
    try {
        // 1. Verify file exists
        if (!req.file) {
            return RESPONSE.error(res, 400, 1002, "No file provided. Please upload your CV.");
        }

        const file = req.file;

        // 2. Strict MIME type validation (Only PDF allowed as per new requirement)
        if (file.mimetype !== 'application/pdf') {
            return RESPONSE.error(res, 400, 1002, "Invalid file type. Only PDF files are allowed.");
        }

        // 3. Size validation
        if (file.size > 10 * 1024 * 1024) {
            return RESPONSE.error(res, 400, 1002, "File size exceeds the 10MB limit.");
        }

        // 4. Generate unique and sanitized filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `resumes/${req.user.id}-${uniqueSuffix}.pdf`;

        // 5. Upload to S3
        console.log(`[S3] Uploading CV for User ${req.user.id}...`);
        const fileUrl = await uploadFile(file.buffer, fileName, file.mimetype);

        // 6. AI Data Extraction (Smart Pipeline)
        console.log(`[AI] Starting AI Extraction for User ${req.user.id}...`);
        let extractedData = null;
        let parserStatus = "FAILED";

        try {
            extractedData = await smartCVParser(file.buffer, file.originalname, file.mimetype);
            
            // ✅ NEW: Reject if not a CV
            if (extractedData && extractedData.isCv === false) {
                console.warn(`[CV Guard] User ${req.user.id} uploaded a non-CV document. Deleting from S3...`);
                await deleteFile(fileName);
                return RESPONSE.error(res, 400, 1002, "The uploaded document does not appear to be a valid Resume/CV. Please upload a relevant professional document.");
            }

            if (extractedData) {
                // Post-processing Sanitizer to fill 7 common missing gaps
                try {
                    const { sanitizeParsedData } = require('../../utils/cvSanitizer.js');
                    extractedData = sanitizeParsedData(extractedData);
                    parserStatus = "COMPLETED";
                } catch (sanitizerError) {
                    console.error("[Sanitizer Error]", sanitizerError.message);
                    parserStatus = "PARTIAL"; // Still save data but mark as partial due to sanitizer failure
                }
            }
        } catch (aiError) {
            console.error("[AI Extraction Failed]", aiError.message);
            // We still save the CV URL even if AI fails, but log the error
        }

        // 7. Persist to Database - Phase 2 (Safe Migration)
        const userId = req.user.id;

        // [LOGIC UPDATE] We show durations in response for monitoring, but keep DB clean.
        const dbSafeParsedData = extractedData ? JSON.parse(JSON.stringify(extractedData)) : null;
        if (dbSafeParsedData) {
            delete dbSafeParsedData.parsingDuration;
            delete dbSafeParsedData.modelUsed;
            delete dbSafeParsedData.totalPipelineDuration;
        }

        // STEP A - deactivate previous CVs in the new collection
        await db.DocumentUploads.updateMany(
            { userId },
            { $set: { isActive: false } }
        );

        // STEP B - insert new CV record (Using the clean sanitized data for DB)
        const newCv = await db.DocumentUploads.create({
            userId,
            fileName: file.originalname,
            cvUrl: fileUrl,
            parsedCvData: dbSafeParsedData,
            parserStatus: parserStatus,
            isActive: true
        });

        // [LOGIC UPDATE] Auto-create or Update UserProfile every time user uploads CV.
        await db.UserProfile.findOneAndUpdate(
            { userId },
            {
                lastCvUploadId: newCv._id,
                cvUrl: fileUrl,
                originalParsedData: dbSafeParsedData,
                confirmedProfile: null,  // reset on new upload
                isConfirmed: false,      // needs re-confirmation
                confirmedAt: null
            },

            { upsert: true, new: true }
        );

        // 8. Production Hardening - Safety Check

        const activeCount = await db.DocumentUploads.countDocuments({ userId, isActive: true });
        if (activeCount !== 1) {
            console.warn(`[CV Guard] User ${userId} has ${activeCount} active CVs after upload! Race condition suspected.`);
        }

        // STEP C - User model is now lean, no legacy fields updated.

        await createAuditLog(req, 'CV_UPLOADED', userId, {
            s3Key: fileName,
            aiModel: extractedData ? extractedData.modelUsed : 'FAILED',
            cvUploadId: newCv._id
        });

        console.log(`[CV Success] User ${userId} uploaded new CV: ${newCv._id}`);

        return RESPONSE.success(res, 200, 1001, {
            message: extractedData ? "CV uploaded and parsed successfully" : "CV uploaded but AI parsing failed",
            cvUrl: fileUrl,
            parsedData: extractedData
        });

    } catch (error) {
        console.error(`[CV Upload Failure] User ${req.user.id}: ${error.message}`);
        return RESPONSE.error(res, 500, 9999, "Failed to upload CV. Please try again later.");
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return RESPONSE.error(res, 400, 1002, "Refresh token is required");

        // 1. Verify Refresh Token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH || 'refresh_secret');
        } catch (err) {
            return RESPONSE.error(res, 401, 1002, "Invalid or expired refresh token");
        }

        // 2. Find user/admin in DB and check if token matches
        let user = await db.User.findOne({ _id: decoded.id, refreshToken, isDeleted: false, isBlocked: false });
        if (!user) {
            user = await db.Admin.findOne({ _id: decoded.id, refreshToken });
        }

        if (!user) {
            return RESPONSE.error(res, 401, 1002, "Session expired. Please login again.");
        }

        // 3. Generate New Access Token
        const accessToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return RESPONSE.success(res, 200, 1001, { accessToken });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
