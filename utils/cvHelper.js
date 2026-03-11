const { db } = require('../src/models/index.model');

/**
 * Helper to fetch the active CV for a user.
 * 1. Checks the new user_cv_uploads collection first.
 * 2. Falls back to the legacy User collection if not found.
 * 
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object|null>} - The active CV record or null
 */
async function getUserActiveCv(userId) {
    try {
        // 1. Check new collection for active CV
        const activeCv = await db.DocumentUploads.findOne({
            userId,
            isActive: true
        })
            .select('cvUrl uploadedAt parsedCvData')
            .sort({ uploadedAt: -1 })
            .lean();

        if (activeCv) {
            return {
                cvUrl: activeCv.cvUrl,
                cvUploadedAt: activeCv.uploadedAt,
                parsedCvData: activeCv.parsedCvData,
                source: 'user_cv_uploads'
            };
        }

        console.warn(`[CV Helper] No active CV found for user: ${userId}`);
        return null;
    } catch (error) {
        console.error("Error in getUserActiveCv:", error);
        return null;
    }
}

module.exports = {
    getUserActiveCv
};
