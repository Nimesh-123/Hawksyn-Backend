const jwt = require('jsonwebtoken');

/**
 * Simple JWT Authentication Middleware
 */
const auth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: No token provided'
            });
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;

        jwt.verify(token, secret, (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized: Invalid or expired token'
                });
            }
            req.user = decoded;
            next();
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error in authentication'
        });
    }
};

module.exports = auth;
