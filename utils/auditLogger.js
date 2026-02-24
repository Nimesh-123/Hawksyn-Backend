const { db } = require('../src/models/index.model.js');

/**
 * Helper to log user activities to AuditLog collection
 */
const createAuditLog = async (req, action, userId = null, metadata = {}) => {
    try {
        await db.AuditLog.create({
            userId: userId || (req.user ? req.user.id : null),
            action,
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata
        });
    } catch (err) {
        console.error('Audit Log Error:', err.message);
    }
};

module.exports = { createAuditLog };
