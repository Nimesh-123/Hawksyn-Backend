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

            // 0. Check if notification already exists to prevent duplicates
            const existing = await db.Notifications.findOne({ 
                'metadata.runId': runId, 
                type: 'INTAKE_COMPLETE' 
            });
            if (existing) return;

            // 1. Create In-App Notification record for User (Step 3)
            await db.Notifications.create({
                userId: run.userId._id,
                targetRole: 'user',
                type: 'INTAKE_COMPLETE',
                title: 'Assessment Inputs Captured',
                message: `Assessment Inputs Captured. Our intelligence engine is now mapping your risk profile.`,
                metadata: { runId }
            });

            // 3. Send Email
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
    async notifyProcessingSuccess(runId, isDisconnected = false) {
        try {
            const run = await db.Runs.findOne({ runId }).populate('userId');
            if (!run || !run.userId?.email) return;

            // 1. Create In-App Notification record for User (Step 5)
            await db.Notifications.create({
                userId: run.userId._id,
                targetRole: 'user',
                type: 'REPORT_READY',
                title: 'Report Ready',
                message: `Your Decision Assurance Report is ready. Open to see your verdict.`,
                metadata: { runId, caseId: run.caseId }
            });

            const prefs = run.userId.notificationPreferences || {};

            // ONLY send Push/Email if they are not currently looking at the app
            if (isDisconnected) {
                // 2. Send Email
                if (prefs.email !== false && prefs.reportReady !== false) {
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
                }

                // 3. Send Push Notification
                if (run.userId.fcmToken && prefs.push !== false && prefs.reportReady !== false) {
                    await this.sendPushNotification(
                        run.userId.fcmToken, 
                        'Report Ready', 
                        `Your Decision Assurance Report is ready. Open to see your verdict.`,
                        { runId, type: 'REPORT_READY' }
                    );
                }
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
     * Triggered when a payment is successfully verified
     */
    async notifyPaymentSuccess(payment, user, invoice) {
        try {
            // 1. In-App Notification (Step 5.5)
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'PAYMENT_SUCCESS',
                title: 'Payment Confirmation',
                message: `Payment confirmed. Your Report/Expert Pack is active. Invoice sent to your email.`,
                metadata: { paymentId: payment.paymentId, invoiceId: invoice.invoiceId, runId: payment.runId }
            });

            const prefs = user.notificationPreferences || {};

            // 2. Email Confirmation
            if (prefs.email !== false) {
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
            }

            // 3. Send Push Notification
            if (user.fcmToken && prefs.push !== false) {
                await this.sendPushNotification(
                    user.fcmToken,
                    'Payment Confirmation',
                    `Payment confirmed. Your Report/Expert Pack is active.`,
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
            if (expert && expert.email) {
                // Notify Expert
                await db.Notifications.create({
                    userId: expert.userId || expert._id,
                    targetRole: 'expert',
                    type: 'NEW_ASSIGNMENT',
                    title: 'New Case Assigned',
                    message: `You have been assigned as the risk auditor for Run ${runId}. Click to review.`,
                    metadata: { runId }
                });

                // Notify User (Step 6)
                await db.Notifications.create({
                    userId: user._id,
                    targetRole: 'user',
                    type: 'EXPERT_ASSIGNED',
                    title: 'Expert Assigned',
                    message: `Your case has been assigned to ${expert.name || 'an expert'}. Expected review within 72 hours.`,
                    metadata: { runId }
                });

                const prefs = user.notificationPreferences || {};

                // Push to User
                if (user.fcmToken && prefs.push !== false) {
                    await this.sendPushNotification(
                        user.fcmToken,
                        'Expert Assigned',
                        `Your case has been assigned to ${expert.name || 'an expert'}. Expected review within 72 hours.`,
                        { runId, type: 'EXPERT_ASSIGNED' }
                    );
                }

                // Email to User
                if (prefs.email !== false) {
                    await sendEmail({
                        email: user.email,
                        subject: `Expert Assigned to Your Case: ${runId.slice(-6)}`,
                        message: `Your case has been assigned to ${expert.name || 'an expert'}. Expected review within 72 hours.`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                                <h2 style="color: #2980b9;">Expert Assigned</h2>
                                <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                                <p>An expert auditor (<b>${expert.name || 'Risk Specialist'}</b>) has been assigned to review your case <b>${runId.slice(-6)}</b>.</p>
                                <p>The auditor will validate your risk profile and certification within 72 hours.</p>
                                <p style="margin-top: 20px;">
                                    <a href="${process.env.CLIENT_PORTAL_URL}/cases" style="background: #2980b9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Case Status</a>
                                </p>
                            </div>
                        `
                    });
                }
            }
            logger.info(`[Notification] Expert assignment alerts sent for Run ${runId}`);
        } catch (error) {
            logger.error(`[Notification Error] Expert Notification: ${error.message}`);
        }
    }

    /**
     * Triggered when an expert submits their final review/verdict certification
     */
    async notifyAuditorReviewComplete(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'REVIEW_COMPLETE',
                title: 'Auditor Review Complete',
                message: `Your auditor has completed their review. Your report now includes expert validation. Open to read.`,
                metadata: { runId }
            });

            const prefs = user.notificationPreferences || {};

            if (user.fcmToken && prefs.push !== false) {
                await this.sendPushNotification(user.fcmToken, 'Auditor Review Complete ✅', 'Your report now includes expert validation.', { runId });
            }

            // Email to User
            if (prefs.email !== false) {
                await sendEmail({
                    email: user.email,
                    subject: `Auditor Review Complete: ${runId.slice(-6)}`,
                    message: `Your auditor has completed their review. Your report now includes expert validation.`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                            <h2 style="color: #27ae60;">Auditor Review Complete</h2>
                            <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                            <p>Your auditor has finalized their review for case <b>${runId.slice(-6)}</b>.</p>
                            <p>The report has been updated with expert validation and a certified verdict.</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/reports/${runId}" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Certified Report</a>
                            </p>
                        </div>
                    `
                });
            }
        } catch (error) { logger.error(`[Notif Error] Review Complete: ${error.message}`); }
    }

    /**
     * Triggered for Verdict Expiry Warnings (7 days & 2 days)
     */
    async notifyVerdictExpiry(runId, user, daysRemaining) {
        try {
            const title = daysRemaining === 7 ? 'Verdict Expiry Warning, 7 Days' : 'Verdict Expiry Warning, 2 Days';
            const msg = daysRemaining === 7 
                ? `Your verdict on ${runId.slice(-6)} expires in 7 days. Market conditions may have shifted. A re-run gives you a fresh picture.`
                : `Your verdict expires in 2 days. After this, your audit result is no longer valid. Re-run to stay current.`;

            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'VERDICT_EXPIRY',
                title: title,
                message: msg,
                metadata: { runId, daysRemaining }
            });
            const prefs = user.notificationPreferences || {};

            if (user.fcmToken && prefs.push !== false) {
                await this.sendPushNotification(user.fcmToken, title, msg, { runId, daysRemaining });
            }

            // Email to User
            if (prefs.email !== false) {
                await sendEmail({
                    email: user.email,
                    subject: `⚠️ ${title}`,
                    message: msg,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                            <h2 style="color: #e67e22;">Verdict Expiry Warning</h2>
                            <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                            <p>${msg}</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/cases" style="background: #e67e22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review My Cases</a>
                            </p>
                        </div>
                    `
                });
            }
        } catch (error) { logger.error(`[Notif Error] Expiry: ${error.message}`); }
    }

    /**
     * Triggered when Auditor fails to respond within SLA
     */
    async notifySLABreach(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'SLA_BREACH',
                title: 'SLA Breach Warning, 48 Hours',
                message: `Your report is still under expert review. Our team is monitoring this. You will hear back within 24 hours.`,
                metadata: { runId }
            });
        } catch (error) { logger.error(`[Notif Error] SLA: ${error.message}`); }
    }

    /**
     * Triggered when an expert sends a message in the chat
     */
    async notifyExpertChatReply(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'EXPERT_REPLY',
                title: 'Expert Replied in Chat',
                message: `Your auditor has responded. Open to continue the conversation.`,
                metadata: { runId }
            });
            const prefs = user.notificationPreferences || {};

            if (user.fcmToken && prefs.push !== false && prefs.expertReplied !== false) {
                await this.sendPushNotification(user.fcmToken, 'Expert Replied in Chat 💬', 'Your auditor has responded. Open to chat.', { runId });
            }

            // Email to User
            if (prefs.email !== false && prefs.expertReplied !== false) {
                await sendEmail({
                    email: user.email,
                    subject: `New Message from Auditor: ${runId.slice(-6)}`,
                    message: `Your auditor has responded to your message.`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                            <h2 style="color: #9b59b6;">New Message</h2>
                            <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                            <p>Your auditor has responded to your inquiry for case <b>${runId.slice(-6)}</b>.</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/chat/${runId}" style="background: #9b59b6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reply in Chat</a>
                            </p>
                        </div>
                    `
                });
            }
        } catch (error) { logger.error(`[Notif Error] Chat Reply: ${error.message}`); }
    }

    /**
     * Triggered when Step 4 detects serious contradictions
     */
    async notifyContradictionDetected(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'CONTRADICTION_ALERT',
                title: 'Contradiction Warning',
                message: `We found conflicting inputs in your audit. This has been flagged and will affect your confidence score.`,
                metadata: { runId }
            });
        } catch (error) { logger.error(`[Notif Error] Contradiction: ${error.message}`); }
    }

    /**
     * Triggered when Step 4 detects critical missing data
     */
    async notifyMissingDataWarning(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'MISSING_DATA_ALERT',
                title: 'Missing Data Warning',
                message: `Some inputs are incomplete. Your accuracy score has been penalised and your confidence band reflects this.`,
                metadata: { runId }
            });
        } catch (error) { logger.error(`[Notif Error] Missing Data: ${error.message}`); }
    }

    /**
     * Triggered when a profile update conflicts with a locked audit snapshot
     */
    async notifyProfileConflict(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'PROFILE_CONFLICT',
                title: 'Profile Conflict Detected',
                message: `You updated your profile. One or more changes conflict with inputs from your audit. Review recommended.`,
                metadata: { runId }
            });
        } catch (error) { logger.error(`[Notif Error] Conflict: ${error.message}`); }
    }

    async notifyParsingComplete(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'PARSING_COMPLETE',
                title: 'CV Analyzed Successfully',
                message: 'CV Analyzed Successfully. Professional risk markers identified. Continue with Step 2.',
                metadata: { runId }
            });
            const prefs = user.notificationPreferences || {};

            if (user.fcmToken && prefs.push !== false) {
                await this.sendPushNotification(user.fcmToken, 'CV Analyzed ✅', 'Professional risk markers identified. Continue with Step 2.', { runId });
            }

            // Email to User
            if (prefs.email !== false) {
                await sendEmail({
                    email: user.email,
                    subject: `CV Analysis Complete: ${runId.slice(-6)}`,
                    message: `Professional risk markers identified. Continue with Step 2.`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                            <h2 style="color: #27ae60;">CV Analysis Successful</h2>
                            <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                            <p>Our intelligence engine has successfully analyzed your CV for case <b>${runId.slice(-6)}</b>.</p>
                            <p>Professional risk markers have been identified. You can now proceed to the next step of the assessment.</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/intake/${runId}" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Continue to Step 2</a>
                            </p>
                        </div>
                    `
                });
            }
        } catch (error) { logger.error('Parsing Notif Error: ' + error.message); }
    }

    async notifyIntakeProgress(runId, user) {
        try {
            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'INTAKE_PROGRESS',
                title: 'Intake Progress',
                message: 'Intake Progress: Profile captured. Moving to deeper assessment.',
                metadata: { runId }
            });
        } catch (error) { logger.error('Intake Progress Notif Error: ' + error.message); }
    }

    /**
     * Triggered when Admin unlocks a Free Re-run window
     */
    async notifyReRunAvailable(runId) {
        try {
            const run = await db.Runs.findOne({ runId }).populate('userId');
            if (!run || !run.userId) return;

            const user = run.userId;
            const title = 'Re-run Available 🚀';
            const msg = `Good news! Your case ${run.caseId} has been unlocked for a free re-run. Update your data and run it now.`;

            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'RERUN_UNLOCKED',
                title,
                message: msg,
                metadata: { runId }
            });

            const prefs = user.notificationPreferences || {};

            if (user.fcmToken && prefs.push !== false && prefs.rerunReminder !== false) {
                await this.sendPushNotification(user.fcmToken, title, msg, { runId, type: 'RERUN_UNLOCKED' });
            }

            // Email to User
            if (prefs.email !== false && prefs.rerunReminder !== false) {
                await sendEmail({
                    email: user.email,
                    subject: `Free Re-run Available: ${run.caseId}`,
                    message: msg,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                            <h2 style="color: #3498db;">Re-run Unlocked 🚀</h2>
                            <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                            <p>Good news! Your case <b>${run.caseId}</b> has been unlocked for a free re-run.</p>
                            <p>You can now update your data and run the analysis again to get a fresh perspective.</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/cases" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Re-run Case Now</a>
                            </p>
                        </div>
                    `
                });
            }
        } catch (error) { logger.error(`[Notif Error] Re-run: ${error.message}`); }
    }

    /**
     * Triggered when a Clock score drops below critical threshold (30%)
     */
    async notifyClockCritical(userId, clockName, value) {
        try {
            const user = await db.User.findById(userId);
            if (!user) return;

            const title = 'Clock Critical ⚠️';
            const msg = `Your ${clockName} is at ${value}% — risk level is high. Run a new audit to recalibrate.`;

            await db.Notifications.create({
                userId: user._id,
                targetRole: 'user',
                type: 'CLOCK_CRITICAL',
                title,
                message: msg,
                metadata: { clockName, value }
            });

            const prefs = user.notificationPreferences || {};

            if (user.fcmToken && prefs.push !== false && prefs.clockCritical !== false) {
                await this.sendPushNotification(user.fcmToken, title, msg, { type: 'CLOCK_CRITICAL', clockName });
            }

            // Email to User
            if (prefs.email !== false && prefs.clockCritical !== false) {
                await sendEmail({
                    email: user.email,
                    subject: `⚠️ Critical Alert: ${clockName} Drop`,
                    message: msg,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #c0392b;">
                            <h2 style="color: #c0392b;">Clock Critical Warning</h2>
                            <p>Hello <b>${user.fullName || user.name || 'User'}</b>,</p>
                            <p>${msg}</p>
                            <p style="margin-top: 20px;">
                                <a href="${process.env.CLIENT_PORTAL_URL}/dashboard" style="background: #c0392b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Check Dashboard</a>
                            </p>
                        </div>
                    `
                });
            }
        } catch (error) { logger.error(`[Notif Error] Clock Critical: ${error.message}`); }
    }

}

module.exports = new NotificationService();
