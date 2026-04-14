const sendEmail = require('../../utils/email');
const { db } = require('../models/index.model');
const logger = require('../../utils/logger');
const admin = require('../../utils/firebase'); // Firebase Admin SDK

/**
 * Hawksyn Notification Service
 * Handles all operational triggers (Email/System Alerts)
 */
class NotificationService {
    
    /**
     * Internal: Send Push Notification via FCM
     */
    async sendPushNotification(fcmToken, title, message, data = {}) {
        if (!fcmToken) return;
        try {
            const payload = {
                notification: { title, body: message },
                data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
                token: fcmToken
            };
            const response = await admin.messaging().send(payload);
            logger.info(`[FCM] Notification sent successfully: ${response}`);
        } catch (error) {
            logger.error(`[FCM] Notification failed: ${error.message}`);
        }
    }

    /**
     * Triggered when a client finishes Step 3 (All MCQ Batches)
     */
    async notifyIntakeComplete(runId) {
        try {
            const run = await db.Runs.findOne({ runId }).populate('userId');
            if (!run) return;

            const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || 'admin@hawksyn.com';
            const userName = run.userId?.name || 'A Client';

            // 1. Create In-App Notification record for Admin
            await db.Notifications.create({
                targetRole: 'admin',
                type: 'INTAKE_COMPLETE',
                title: 'New Intake Completed',
                message: `Client ${userName} has submitted objective inputs for Case ${run.caseId}. Ready for analysis.`,
                metadata: { runId, caseId: run.caseId }
            });

            // 2. Send Email
            await sendEmail({
                email: adminEmail,
                subject: `🔔 Intake Complete: ${run.caseId} | Run: ${runId}`,
                message: `Client ${userName} has completed the objective inputs for Run ID: ${runId}. You can now trigger the processing engine.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <h2 style="color: #2c3e50;">Task Alert: Intake Complete</h2>
                        <p>A new assessment intake has been finalized.</p>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Case ID:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${run.caseId}</td></tr>
                            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Client:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${userName} (${run.userId?.email || 'N/A'})</td></tr>
                            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Run ID:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><code>${runId}</code></td></tr>
                        </table>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.ADMIN_PORTAL_URL}/cases/review/${runId}" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Case in Pipeline</a>
                        </p>
                    </div>
                `
            });

            logger.info(`[Notification] Intake Complete alert sent for ${runId}`);
        } catch (error) {
            logger.error(`[Notification Error] Intake Complete: ${error.message}`);
        }
    }

    /**
     * Triggered when Integrity Engine or Report Generator finishes successfully
     */
    async notifyProcessingSuccess(runId) {
        try {
            const run = await db.Runs.findOne({ runId }).populate('userId');
            if (!run || !run.userId?.email) return;

            // 1. Create In-App Notification record for User
            await db.Notifications.create({
                userId: run.userId._id,
                targetRole: 'user',
                type: 'REPORT_READY',
                title: 'Risk Audit Ready',
                message: `Your investigation for ${run.caseId} is complete. View your final report now.`,
                metadata: { runId, caseId: run.caseId }
            });

            // 2. Send Email
            await sendEmail({
                email: run.userId.email,
                subject: `✅ Your Hawksyn Risk Audit is Ready: ${run.caseId}`,
                message: `Hello ${run.userId.name || 'User'}, your risk audit processing is complete. You can now view and download your report.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <h2 style="color: #27ae60;">Audit Report Ready</h2>
                        <p>The processing for your request <b>${run.caseId}</b> has been completed successfully.</p>
                        <p>Our intelligence engine has mapped your risk profile and the final report is securely generated.</p>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.CLIENT_PORTAL_URL}/reports/${runId}" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View My Report</a>
                        </p>
                        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">Ref ID: ${runId}</p>
                    </div>
                `
            });

            // 3. Send Push Notification
            if (run.userId.fcmToken) {
                await this.sendPushNotification(
                    run.userId.fcmToken, 
                    'Risk Audit Ready ✅', 
                    `Audit for ${run.caseId} is complete. View your report now.`,
                    { runId, type: 'REPORT_READY' }
                );
            }

            logger.info(`[Notification] Processing Success alert sent to user for ${runId}`);
        } catch (error) {
            logger.error(`[Notification Error] Processing Success: ${error.message}`);
        }
    }

