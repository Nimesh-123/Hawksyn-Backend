const express = require('express');
const route = express.Router();

const adminController = require('./admin.controller.js');

/**
 * @swagger
 * /admin/reports/runs:
 *   get:
 *     summary: List all completed runs (with rating status)
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rated
 *         schema: { type: string, enum: [true, false] }
 *         description: "Filter: 'true' = already rated, 'false' = pending rating"
 *       - in: query
 *         name: caseId
 *         schema: { type: string }
 *       - in: query
 *         name: intentId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of completed runs with rating info
 */
route.get('/runs', adminController.getAllCompletedRuns);

/**
 * @swagger
 * /admin/reports/{runId}/review:
 *   get:
 *     summary: Get complete review package for a run (CV + Answers + Report)
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The runId to review
 *     responses:
 *       200:
 *         description: Full review package (user info, CV, Q&A, integrity, report, current rating)
 *       404:
 *         description: Run or report not found
 */
route.get('/:runId/review', adminController.getReportForReview);

/**
 * @swagger
 * /admin/reports/rated:
 *   get:
 *     summary: Get all admin-rated reports (AI Training Data Leaderboard)
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minRating
 *         schema: { type: integer, default: 1 }
 *         description: Minimum star rating to filter (use 5 for Gold Standard only)
 *       - in: query
 *         name: caseId
 *         schema: { type: string }
 *       - in: query
 *         name: intentId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of rated reports with gold standard count
 */
route.get('/rated', adminController.getRatedReports);

/**
 * @swagger
 * /admin/reports/{rasId}/rate:
 *   post:
 *     summary: Rate a completed report (1–5 stars) for AI training
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rasId
 *         required: true
 *         schema: { type: string }
 *         description: The rasId of the FINAL_REPORT RAS artifact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: "5 = Gold Standard (AI uses this as training context)"
 *     responses:
 *       200:
 *         description: Report rated successfully
 *       404:
 *         description: Report not found
 */
route.post('/:rasId/rate', adminController.rateReport);

/**
 * @swagger
 * /admin/reports/{runId}/re-run-policy:
 *   patch:
 *     summary: Update Re-run policy (Free/Paid/Expiry/Price) for a specific run
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eligibleForFreeReRun: { type: boolean }
 *               freeReRunExpiryDate: { type: string, format: date-time }
 *               reRunPriceOverride: { type: number, nullable: true }
 *     responses:
 *       200:
 *         description: Re-run policy updated successfully
 */
route.patch('/:runId/re-run-policy', adminController.updateReRunPolicy);

route.post('/:runId/audit-finalize', adminController.submitExpertReview);

// S3 Secure Downloads (Sprint 8)

/**
 * @swagger
 * /admin/reports/{runId}/invoice/download:
 *   get:
 *     summary: Download the tax invoice (PDF) securely from S3
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success! Direct PDF download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Invoice not found
 */
route.get('/:runId/invoice/download', adminController.downloadInvoiceS3);

/**
 * @swagger
 * /admin/reports/{runId}/report/download:
 *   get:
 *     summary: Direct PDF download of the final AI report
 *     tags: ["11. Admin: AI Training Data"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success! Direct PDF download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Report not found
 */
route.get('/:runId/report/download', adminController.downloadReportS3);

module.exports = route;
