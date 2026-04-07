// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Signal Archive Cron
// File: src/crons/signalArchive.cron.js
//
// What it does:
//   1. Runs every day at 1:00 AM IST
//   2. Finds signals in EEDP that have passed their 'expiresAt' date
//   3. Updates their status to 'EXPIRED' and sets isActive to false
//   4. This maintains an audit trail without slowing down new runs
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../models/index.model.js');

async function archiveStaleSignals() {
    console.log('\n[SignalCron] ⏳ Checking for stale signals in Evidence Pool...');
    const now = new Date();
    
    try {
        // Find all ACTIVE signals that have expired
        const result = await db.ExternalEvidenceDataPool.updateMany(
            { 
                expiresAt: { $lt: now },
                status: 'ACTIVE' 
            },
            { 
                $set: { 
                    status: 'EXPIRED', 
                    isActive: false,
                    updatedAt: new Date()
                } 
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[SignalCron] ✅ Success: Archived ${result.modifiedCount} stale signals.`);
        } else {
            console.log('[SignalCron] ✅ No stale signals found today.');
        }

    } catch (error) {
        console.error('[SignalCron] ❌ Error during archiving:', error.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULE — Every day at 1:00 AM IST (1 hour after validity cron)
// ─────────────────────────────────────────────────────────────────
cron.schedule('0 1 * * *', archiveStaleSignals, {
    timezone: 'Asia/Kolkata'
});

// For testing purposes, you can uncomment this to run on server start
// archiveStaleSignals();

module.exports = { archiveStaleSignals };
