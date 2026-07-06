const express = require('express');
const route = express.Router();
const ratingController = require('./rating.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

/**
 * @swagger
 * /admin/ratings:
 *   get:
 *     summary: Get all app ratings
 *     tags: [Admin - Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: low_score_only
 *         schema:
 *           type: boolean
 *         description: If true, only returns ratings with overall_experience <= 3
 *     responses:
 *       200:
 *         description: Ratings fetched successfully
 *       500:
 *         description: Server error
 */
// NOTE: Not applying authMiddleware here if it causes double-auth issues as seen previously,
// but since the rest of the app uses it, I'll include it.
route.get('/', authMiddleware, ratingController.getAllRatings);

/**
 * @swagger
 * /admin/ratings/stats:
 *   get:
 *     summary: Get aggregate rating statistics
 *     tags: [Admin - Ratings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats fetched successfully
 *       500:
 *         description: Server error
 */
route.get('/stats', authMiddleware, ratingController.getRatingStats);

module.exports = route;
