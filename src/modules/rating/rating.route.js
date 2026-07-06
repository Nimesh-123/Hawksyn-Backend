const express = require('express');
const route = express.Router();
const ratingController = require('./rating.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

/**
 * @swagger
 * /user/ratings:
 *   post:
 *     summary: Submit a new app rating
 *     tags: [Rating]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scan_accuracy:
 *                 type: number
 *                 description: Score from 1 to 5
 *               ease_of_use:
 *                 type: number
 *                 description: Score from 1 to 5
 *               overall_experience:
 *                 type: number
 *                 description: Score from 1 to 5
 *     responses:
 *       201:
 *         description: Rating submitted successfully
 *       400:
 *         description: Bad request (invalid score)
 *       500:
 *         description: Server error
 */
route.post('/', authMiddleware, ratingController.submitRating);

module.exports = route;
