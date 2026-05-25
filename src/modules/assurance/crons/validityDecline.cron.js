// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Validity Decline Cron
// File: src/modules/assurance/crons/validityDecline.cron.js
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../../../models/index.model.js');

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
            const expiry = (clock.caseValidUntil && new Date(clock.caseValidUntil) > now)
                ? new Date(clock.caseValidUntil)
                : (clock.clockValidUntil && new Date(clock.clockValidUntil) > now)
                    ? new Date(clock.clockValidUntil)
                    : null;

            if (expiry) {
                const ms = expiry - now;
                const newDaysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
                
                if (clock.daysLeft !== newDaysLeft) {
                    await db.UserClocks.updateOne(
                        { _id: clock._id },
                        { $set: { daysLeft: newDaysLeft, updatedAt: new Date() } }
                    );
                    updatedCount++;

                    if (newDaysLeft === 7 || newDaysLeft === 2) {
                        try {
                            const notificationService = require('../../../services/notificationService');
                            const user = await db.User.findOne({ _id: clock.userId });
                            if (user) {
                                const run = await db.Runs.findOne({ userId: user._id, status: 'REPORT_COMPLETE' }).sort({ completedAt: -1 });
                                await notificationService.notifyVerdictExpiry(run?.runId || 'N/A', user, newDaysLeft);
                            }
                        } catch (notifErr) {
                            console.error(`[ValidityCron] Notification failed for user ${clock.userId}:`, notifErr.message);
                        }
                    }
                }
            } else {
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

cron.schedule('0 0 * * *', runValidityDecline, {
    timezone: 'Asia/Kolkata'
});

module.exports = { runValidityDecline };
