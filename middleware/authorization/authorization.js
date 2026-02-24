const jwt = require('jsonwebtoken');
const RESPONSE = require('../../utils/response.js');
const { db } = require('../../src/models/index.model.js');

exports.user_auth = async (req, res, next) => {
    try {
        const exclude_employee_auth_routes = [
            '/auth',
            '/user/send-otp',
            '/user/verify-otp',
            '/user/set-pin',
            '/user/login-with-pin'
        ];

        const fullPath = req.originalUrl || '';
        const apiPrefix = (process.env.API_COMMON_ROUTE || '/api/v1').trim();

        let cleanPath = fullPath;
        if (fullPath.startsWith(apiPrefix)) {
            cleanPath = fullPath.slice(apiPrefix.length);
        }

        const isPublicRoute = exclude_employee_auth_routes.some(
            route => cleanPath === route || cleanPath.startsWith(route + '/')
        );

        if (isPublicRoute) {
            return next();
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return RESPONSE.error(res, 401, 3001, 'No token provided');
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) return RESPONSE.error(res, 500, 9999, 'Internal configuration error');

        try {
            const decoded = jwt.verify(token, secret);
            req.role = decoded.role;

            const user = await db.User.findById(decoded.id);
            if (!user || user.isDeleted) return RESPONSE.error(res, 404, 3001);
            if (user.isBlocked) return RESPONSE.error(res, 403, 3003);

            req.user = decoded;
            next();
        } catch (err) {
            return RESPONSE.error(res, 401, 9999, 'Invalid token');
        }
    } catch (e) {
        return RESPONSE.error(res, 500, 9999, 'Internal server error');
    }
};

exports.verifyToken = async token => {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    const user = await db.User.findById(decoded.id);
    if (!user || user.isDeleted || user.isBlocked) throw new Error('Unauthorized');
    return decoded;
};
