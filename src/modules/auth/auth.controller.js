const { db } = require('../../models/index.model.js');
const jwt = require('jsonwebtoken');
const RESPONSE = require('../../../utils/response.js');


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

        // 2. Find user/admin/expert in DB and check if token matches
        // Order: Admin -> Expert -> User
        let entity = await db.Admin.findOne({ _id: decoded.id, refreshToken });
        let role = entity ? entity.role : null;
        
        if (!entity) {
            entity = await db.RiskAuditorRegistry.findOne({ _id: decoded.id, refreshToken, isActive: true });
            if (entity) role = 'expert';
        }

        if (!entity) {
            entity = await db.User.findOne({ _id: decoded.id, refreshToken, isDeleted: false, isBlocked: false });
            if (entity) role = entity.role || 'user';
        }

        if (!entity) {
            console.error(`[Auth] Refresh failed: Entity not found for ID ${decoded.id} or token mismatch.`);
            return RESPONSE.error(res, 401, 1002, "Session expired. Please login again.");
        }

        // 3. Generate New Access Token
        const accessToken = jwt.sign(
            { id: entity._id, email: entity.email, role: role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        console.log(`[Auth] Access Token refreshed successfully for ${entity.email} (${entity.role || 'user'})`);

        return RESPONSE.success(res, 200, 1001, { accessToken });

    } catch (err) {
        console.error('[Auth] Refresh Error:', err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
