const mongoose = require('mongoose');

/**
 * Logs a validation failure to MongoDB
 */
async function logValidationFailure(detail) {
    try {
        const ValidationFailure = mongoose.model('ValidationFailure');
        await ValidationFailure.create(detail);
    } catch (err) {
        console.error('❌ [Audit] Failed to log validation failure:', err.message);
    }
}

/**
 * Logs an AEU audit event (DPDP compliance)
 */
async function logAuditEvent(detail) {
    try {
        const AEUAuditLog = mongoose.model('AEUAuditLog');
        await AEUAuditLog.create(detail);
    } catch (err) {
        console.error('❌ [Audit] Failed to log audit event:', err.message);
    }
}

module.exports = {
    logValidationFailure,
    logAuditEvent
};
