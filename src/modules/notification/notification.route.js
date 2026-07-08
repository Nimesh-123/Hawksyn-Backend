const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get in-app notifications (Targeted by role and userId)
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications with total and unread counts
 */
router.get('/', notificationController.getNotifications);

/**
 * @swagger
 * /notifications/read:
 *   patch:
 *     summary: Mark specific notifications as read
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.patch('/read', notificationController.markAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications for current user/role as read
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Soft-delete a single notification
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * @swagger
 * /notifications/count:
 *   get:
 *     summary: Get unread notification count (Slide 17)
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 */
router.get('/count', notificationController.getUnreadCount);

/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update notification preferences (Slide 17)
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               push:
 *                 type: boolean
 *               email:
 *                 type: boolean
 *               criticalAlertsOnly:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Success
 */
router.patch('/preferences', notificationController.updatePreferences);

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Create a mock notification for testing
 *     tags: ["14. Notifications & Alerts"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetRole:
 *                 type: string
 *                 example: "user"
 *               targetUserId:
 *                 type: string
 *                 description: "Optional. Leave blank to target the logged-in user."
 *               title:
 *                 type: string
 *                 example: "Your clocks have been updated."
 *               message:
 *                 type: string
 *                 example: "Refresh notification"
 *               type:
 *                 type: string
 *                 example: "CLOCK_REFRESHED"
 *               metadata:
 *                 type: object
 *                 example: {}
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post('/', notificationController.createNotification);

module.exports = router;
