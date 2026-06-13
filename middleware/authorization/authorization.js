const jwt = require('jsonwebtoken');
const RESPONSE = require('../../utils/response.js');
const { db } = require('../../src/models/index.model.js');

/**
 * Authentication Middleware
 * 1. Checks if token exists (Bearer Token)
 * 2. Verifies JWT
 * 3. Checks if user/admin exists and is not blocked/deleted
 * 4. Attaches decoded payload to req.user
 */
exports.authenticate = async (req, res, next) => {
    // console.log(`[Auth] Incoming Request: ${req.method} ${req.originalUrl}`);
    try {
        const public_routes = [
            '/auth',
            '/user/send-otp',
            '/user/verify-otp',
            '/user/set-pin',
            '/user/login-with-pin',
            '/user/forgot-pin',
            '/user/auth/google',
            '/expert/auth/login',
            '/hip/public'
        ];

        const fullPath = req.originalUrl || '';
        const apiPrefix = (process.env.API_COMMON_ROUTE || '/api/v1').trim();

        let cleanPath = fullPath;
        if (fullPath.startsWith(apiPrefix)) {
            cleanPath = fullPath.slice(apiPrefix.length);
        }

        const isPublicRoute = public_routes.some(
            route => cleanPath === route || cleanPath.startsWith(route + '/')
        );

        if (isPublicRoute || cleanPath.includes('/hip/public')) {
            return next();
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return RESPONSE.error(res, 401, 3001, 'Unauthorized: No token provided');
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) return RESPONSE.error(res, 500, 9999, 'Internal configuration error');

        try {
            const decoded = jwt.verify(token, secret);

            // --- Centralized Authorization Logic ---
            const admin_roles = ['admin', 'sub_admin'];
            const isAdminRoute = cleanPath.startsWith('/admin');

            let entity;
            let role = decoded.role;
            // console.log('[DEBUG Auth] Decoded role:', role, 'ID:', decoded.id, 'Path:', cleanPath);

            if (role?.includes('admin')) {
                entity = await db.Admin.findById(decoded.id);
            } else if (role === 'expert') {
                const expert = await db.RiskAuditorRegistry.findById(decoded.id);
                if (!expert) return RESPONSE.error(res, 404, 3001, 'Expert not found');
                entity = expert;
            } else {
                const user = await db.User.findById(decoded.id);
                if (!user) return RESPONSE.error(res, 404, 3001, 'User not found');
                
                entity = user;
                role = user.role;

                if (role === 'expert') {
                    const expert = await db.RiskAuditorRegistry.findOne({ 
                        email: { $regex: new RegExp(`^${user.email}$`, 'i') } 
                    });
                    if (expert) {
                        entity = expert;
                    }
                }
            }

            if (!entity) return RESPONSE.error(res, 404, 3001, 'User/Admin/Expert not found');

            // User specific checks (only for normal users)
            if (!role?.includes('admin')) {
                const isProfileRoute = cleanPath === '/expert/profile';
                if (role === 'expert' && entity.status !== 'ACTIVE' && !isProfileRoute) {
                    return RESPONSE.error(res, 403, 3003, 'Expert account is inactive');
                }
                
                if (entity.isDeleted) return RESPONSE.error(res, 404, 3001, 'Account is deleted');
                if (entity.isBlocked) return RESPONSE.error(res, 403, 3003, 'Account is blocked');
            }

            req.user = { 
                ...decoded,
                id: entity._id.toString(), // Convert to string for consistent comparison in controllers
                email: decoded.email, 
                role: role || 'user'
            };

            const isExpertAuditingRoute = cleanPath.includes('/audit-finalize');
            
            if (isAdminRoute && !admin_roles.includes(role)) {
                if (role === 'expert' && isExpertAuditingRoute) {
                    // Allowed
                } else {
                    return RESPONSE.error(res, 403, 4444, 'Permission Denied: Admin access required');
                }
            }
            // --- End of Authorization Logic ---

            next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return RESPONSE.error(res, 401, 1002, 'Token Expired');
            }
            return RESPONSE.error(res, 401, 1002, 'Invalid Token');
        }
    } catch (e) {
        return RESPONSE.error(res, 500, 9999, 'Internal server error');
    }
};

/**
 * Authorization Middleware (RBAC)
 * Verifies if the user's role is among the allowed roles for the route
 */
exports.authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return RESPONSE.error(res, 401, 3001, 'Unauthorized: Access Denied');
        }

        if (!allowedRoles.includes(req.user.role)) {
            return RESPONSE.error(res, 403, 4444, 'Permission Denied: You do not have access to this resource');
        }

        next();
    };
};
