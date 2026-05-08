const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { db } = require('../models/index.model');
const RESPONSE = require('../../utils/response');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('../../utils/encryption');

/**
 * Setup 2FA: Generate secret and QR code
 * GET /api/v1/admin/2fa/setup
 */
exports.setup2FA = async (req, res) => {
    try {
        const adminId = req.user.id;
        const admin = await db.Admin.findById(adminId);
        
        if (!admin) {
            return RESPONSE.error(res, 404, 1005, 'Admin not found');
        }

        // Generate a new secret
        const secret = speakeasy.generateSecret({
            name: `Hawksyn Admin (${admin.email})`
        });

        // Generate QR code DataURL
        const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

        return RESPONSE.success(res, 200, 1001, {
            secret: secret.base32,
            qrCode: qrCodeDataURL
        }, 'Scan this QR code in your Authenticator app');
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Verify and Enable 2FA
 * POST /api/v1/admin/2fa/enable
 */
exports.enable2FA = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { secret, token } = req.body;

        if (!secret || !token) {
            return RESPONSE.error(res, 400, 1002, 'Secret and token are required');
        }

        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token
        });

        if (!verified) {
            return RESPONSE.error(res, 400, 1007, 'Invalid verification code');
        }

        // Generate backup codes
        const backupCodes = Array.from({ length: 10 }, () => 
            Math.random().toString(36).substring(2, 10).toUpperCase()
        );

        // Update admin document
        await db.Admin.findByIdAndUpdate(adminId, {
            twoFactorSecret: encrypt(secret),
            isTwoFactorEnabled: true,
            twoFactorBackupCodes: backupCodes.map(code => encrypt(code))
        });

        return RESPONSE.success(res, 200, 1001, {
            backupCodes
        }, '2FA enabled successfully. Please save your backup codes.');
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Verify 2FA during Login
 * POST /api/v1/admin/2fa/verify-login
 */
exports.verify2FALogin = async (req, res) => {
    try {
        const { email, token } = req.body;

        if (!email || !token) {
            return RESPONSE.error(res, 400, 1002, 'Email and token are required');
        }

        const admin = await db.Admin.findOne({ email });
        if (!admin || !admin.isTwoFactorEnabled) {
            return RESPONSE.error(res, 400, 1008, '2FA not enabled for this account');
        }

        const verified = speakeasy.totp.verify({
            secret: decrypt(admin.twoFactorSecret),
            encoding: 'base32',
            token: token,
            window: 1 // allow 30s drift
        });

        if (!verified) {
            // Check backup codes
            let backupIndex = -1;
            for (let i = 0; i < admin.twoFactorBackupCodes.length; i++) {
                if (decrypt(admin.twoFactorBackupCodes[i]) === token.toUpperCase()) {
                    backupIndex = i;
                    break;
                }
            }
            
            if (backupIndex !== -1) {
                // Remove used backup code
                admin.twoFactorBackupCodes.splice(backupIndex, 1);
                await admin.save();
            } else {
                return RESPONSE.error(res, 401, 1007, 'Invalid verification code');
            }
        }

        // Issue tokens
        const accessToken = jwt.sign(
            { id: admin._id, email: admin.email, role: admin.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );
        const refreshToken = jwt.sign(
            { id: admin._id, email: admin.email, role: admin.role }, 
            process.env.JWT_SECRET_REFRESH || 'refresh_secret', 
            { expiresIn: '365d' }
        );

        admin.refreshToken = refreshToken;
        await admin.save();

        const adminResponse = admin.toObject();
        delete adminResponse.password;
        delete adminResponse.refreshToken;
        delete adminResponse.twoFactorSecret;

        return RESPONSE.success(res, 200, 1006, { 
            admin: adminResponse, 
            accessToken, 
            refreshToken 
        }, 'Login successful');
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * Disable 2FA
 * POST /api/v1/admin/2fa/disable
 */
exports.disable2FA = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { token } = req.body;

        const admin = await db.Admin.findById(adminId);
        if (!admin.isTwoFactorEnabled) {
            return RESPONSE.error(res, 400, 1008, '2FA is not enabled');
        }

        const verified = speakeasy.totp.verify({
            secret: decrypt(admin.twoFactorSecret),
            encoding: 'base32',
            token: token
        });

        if (!verified) {
            return RESPONSE.error(res, 401, 1007, 'Invalid verification code');
        }

        admin.isTwoFactorEnabled = false;
        admin.twoFactorSecret = null;
        admin.twoFactorBackupCodes = [];
        await admin.save();

        return RESPONSE.success(res, 200, 1001, null, '2FA disabled successfully');
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
