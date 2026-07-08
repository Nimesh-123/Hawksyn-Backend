const { db } = require('../../models/index.model');
const RESPONSE = require('../../../utils/response');

/**
 * Controller to manage In-App Notifications for Users and Admins
 */

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const { page = 1, limit = 20 } = req.query;

        let query = { isDeleted: false };

        // Logic: Admin gets all admin-targeted alerts, Users get only their own
        if (role === 'admin' || role === 'sub_admin') {
            query.targetRole = { $in: ['admin', 'sub_admin', 'ALL'] };
            query.type = { $ne: 'INTAKE_COMPLETE' };
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

exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await db.Notifications.findByIdAndUpdate(id, { $set: { isDeleted: true } });
        return RESPONSE.success(res, 200, 1001, { message: "Notification removed" });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        let query = { isDeleted: false, isRead: false };

        if (role === 'admin' || role === 'sub_admin') {
            query.targetRole = { $in: ['admin', 'sub_admin', 'ALL'] };
        } else {
            query.userId = userId;
        }

        const count = await db.Notifications.countDocuments(query);
        return RESPONSE.success(res, 200, 1001, { unreadCount: count });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        const { 
            push, email, whatsapp,
            clockCritical, clockExpired, expertReplied, 
            chatClosing, reportReady, rerunReminder, productUpdates 
        } = req.body;
        
        const userId = req.user.id;
        const updateData = {};

        // Core Toggles
        if (push !== undefined)  updateData['notificationPreferences.push'] = push;
        if (email !== undefined) updateData['notificationPreferences.email'] = email;
        if (whatsapp !== undefined) updateData['notificationPreferences.whatsapp'] = whatsapp;

        // Notification Toggles
        if (clockExpired !== undefined)  updateData['notificationPreferences.clockExpired'] = clockExpired;
        if (expertReplied !== undefined) updateData['notificationPreferences.expertReplied'] = expertReplied;
        if (chatClosing !== undefined)   updateData['notificationPreferences.chatClosing'] = chatClosing;
        if (reportReady !== undefined)   updateData['notificationPreferences.reportReady'] = reportReady;
        if (rerunReminder !== undefined) updateData['notificationPreferences.rerunReminder'] = rerunReminder;
        if (productUpdates !== undefined) updateData['notificationPreferences.productUpdates'] = productUpdates;

        // ENFORCEMENT: clockCritical is LOCKED to true
        // Even if the client sends false, we force it to true.
        if (clockCritical !== undefined) {
            updateData['notificationPreferences.clockCritical'] = true; 
        }

        const updatedUser = await db.User.findByIdAndUpdate(
            userId, 
            { $set: updateData }, 
            { new: true }
        );

        return RESPONSE.success(res, 200, 1001, { 
            message: 'Notification preferences updated',
            preferences: updatedUser.notificationPreferences 
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.createNotification = async (req, res) => {
    try {
        const { targetRole, title, message, type, metadata, targetUserId } = req.body;
        
        // Ensure required fields
        if (!title || !message || !type) {
            return RESPONSE.error(res, 400, 1002, "title, message, and type are required");
        }

        const newNotification = await db.Notifications.create({
            userId: targetUserId || req.user.id,
            targetRole: targetRole || 'user',
            title,
            message,
            type,
            metadata
        });
        
        return RESPONSE.success(res, 201, 1001, {
            message: "Notification created successfully",
            notification: newNotification
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