    /**
     * Triggered when Processing fails due to engine errors
     */
    async notifyProcessingFailure(runId, step, reason) {
        try {
            const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || 'admin@hawksyn.com';

            // 1. Create In-App Notification record for Admin
            await db.Notifications.create({
                targetRole: 'admin',
                type: 'PROCESSING_FAILED',
                title: 'Analysis Engine Failure',
                message: `Run ${runId} failed during ${step}. Reason: ${reason}`,
                metadata: { runId, errorStep: step }
            });

            // 2. Send Email
            await sendEmail({
                email: adminEmail,
                subject: `🚨 CRITICAL: Processing Failed | Run: ${runId}`,
                message: `Integrity engine failed at step [${step}] for Run: ${runId}. Reason: ${reason}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #c0392b;">
                        <h2 style="color: #c0392b;">Action Required: Processing Failure</h2>
                        <p>The Hawksyn engine encountered a fatal error during analysis.</p>
                        <div style="background: #f9f9f9; padding: 15px; border-left: 5px solid #c0392b;">
                            <p><b>Run ID:</b> ${runId}</p>
                            <p><b>Failure Step:</b> <code>${step}</code></p>
                            <p><b>Error Details:</b> ${reason}</p>
                        </div>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.ADMIN_PORTAL_URL}/cases/debug/${runId}" style="background: #2c3e50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Debug in Admin Panel</a>
                        </p>
                    </div>
                `
            });

            logger.info(`[Notification] Critical Failure alert sent for ${runId}`);
        } catch (error) {
            logger.error(`[Notification Error] Failure Alert: ${error.message}`);
        }
    }
    /**
     * Triggered when a payment is successfully verified (Sprint 8)
     */
    async notifyPaymentSuccess(payment, user, invoice) {
        try {
            // 1. In-App Notification
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'PAYMENT_SUCCESS',
                title: 'Payment Successful',
                message: `Your payment of ${payment.currency} ${payment.amount} was successful. Order ID: ${payment.gatewayOrderId}`,
                metadata: { paymentId: payment.paymentId, invoiceId: invoice.invoiceId }
            });

            // 2. Email Confirmation
            await sendEmail({
                email: user.email,
                subject: `Payment Successful: Hawksyn Order ${payment.gatewayOrderId}`,
                message: `Thank you, your payment of ${payment.currency} ${payment.amount} has been received.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <h2 style="color: #E8600A;">Payment Received</h2>
                        <p>Hello <b>${user.fullName || user.name || 'Valued Client'}</b>,</p>
                        <p>Thank you for your trust in Hawksyn. We have successfully received your payment.</p>
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;"><b>Amount Paid:</b> ${payment.currency} ${payment.amount}</p>
                            <p style="margin: 5px 0 0 0;"><b>Invoice Number:</b> ${invoice.invoiceNumber}</p>
                        </div>
                        <p>Your assessment process has been prioritized and is now in the analysis stage.</p>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.CLIENT_PORTAL_URL}/transactions" style="background: #E8600A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View My Invoices</a>
                        </p>
                    </div>
                `
            });
            // 3. Send Push Notification
            if (user.fcmToken) {
                await this.sendPushNotification(
                    user.fcmToken,
                    'Payment Successful 💰',
                    `Payment received for Run ${payment.runId}. Starting analysis.`,
                    { runId: payment.runId, type: 'PAYMENT_SUCCESS' }
                );
            }

