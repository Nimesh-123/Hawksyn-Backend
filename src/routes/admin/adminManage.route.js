const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const { authenticate } = require('../../../middleware/authorization/authorization');

/**
 * @swagger
 * /admin/manage/create:
 *   post:
 *     summary: Create a new Sub-Admin (Super Admin Only)
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       210:
 *         description: Sub-admin created successfully
 *       403:
 *         description: Permission denied
 */
router.post('/create', authenticate, adminController.createSubAdmin);

/**
 * @swagger
 * /admin/manage/list:
 *   get:
 *     summary: Get all Sub-Admins (Super Admin Only)
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       100:
 *         description: List of sub-admins
 *       403:
 *         description: Permission denied
 */
router.get('/list', authenticate, adminController.getSubAdmins);

/**
 * @swagger
 * /admin/manage/{id}:
 *   delete:
 *     summary: Delete a Sub-Admin (Super Admin Only)
 *     tags: [9. Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin ID to delete
 *     responses:
 *       110:
 *         description: Sub-admin deleted successfully
 *       403:
 *         description: Permission denied
 */
router.delete('/:id', authenticate, adminController.deleteSubAdmin);

module.exports = router;
