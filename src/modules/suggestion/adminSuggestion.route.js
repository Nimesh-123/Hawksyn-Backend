const express = require('express');
const route = express.Router();
const suggestionController = require('./suggestion.controller.js');
const authMiddleware = require('../../../middleware/auth.js');

/**
 * @swagger
 * /admin/suggestions:
 *   get:
 *     summary: Get all suggestions for admin review
 *     tags: [Admin - Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_public
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Admin suggestions fetched successfully
 *       500:
 *         description: Server error
 */
route.get('/', authMiddleware, suggestionController.getAdminSuggestions);

/**
 * @swagger
 * /admin/suggestions/{id}:
 *   put:
 *     summary: Update suggestion status/visibility
 *     tags: [Admin - Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Acknowledged, WIP, Delivered]
 *               is_public:
 *                 type: boolean
 *               shipped_version:
 *                 type: string
 *     responses:
 *       200:
 *         description: Suggestion updated successfully
 *       404:
 *         description: Suggestion not found
 *       500:
 *         description: Server error
 */
route.put('/:id', authMiddleware, suggestionController.updateSuggestionStatus);

/**
 * @swagger
 * /admin/suggestions/{id}:
 *   delete:
 *     summary: Delete/Reject a suggestion
 *     tags: [Admin - Suggestions]
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
 *         description: Suggestion deleted successfully
 *       404:
 *         description: Suggestion not found
 *       500:
 *         description: Server error
 */
route.delete('/:id', authMiddleware, suggestionController.deleteSuggestion);

module.exports = route;