            logger.info(`[Notification] Payment success alert sent to user ${user._id}`);
        } catch (error) {
            logger.error(`[Notification Error] Payment Success: ${error.message}`);
        }
    }

    /**
     * Triggered when an expert is assigned to a run
     */
    async notifyExpertAssigned(runId, user, expert) {
        try {
            // 1. Notify EXPERT
            if (expert && expert.email) {
                await db.Notifications.create({
                    userId: expert.userId || expert._id,
                    targetRole: 'expert',
                    type: 'NEW_ASSIGNMENT',
                    title: 'New Case Assigned',
                    message: `You have been assigned as the risk auditor for Run ${runId}. Click to review.`,
                    metadata: { runId }
                });

                await sendEmail({
                    email: expert.email,
                    subject: `📋 New Case Assignment: Run ${runId}`,
                    message: `You have a new case waiting for audit review. Run ID: ${runId}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                            <h2 style="color: #2c3e50;">Expert Assignment Alert</h2>
                            <p>Hello Auditor,</p>
                            <p>A new assessment report is ready for your expert review and verdict certification.</p>
                            <p><b>Run ID:</b> <code>${runId}</code></p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.EXPERT_PORTAL_URL}/review/${runId}" style="background: #34495e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Auditor Dashboard</a>
                            </p>
                        </div>
                    `
                });

                // 3. Send Push Notification to USER
                if (user.fcmToken) {
                    await this.sendPushNotification(
                        user.fcmToken,
                        'Expert Assigned 👨‍🎓',
                        'A specialized expert is now reviewing your case.',
                        { runId, type: 'EXPERT_ASSIGNED' }
                    );
                }
            }

            // 2. Notify USER (#2)
            if (user && user.email) {
                await db.Notifications.create({
                    userId: user._id,
                    targetRole: 'user',
                    type: 'EXPERT_ASSIGNED',
                    title: 'Professional Review Started',
                    message: `An expert has been assigned to your case. Your report will be certified shortly.`,
                    metadata: { runId }
                });

                await sendEmail({
                    email: user.email,
                    subject: `👨‍🎓 Expert Assigned to your Hawksyn Audit`,
                    message: `A professional auditor has started reviewing your risk profile.`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-top: 4px solid #E8600A;">
                            <h2 style="color: #E8600A;">Professional Review Active</h2>
                            <p>Hello <b>${user.fullName || user.name || 'Valued Client'}</b>,</p>
                            <p>Great news! Your risk audit for <b>Run ${runId}</b> has been assigned to one of our professional auditors.</p>
                            <p>They are currently validating your AI-generated verdict and will provide a certified stamp within the next 72 hours.</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/reports/${runId}" style="background: #E8600A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Audit Status</a>
                            </p>
                        </div>
                    `
                });

                // 3. Send Push Notification to EXPERT
                if (expert.fcmToken) {
                    await this.sendPushNotification(
                        expert.fcmToken,
                        'New Case Assigned 📋',
                        `You have been assigned Run ${runId}.`,
                        { runId, type: 'NEW_ASSIGNMENT' }
                    );
                }
            }

            logger.info(`[Notification] Expert assignment alerts sent for Run ${runId}`);
        } catch (error) {
            logger.error(`[Notification Error] Expert Notification: ${error.message}`);
        }
    }

    /**
     * Triggered when an expert submits their final review/verdict certification (#6)
     */
    async notifyAuditorReviewComplete(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'REVIEW_COMPLETE',
                title: 'Expert Review Finalized',
                message: `Your risk auditor has completed their review for Run ${runId}. Your report is now fully certified.`,
                metadata: { runId }
            });

            await sendEmail({
                email: user.email,
                subject: `✅ Auditor Review Complete: Run ${runId}`,
                message: `Your Hawksyn risk audit has been certified by an expert.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <h2 style="color: #27ae60;">Expert Validation Complete</h2>
                        <p>Hello,</p>
                        <p>Your risk auditor has submitted their final validation stamp. Your report now includes professional certification.</p>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.CLIENT_PORTAL_URL}/reports/${runId}" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Certified Report</a>
                        </p>
                    </div>
                `
            });
            logger.info(`[Notification] Review Complete alert sent for ${runId}`);
        } catch (error) {
            logger.error(`[Notification Error] Review Complete: ${error.message}`);
        }
    }

    /**
     * Triggered for Verdict Expiry Warnings (7 days & 2 days) (#8, #9)
     */
    async notifyVerdictExpiry(runId, user, daysRemaining) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'VERDICT_EXPIRY',
                title: 'Verdict Expiry Warning',
                message: `Your verdict for case ${runId} will expire in ${daysRemaining} days. A re-run is recommended.`,
                metadata: { runId, daysRemaining }
            });

            await sendEmail({
                email: user.email,
                subject: `⚠️ Verdict Expiry: ${daysRemaining} Days Remaining`,
                message: `Your risk audit verdict is about to expire.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f39c12;">
                        <h2 style="color: #e67e22;">Action Required: Expiry Warning</h2>
                        <p>Your Hawksyn verdict for <b>Run ${runId}</b> expires in ${daysRemaining} days.</p>
                        <p>Market conditions and risk factors shift over time. To maintain an accurate risk profile, we recommend a re-run.</p>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.CLIENT_PORTAL_URL}/reports/${runId}" style="background: #e67e22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Verdict Validity</a>
                        </p>
                    </div>
                `
            });
            // 3. Send Push Notification
            if (user.fcmToken) {
                await this.sendPushNotification(
                    user.fcmToken,
                    'Verdict Expiry Warning ⚠️',
                    `Your verdict for case ${runId} will expire in ${daysRemaining} days.`,
                    { runId, type: 'VERDICT_EXPIRY' }
                );
            }
        } catch (error) { logger.error(`[Notif Error] Expiry: ${error.message}`); }
    }

    /**
     * Triggered when Auditor fails to respond within SLA (#10)
     */
    async notifySLABreach(runId, user) {
        try {
            await sendEmail({
                email: user.email,
                subject: `📋 Status Update: Your Case Review`,
                message: `We are monitoring your expert review progress.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <p>Your report is still under expert review. Our team is monitoring this and you will hear back within 24 hours.</p>
                    </div>
                `
            });
        } catch (error) { logger.error(`[Notif Error] SLA: ${error.message}`); }
    }

    /**
     * Triggered when a profile update conflicts with a locked audit snapshot (#13)
     */
    async notifyProfileConflict(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'PROFILE_CONFLICT',
                title: 'Data Conflict Detected',
                message: `Recent profile updates conflict with your ${runId} audit. Verdict accuracy may be affected.`,
                metadata: { runId }
            });
            logger.info(`[Notification] Profile conflict alert sent for user ${user._id}`);
        } catch (error) { logger.error(`[Notif Error] Conflict: ${error.message}`); }
    }

    /**
     * Triggered when an expert sends a message in the chat (#7)
     */
    async notifyExpertChatReply(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'EXPERT_REPLY',
                title: 'Expert Responded',
                message: `Your risk auditor has responded to your query for Run ${runId}. Click to chat.`,
                metadata: { runId }
            });

            await sendEmail({
                email: user.email,
                subject: `💬 New Message from your Hawksyn Auditor`,
                message: `You have received a reply from your risk auditor.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <p>Your auditor has responded to your query. You can continue the conversation in the app.</p>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.CLIENT_PORTAL_URL}/chat/${runId}" style="background: #34495e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reply in Chat</a>
                        </p>
                    </div>
                `
            });
            // 3. Send Push Notification
            if (user.fcmToken) {
                await this.sendPushNotification(
                    user.fcmToken,
                    'New Expert Message 💬',
                    `Expert has replied to your query for Run ${runId}.`,
                    { runId, type: 'EXPERT_REPLY' }
                );
            }
        } catch (error) { logger.error(`[Notif Error] Chat Reply: ${error.message}`); }
    }

    /**
     * Triggered when Step 4 detects serious contradictions (#3)
     */
    async notifyContradictionDetected(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'CONTRADICTION_ALERT',
                title: 'Conflicting Inputs Detected',
                message: `We found conflicting inputs in your audit for Run ${runId}. This will affect your confidence score.`,
                metadata: { runId }
            });
            logger.warn(`[Notification] Contradiction alert sent for run ${runId}`);
        } catch (error) { logger.error(`[Notif Error] Contradiction: ${error.message}`); }
    }

    /**
     * Triggered when Step 4 detects critical missing data (#4)
     */
    async notifyMissingDataWarning(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'MISSING_DATA_ALERT',
                title: 'Critical Missing Data',
                message: `Some critical inputs are missing in Run ${runId}. Your accuracy score has been penalised.`,
                metadata: { runId }
            });
            logger.warn(`[Notification] Missing data alert sent for run ${runId}`);
        } catch (error) { logger.error(`[Notif Error] Missing Data: ${error.message}`); }
    }

}

module.exports = new NotificationService();
