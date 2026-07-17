// src/modules/commandCenter/clockEngine.js
const { calculateClock1 } = require('./clock1_compounding');
const { calculateClock2 } = require('./clock2_operating_level');
const { calculateClock3 } = require('./clock3_profile_trust');
const { calculateClock4 } = require('./clock4_eval_readiness');
const FourClocks = require('./FourClocks.model');
const ClockHistory = require('./ClockHistory.model');

/**
 * Main engine to generate the 4 clocks from PSDE results
 */
async function generateFourClocks(userId, cvId, psdeArray, psdeProfile, psdeResults) {
    try {
        // 1. Calculate each clock
        const c1 = calculateClock1(psdeArray);
        const c2 = calculateClock2(psdeArray, psdeProfile);
        const c3 = calculateClock3(psdeArray);
        const c4 = calculateClock4(psdeArray, psdeResults);

        // 2. Fetch previous history to calculate trend
        const lastScan = await ClockHistory.findOne({ userId }).sort({ scannedAt: -1 }).lean();

        let trend1 = null, trend2 = null, trend3 = null, trend4 = null;
        if (lastScan) {
            trend1 = lastScan.clock1_score != null ? c1.score - lastScan.clock1_score : null;
            trend2 = lastScan.clock2_level != null ? c2.level - lastScan.clock2_level : null;
            trend3 = lastScan.clock3_score != null ? c3.score - lastScan.clock3_score : null;
            trend4 = lastScan.clock4_score != null ? c4.score - lastScan.clock4_score : null;
        }

        // 3. Save new history entry
        const history = new ClockHistory({
            userId,
            cvId,
            clock1_score: c1.score,
            clock2_level: c2.level,
            clock3_score: c3.score,
            clock4_score: c4.score,
            clock1_trend: trend1,
            clock2_trend: trend2,
            clock3_trend: trend3,
            clock4_trend: trend4
        });
        await history.save();

        // 4. Upsert the current FourClocks state
        const updatedClocks = await FourClocks.findOneAndUpdate(
            { userId },
            {
                cvId,
                lastCalculatedAt: new Date(),
                clock1: {
                    score: c1.score,
                    condition_id: c1.condition_id,
                    trend: trend1,
                    contributors: c1.contributors
                },
                clock2: {
                    level: c2.level,
                    condition_id: c2.condition_id,
                    trend: trend2,
                    contributors: c2.contributors,
                    gap_state: c2.gap_state
                },
                clock3: {
                    score: c3.score,
                    condition_id: c3.condition_id,
                    trend: trend3,
                    contributors: c3.contributors
                },
                clock4: {
                    score: c4.score,
                    condition_id: c4.condition_id,
                    trend: trend4,
                    contributors: c4.contributors,
                    D1: c4.D1,
                    D2: c4.D2,
                    D3: c4.D3,
                    D4: c4.D4
                }
            },
            { new: true, upsert: true }
        );

        return updatedClocks;
    } catch (error) {
        console.error("Error generating Four Clocks:", error);
        throw error;
    }
}

module.exports = { generateFourClocks };
