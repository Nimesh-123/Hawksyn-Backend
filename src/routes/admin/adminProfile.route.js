const express = require('express');
const route = express.Router();
const adminController = require('../../controllers/admin.controller.js');

/**
 * @swagger
 * /admin/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile data
 *   put:
 *     summary: Update admin profile
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 * 
 * /admin/profile/change-password:
 *   patch:
 *     summary: Change admin password
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */

route.get('/', adminController.getAdminProfile);
route.put('/', adminController.updateAdminProfile);
route.patch('/change-password', adminController.changeAdminPassword);

module.exports = route;
