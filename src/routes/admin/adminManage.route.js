const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const expertController = require('../../controllers/expertController');


/**
 * @swagger
 * /admin/manage/create:
 *   post:
 *     summary: Create a new Sub-Admin (Super Admin Only)
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
router.post('/create', adminController.createSubAdmin);

/**
 * @swagger
 * /admin/manage/list:
 *   get:
 *     summary: Get all Sub-Admins (Super Admin Only)
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       100:
 *         description: List of sub-admins
 *       403:
 *         description: Permission denied
 */
router.get('/list', adminController.getSubAdmins);

/**
 * @swagger
 * /admin/manage/{id}:
 *   delete:
 *     summary: Delete a Sub-Admin (Super Admin Only)
 *     tags: ["9. Admin: Dashboard"]
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
router.delete('/:id', adminController.deleteSubAdmin);

/**
 * @swagger
 * /admin/manage/experts/list:
 *   get:
 *     summary: List all registered experts
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 */
router.get('/experts/list', expertController.getAllExperts);

/**
 * @swagger
 * /admin/manage/experts/{id}:
 *   patch:
 *     summary: Update an expert
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/experts/:id', expertController.updateExpert);

/**
 * @swagger
 * /admin/manage/experts/{id}:
 *   delete:
 *     summary: Delete an expert
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/experts/:id', expertController.deleteExpert);

/**
 * @swagger
 * /admin/manage/cv-audit:
 *   get:
 *     summary: Audit CV Parsing successes and failures
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 */
router.get('/cv-audit', adminController.getCvAuditLogs);

router.get('/cv-audit/download/:id', adminController.downloadCvAuditS3);

/**
 * @swagger
 * /admin/manage/cv-audit/{id}:
 *   get:
 *     summary: Get single CV Audit log details
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 */
router.get('/cv-audit/:id', adminController.getCvAuditDetails);

/**
 * @swagger
 * /admin/manage/credits/update:
 *   post:
 *     summary: Manually update user credits (Admin Only)
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               checksDelta:
 *                 type: number
 *                 description: Amount to add/subtract from Hawk Checks
 *               chatDelta:
 *                 type: number
 *                 description: Amount to add/subtract from Expert Queries
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credits updated successfully
 */
router.post('/credits/update', adminController.updateUserCredits);

module.exports = router;

