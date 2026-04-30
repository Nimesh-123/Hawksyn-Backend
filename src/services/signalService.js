const { db } = require('../models/index.model.js');
const { 
    buildSignalPrompt, 
    callOpenAI, 
    validateSignals 
} = require('../../utils/signalHelpers.js');
const logger = require('../../utils/logger');

/**
 * SignalService
 * Handles the logic for researching and refreshing market signals (B33, B35)
 */
class SignalService {
    /**
     * Refresh signals that are older than the threshold
     * @param {number} daysThreshold - Signals older than this many days will be refreshed
     */
    async refreshStaleSignals(daysThreshold = 30) {
        logger.info(`[SignalService] Starting background refresh for signals older than ${daysThreshold} days...`);
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() - daysThreshold);

        // 1. Find unique Role/Industry/Location combinations from the Evidence Pool
        // We only refresh what users have actually audited before
        const staleContexts = await db.ExternalEvidenceDataPool.aggregate([
            { $match: { fetchedAt: { $lt: expiryDate } } },
            { $group: {
                _id: {
                    role: "$role",
                    industry: "$industry",
                    location: "$geoValue"
                }
            }}
        ]);

        logger.info(`[SignalService] Found ${staleContexts.length} unique professional contexts requiring fresh research.`);

        let updatedCount = 0;

        for (const context of staleContexts) {
            const { role, industry, location } = context._id;
            if (!role || !industry) continue;

            try {
                logger.info(`[SignalService] Refreshing news for: ${role} in ${industry} (${location})`);

                // 2. Load Taxonomy (What do we need to research for this role?)
                const taxonomy = await db.ExternalSignalTaxonomy.find({ isActive: true });

                const promptContext = {
                    role,
                    industry,
                    location: location || 'Global',
                    skills: 'Latest high-demand skills', // Broad research
                    intentName: 'Market Risk Monitor',
                    caseName: 'Periodic Signal Refresh'
                };

                const prompt = buildSignalPrompt({ ...promptContext, taxonomy });
                const { data: signals } = await callOpenAI(prompt);

                if (signals && signals.signals) {
                    const eedpEntries = [];

                    for (const t of taxonomy) {
                        const rawSig = signals.signals[t.signalId];
                        if (!rawSig || !rawSig.value) continue;

                        const recencyDays = t.recencyDaysMax || 180;
                        const expiresAt = new Date(Date.now() + recencyDays * 24 * 60 * 60 * 1000);

                        eedpEntries.push({
                            eedpId: `REFRESH_${Date.now()}_${t.signalId}_${Math.floor(Math.random()*1000)}`,
                            signalId: t.signalId,
                            runId: 'SYSTEM_REFRESH',
                            caseId: 'SYSTEM',
                            sourceId: rawSig.sourceName || 'AI_MARKET_MONITOR',
                            sourceUrl: rawSig.sourceUrl || 'https://hawksyn.com/evidence',
                            citationText: rawSig.citation || rawSig.rationale,
                            signalValue: String(rawSig.raw_value || rawSig.value),
                            confidenceScore: rawSig.confidence === 'HIGH' ? 90 : 75,
                            aeuId: `AEU_REFRESH_${Date.now()}`,
                            geoScope: t.geoScope || 'GLOBAL',
                            geoValue: location,
                            role,
                            industry,
                            freshnessExpiresAt: expiresAt,
                            isValidated: true,
                            fetchedAt: new Date()
                        });
                    }

                    if (eedpEntries.length > 0) {
                        await db.ExternalEvidenceDataPool.insertMany(eedpEntries);
                        updatedCount += eedpEntries.length;
                    }
                }
            } catch (err) {
                logger.error(`[SignalService] Failed to refresh ${role}/${industry}: ${err.message}`);
            }
        }

        logger.info(`[SignalService] Background refresh complete. ${updatedCount} signals updated.`);
        return updatedCount;
    }
}

module.exports = new SignalService();
