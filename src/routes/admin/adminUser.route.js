const express = require('express');
const route = express.Router();
const adminController = require('../../controllers/admin.controller.js');

/**
 * @swagger
 * /admin/users/all:
 *   get:
 *     summary: Get all users (Active + Deleted)
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of all users
 * 
 * /admin/users/active:
 *   get:
 *     summary: Get only active users
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of active users
 * 
 * /admin/users/deleted:
 *   get:
 *     summary: Get only soft-deleted users
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of soft-deleted users
 * 
 * /admin/users/{userId}/details:
 *   get:
 *     summary: Get full user details and history
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full user profile and historical data
 * 
 * /admin/users/{userId}/block:
 *   patch:
 *     summary: Block or unblock a user
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isBlocked
 *             properties:
 *               isBlocked:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User block status updated successfully
 */

route.get('/all', adminController.getAllUsers);
route.get('/active', adminController.getActiveUsers);
route.get('/deleted', adminController.getDeletedUsers);
route.get('/:userId/details', adminController.getUserDetails);
route.patch('/:userId/block', adminController.blockUser);

module.exports = route;
