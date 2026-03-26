const express = require('express');
const router = express.Router();
const userProfileController = require('../controllers/userProfileController');



/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Load profile for onboarding review
 *     tags: [2. Onboarding (Profile Setup)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       404:
 *         description: Please upload your CV first
 */
router.get('/profile', userProfileController.getUserProfile);

/**
 * @swagger
 * /user/profile:
 *   put:
 *     summary: User edits + confirms profile during onboarding
 *     description: Submits edits (partial update supported - only send changed fields). Finalizes the persistent user profile.
 *     tags: [2. Onboarding (Profile Setup)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               profile:
 *                 type: object
 *               assumptionsReview:
 *                 type: array
 *                 items:
 *                   type: object
 *           example:
 *             profile:
 *               identity:
 *                 fullName: "Mohd Zaid"
 *                 currentRoleTitle: "Senior Android Developer"
 *               composition:
 *                 skills:
 *                   technical: ["Java", "Kotlin", "React Native"]
 *                   languagesSpoken: ["Hindi", "English"]
 *               inferred:
 *                 seniorityLevel: "Mid-Level"
 *             assumptionsReview:
 *               - aeuId: "AEU_INF_001"
 *                 action: "CONFIRMED"
 *               - aeuId: "AEU_INF_003"
 *                 action: "CORRECTED"
 *     responses:
 *       200:
 *         description: Profile confirmed successfully
 *       404:
 *         description: User profile not found
 */

router.put('/profile', userProfileController.updateUserProfile);

module.exports = router;
