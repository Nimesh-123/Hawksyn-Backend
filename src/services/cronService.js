const cron = require('node-cron');
const { db } = require('../models/index.model');
const notificationService = require('./notificationService');
const signalService = require('../modules/signals/services/signalService.js');
const logger = require('../../utils/logger');

/**
 * Hawksyn Cron Service
 * Runs background tasks for scheduled notifications
 */
class CronService {
    init() {
        // Runs every day at 10:00 AM
        cron.schedule('0 10 * * *', () => {
            this.processScheduledNotifications();
        });

        // NEW: Reset Daily Caseload for all experts at Midnight (00:00)
        cron.schedule('0 0 * * *', () => {
            this.resetDailyCaseloads();
            this.processPermanentDeletions(); // Also process 30-day permanent deletions
        });

        // B35: Refresh Stale Market Signals (Every Wednesday at 3 AM)
        cron.schedule('0 3 * * 3', () => {
            signalService.refreshStaleSignals(30); // Refresh signals older than 30 days
        });

        logger.info('[Cron] Notification Scheduler Initialized (Daily at 10 AM)');
        logger.info('[Cron] Daily Caseload Resetter Initialized (Daily at Midnight)');
        logger.info('[Cron] Signal Refresh Service Initialized (Wednesdays at 3 AM)');
    }

    async resetDailyCaseloads() {
        try {
            logger.info('[Cron] Resetting Daily Caseload Counts for all experts...');
            await db.RiskAuditorRegistry.updateMany({}, { $set: { dailyCaseloadCount: 0 } });
            logger.info('[Cron] Daily Caseload Reset Complete.');
        } catch (error) {
            logger.error(`[Cron Error] Failed to reset caseloads: ${error.message}`);
        }
    }

    async processPermanentDeletions() {
        try {
            logger.info('[Cron] Starting 30-day permanent account deletion process...');
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Find users who have been soft-deleted for more than 30 days
            const usersToDelete = await db.User.find({
                isDeleted: true,
                deletedAt: { $lte: thirtyDaysAgo }
            }).select('_id');

            if (usersToDelete.length === 0) {
                logger.info('[Cron] No accounts pending permanent deletion today.');
                return;
            }

            for (const user of usersToDelete) {
                const userId = user._id;
                logger.info(`[Cron] Permanently deleting account for user: ${userId}`);

                const runs = await db.Runs.find({ userId }).select('runId');
                const runIds = runs.map(r => r.runId);

                if (runIds.length > 0) {
                    await db.Ras.deleteMany({ runId: { $in: runIds } });
                    await db.CaseFile.deleteMany({ runId: { $in: runIds } });
                }

                await db.Runs.deleteMany({ userId });
                await db.Payments.deleteMany({ userId });
                await db.UserProfile.deleteMany({ userId });
                await db.DocumentUploads.deleteMany({ userId });
                await db.ExtractedCV.deleteMany({ candidate_id: userId });
                await db.PSDEResult.deleteMany({ candidate_id: userId });
                await db.AEUAuditLog.deleteMany({ candidate_id: userId });
                await db.HipProfile.deleteMany({ userId });
                await db.Notifications.deleteMany({ userId });
                await db.ExpertQuery.deleteMany({ userId });
                await db.ChatMessage.deleteMany({ senderId: userId });
                await db.UserClocks.deleteMany({ userId });
                await db.ClockHistory.deleteMany({ userId });
                await db.UserCredits.deleteMany({ userId });
                await db.AuditLog.deleteMany({ userId });
                
                await db.User.findByIdAndDelete(userId);
            }

            logger.info(`[Cron] Successfully permanently deleted ${usersToDelete.length} accounts.`);
        } catch (error) {
            logger.error(`[Cron Error] Failed to process permanent deletions: ${error.message}`);
        }
    }

    async processScheduledNotifications() {
        try {
            logger.info('[Cron] Starting Daily Notification Scan...');
            const today = new Date();

            // 1. VERDICT EXPIRY CHECKS (#8, #9)
            // Expiry is 180 days after completion. Alerts at 173 (7 days left) and 178 (2 days left)
            const runs = await db.Runs.find({ status: 'REPORT_COMPLETE', completedAt: { $ne: null } }).populate('userId');

            for (const run of runs) {
                const ageInDays = Math.floor((today - run.completedAt) / (1000 * 60 * 60 * 24));

                if (ageInDays === 173) { // 7 Days Remaining
                    await notificationService.notifyVerdictExpiry(run.runId, run.userId, 7);
                } else if (ageInDays === 178) { // 2 Days Remaining
                    await notificationService.notifyVerdictExpiry(run.runId, run.userId, 2);
                }

                // 2. SLA BREACH CHECK (#10)
                // If expert assigned but not reviewed within 48 hours
                if (run.status === 'EXPERT_ASSIGNED' && run.expertAssignedAt && !run.expertReviewedAt) {
                    const hoursElapsed = Math.floor((today - run.expertAssignedAt) / (1000 * 60 * 60));
                    if (hoursElapsed >= 48 && hoursElapsed < 72) {
                        await notificationService.notifySLABreach(run.runId, run.userId);
                    }
                }
            }

            // 3. CHAT WINDOW CLOSING (#11)
            // Logic: 3 days before 30-day window expires
            // (Assumes completedAt marks the start of the 30-day chat window)
            const chatExpiryTarget = new Date(today);
            chatExpiryTarget.setDate(today.getDate() - 27); // 3 days before 30 days = Day 27

            const expiringChats = await db.Runs.find({
                status: 'REPORT_COMPLETE',
                completedAt: {
                    $gte: new Date(chatExpiryTarget.setHours(0, 0, 0, 0)),
                    $lt: new Date(chatExpiryTarget.setHours(23, 59, 59, 999))
                }
            }).populate('userId');

            for (const chatRun of expiringChats) {
                await notificationService.notifyExpertChatReply(chatRun.runId, chatRun.userId); // This notifies they should check chat
            }

            // 4. RE-RUN WINDOW OPEN (#12)
            // (Assumes cooldown expires exactly when reRunSetup.freeReRunExpiryDate is today)
            const rerunEligibility = await db.Runs.find({
                'reRunSetup.freeReRunExpiryDate': {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),
                    $lt: new Date(today.setHours(23, 59, 59, 999))
                }
            }).populate('userId');

            for (const reRun of rerunEligibility) {
                // Custom logic for re-run alert
                await notificationService.notifyVerdictExpiry(reRun.runId, reRun.userId, 0);
            }

            logger.info(`[Cron] Daily Scan Complete. Processed ${runs.length} runs.`);
        } catch (error) {
            logger.error(`[Cron Error] Scheduler failed: ${error.message}`);
        }
    }
}

module.exports = new CronService();
