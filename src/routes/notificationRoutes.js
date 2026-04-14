const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

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

module.exports = router;
