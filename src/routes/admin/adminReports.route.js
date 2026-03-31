const express = require('express');
const route = express.Router();

const adminController = require('../../controllers/admin.controller.js');

/**
 * @swagger
 * /admin/reports/runs:
 *   get:
 *     summary: List all completed runs (with rating status)
 *     tags: ["10. Admin: AI Training Data"]
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
 *     tags: ["10. Admin: AI Training Data"]
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
 *     tags: ["10. Admin: AI Training Data"]
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
 *     tags: ["10. Admin: AI Training Data"]
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
 *     tags: ["10. Admin: AI Training Data"]
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

module.exports = route;
