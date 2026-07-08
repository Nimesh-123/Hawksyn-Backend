const express = require('express');
const route = express.Router();
const suggestionController = require('./suggestion.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

/**
 * @swagger
 * /user/suggestions:
 *   post:
 *     summary: Submit a new suggestion
 *     tags: [Suggestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idea
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [Scan, HIP, Reports, Dashboard, Other]
 *               idea:
 *                 type: string
 *                 maxLength: 300
 *     responses:
 *       201:
 *         description: Suggestion submitted successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
route.post('/', authMiddleware, suggestionController.createSuggestion);

/**
 * @swagger
 * /user/suggestions:
 *   get:
 *     summary: Get community suggestions board
 *     tags: [Suggestion]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Community suggestions fetched successfully
 *       500:
 *         description: Server error
 */
route.get('/', authMiddleware, suggestionController.getCommunitySuggestions);

/**
 * @swagger
 * /user/suggestions/{id}:
 *   get:
 *     summary: Get suggestion details
 *     tags: [Suggestion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Suggestion details fetched successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
route.get('/:id', authMiddleware, suggestionController.getSuggestionDetails);

module.exports = route;
