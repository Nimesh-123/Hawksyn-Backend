// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — SLA Breach Detection Cron
// File: src/modules/assurance/crons/slaBreach.cron.js
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../../../models/index.model.js');

async function checkSlaBreaches() {
    console.log('\n[SLACron] ⏳ Checking for expert review SLA breaches...');
    
    const SLA_HOURS = 48;
    const breachThreshold = new Date(Date.now() - (SLA_HOURS * 60 * 60 * 1000));
    
    try {
        const breachedRuns = await db.Runs.find({
            status: 'EXPERT_ASSIGNED',
            expertAssignedAt: { $lt: breachThreshold },
            expertReviewedAt: null,
            isSlaBreached: false
        });

        if (breachedRuns.length > 0) {
            console.log(`[SLACron] 🚩 Found ${breachedRuns.length} runs in breach of SLA.`);
            
            for (const run of breachedRuns) {
                await db.Runs.updateOne(
                    { _id: run._id },
                    { $set: { isSlaBreached: true } }
                );

                await db.auditLog.create({
                    action: 'SLA_BREACH_DETECTED',
                    entityId: run.runId,
                    entityType: 'RUN',
                    details: `Expert review for Run ${run.runId} exceeded ${SLA_HOURS}h SLA. Assigned At: ${run.expertAssignedAt}`,
                    performedBy: 'SYSTEM_CRON',
                    severity: 'HIGH'
                });

                try {
                    const notificationService = require('../../../services/notificationService');
                    const user = await db.User.findById(run.userId);
                    if (user) {
                        await notificationService.notifySLABreach(run.runId, user);
                    }
                } catch (notifErr) {
                    console.error(`[SLACron] Failed to notify user for ${run.runId}:`, notifErr.message);
                }
            }
            
            console.log(`[SLACron] ✅ Marked ${breachedRuns.length} runs as SLA_BREACHED.`);
        } else {
            console.log('[SLACron] ✅ No new SLA breaches detected.');
        }

    } catch (error) {
        console.error('[SLACron] ❌ Fatal error during SLA check:', error.message);
    }
}

cron.schedule('0 * * * *', checkSlaBreaches, {
    timezone: 'Asia/Kolkata'
});

module.exports = { checkSlaBreaches };
