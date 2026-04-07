// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — SLA Breach Detection Cron
// File: src/crons/slaBreach.cron.js
//
// What it does:
//   1. Runs every hour
//   2. Finds runs in 'EXPERT_ASSIGNED' status that have exceeded the 48-hour deadline
//   3. Updates 'isSlaBreached' to true and creates an audit log for Admin alert
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../models/index.model.js');

async function checkSlaBreaches() {
    console.log('\n[SLACron] ⏳ Checking for expert review SLA breaches...');
    
    // SLA Threshold: 48 Hours
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
                // 1. Mark as Breached
                await db.Runs.updateOne(
                    { _id: run._id },
                    { $set: { isSlaBreached: true } }
                );

                // 2. Log for Admin Dashboard Alert (Task 20)
                await db.auditLog.create({
                    action: 'SLA_BREACH_DETECTED',
                    entityId: run.runId,
                    entityType: 'RUN',
                    details: `Expert review for Run ${run.runId} exceeded ${SLA_HOURS}h SLA. Assigned At: ${run.expertAssignedAt}`,
                    performedBy: 'SYSTEM_CRON',
                    severity: 'HIGH'
                });
            }
            
            console.log(`[SLACron] ✅ Marked ${breachedRuns.length} runs as SLA_BREACHED.`);
        } else {
            console.log('[SLACron] ✅ No new SLA breaches detected.');
        }

    } catch (error) {
        console.error('[SLACron] ❌ Fatal error during SLA check:', error.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULE — Every hour (Runs at minute 0)
// ─────────────────────────────────────────────────────────────────
cron.schedule('0 * * * *', checkSlaBreaches, {
    timezone: 'Asia/Kolkata'
});

// Run once on startup to ensure consistency
// checkSlaBreaches();

module.exports = { checkSlaBreaches };
