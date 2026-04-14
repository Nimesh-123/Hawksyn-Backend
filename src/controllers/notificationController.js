const { db } = require('../models/index.model');
const RESPONSE = require('../../utils/response');

/**
 * Controller to manage In-App Notifications for Users and Admins
 */

// 1. Get Notifications (Paginated)
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const { page = 1, limit = 20 } = req.query;

        let query = { isDeleted: false };

        // Logic: Admin gets all admin-targeted alerts, Users get only their own
        if (role === 'admin' || role === 'sub_admin') {
            query.targetRole = { $in: ['admin', 'sub_admin', 'ALL'] };
        } else if (role === 'expert') {
            query.targetRole = { $in: ['expert', 'ALL'] };
        } else {
            query.userId = userId;
        }

        const notifications = await db.Notifications.find(query)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await db.Notifications.countDocuments(query);
        const unreadCount = await db.Notifications.countDocuments({ ...query, isRead: false });

        return RESPONSE.success(res, 200, 1001, {
            notifications,
            total,
            unreadCount,
            page: Number(page)
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// 2. Mark Multiple as Read
exports.markAsRead = async (req, res) => {
    try {
        const { notificationIds } = req.body; // Array of IDs

        if (!notificationIds || !Array.isArray(notificationIds)) {
            return RESPONSE.error(res, 400, 1002, "notificationIds array is required");
        }

        await db.Notifications.updateMany(
            { _id: { $in: notificationIds } },
            { $set: { isRead: true } }
        );

        return RESPONSE.success(res, 200, 1001, { message: "Notifications marked as read" });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// 3. Mark All as Read
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = { isRead: false };
        if (role === 'admin' || role === 'sub_admin') {
            query.targetRole = { $in: ['admin', 'sub_admin', 'ALL'] };
        } else {
            query.userId = userId;
        }

        await db.Notifications.updateMany(query, { $set: { isRead: true } });

        return RESPONSE.success(res, 200, 1001, { message: "All notifications marked as read" });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// 4. Delete Notification (Soft Delete)
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await db.Notifications.findByIdAndUpdate(id, { $set: { isDeleted: true } });
        return RESPONSE.success(res, 200, 1001, { message: "Notification removed" });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
