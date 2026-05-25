const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const expertController = require('../expert/expert.controller.js');


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
 * /admin/manage/run-audit/cost/{runId}:
 *   get:
 *     summary: Get Total AI Cost for a specific Run (Case)
 *     description: Aggregates token usage and costs from CV parsing, signals, reports, and clock recalibrations for a specific run.
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier for the run
 *     responses:
 *       200:
 *         description: AI cost audit retrieved successfully
 *       404:
 *         description: Run not found
 */
router.get('/run-audit/cost/:runId', adminController.getRunAICostAudit);

/**
 * @swagger
 * /admin/manage/run-audit/list:
 *   get:
 *     summary: Get List of all Runs with Aggregated AI Costs
 *     description: Returns a paginated list of all assessment runs with their total calculated AI costs in USD and local currency.
 *     tags: ["9. Admin: Dashboard"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user name or email
 *     responses:
 *       200:
 *         description: List of runs with costs retrieved successfully
 */
router.get('/run-audit/list', adminController.getRunsAuditList);

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

