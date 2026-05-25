// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Signal Archive Cron
// File: src/modules/signals/crons/signalArchive.cron.js
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../../../models/index.model.js');

async function archiveStaleSignals() {
    console.log('\n[SignalCron] ⏳ Checking for stale signals in Evidence Pool...');
    const now = new Date();
    
    try {
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

cron.schedule('0 1 * * *', archiveStaleSignals, {
    timezone: 'Asia/Kolkata'
});

module.exports = { archiveStaleSignals };
