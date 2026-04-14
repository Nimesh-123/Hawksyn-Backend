// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Validity Decline Cron
// File: src/crons/validityDecline.cron.js
//
// What it does:
//   1. Runs every day at 12:00 AM IST
//   2. Recalculates 'daysLeft' for each user in UserClocks table
//   3. This ensures correct data is shown in Admin dashboard and backend reports
//      without the user opening the app.
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../models/index.model.js');

async function runValidityDecline() {
    console.log('\n[ValidityCron] ⏳ Starting daily validity update...');
    const now = new Date();
    
    try {
        const clocks = await db.UserClocks.find({
            $or: [
                { caseValidUntil: { $gt: now } },
                { clockValidUntil: { $gt: now } }
            ]
        });

        console.log(`[ValidityCron] Processing ${clocks.length} active user clocks`);

        let updatedCount = 0;

        for (const clock of clocks) {
            // Determine the active expiry date
            const expiry = (clock.caseValidUntil && new Date(clock.caseValidUntil) > now)
                ? new Date(clock.caseValidUntil)
                : (clock.clockValidUntil && new Date(clock.clockValidUntil) > now)
                    ? new Date(clock.clockValidUntil)
                    : null;

            if (expiry) {
                const ms = expiry - now;
                const newDaysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
                
                // Update DB only if value changed
                if (clock.daysLeft !== newDaysLeft) {
                    await db.UserClocks.updateOne(
                        { _id: clock._id },
                        { $set: { daysLeft: newDaysLeft, updatedAt: new Date() } }
                    );
                    updatedCount++;

                    // --- NEW: Verdict Expiry Notification (7 & 2 days) ---
                    if (newDaysLeft === 7 || newDaysLeft === 2) {
                        try {
                            const notificationService = require('../services/notificationService');
                            const user = await db.User.findOne({ _id: clock.userId });
                            if (user) {
                                // Find latest completed run for this user to get a runId context
                                const run = await db.Runs.findOne({ userId: user._id, status: 'REPORT_COMPLETE' }).sort({ completedAt: -1 });
                                await notificationService.notifyVerdictExpiry(run?.runId || 'N/A', user, newDaysLeft);
                            }
                        } catch (notifErr) {
                            console.error(`[ValidityCron] Notification failed for user ${clock.userId}:`, notifErr.message);
                        }
                    }
                }
            } else {
                // If everything expired, set daysLeft to 0 and frozen
                if (clock.daysLeft !== 0) {
                    await db.UserClocks.updateOne(
                        { _id: clock._id },
                        { $set: { daysLeft: 0, validityState: 'FROZEN', updatedAt: new Date() } }
                    );
                    updatedCount++;
                }
            }
        }

        console.log(`[ValidityCron] ✅ Update complete. ${updatedCount} clocks adjusted.\n`);

    } catch (error) {
        console.error('[ValidityCron] ❌ Fatal error:', error.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULE — Every day at 12:00 AM IST
// ─────────────────────────────────────────────────────────────────
cron.schedule('0 0 * * *', runValidityDecline, {
    timezone: 'Asia/Kolkata'
});

// Run once on startup to ensure consistency (Optional, but good for testing)
// runValidityDecline(); 

module.exports = { runValidityDecline };
