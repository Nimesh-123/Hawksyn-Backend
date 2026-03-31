const { db } = require('../models/index.model.js');
const jwt = require('jsonwebtoken');
const RESPONSE = require('../../utils/response.js');

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Get new Access Token using Refresh Token
 *     tags: ["1. Authentication & Security"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid or expired refresh token
 */
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
        let entity = await db.User.findOne({ _id: decoded.id, refreshToken, isDeleted: false, isBlocked: false });
        if (!entity) {
            entity = await db.Admin.findOne({ _id: decoded.id, refreshToken });
        }

        if (!entity) {
            return RESPONSE.error(res, 401, 1002, "Session expired. Please login again.");
        }

        // 3. Generate New Access Token
        const accessToken = jwt.sign(
            { id: entity._id, email: entity.email, role: entity.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return RESPONSE.success(res, 200, 1001, { accessToken });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
