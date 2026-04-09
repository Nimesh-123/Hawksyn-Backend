// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Trend Engine Cron
// File: crons/trendEngine.cron.js
//
// What it does:
//   1. Fetches unique role+industry pairs from RAS table
//   2. Generates market scores from Gemini for each pair
//   3. Stores in MarketPulse table
//   4. Expires old pulses
//   5. Notifies affected users (log only — V1Light)
//
// Schedule:
//   Testing  → every 2 minutes (change before production)
//   Production → every Sunday 2AM
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../models/index.model.js');
const { generateJSON } = require('../services/aiProvider.js');

// ─────────────────────────────────────────────────────────────────
// HELPER 1 — getUniqueRoleIndustryPairs
// Loads PROFILE_CONFIRMED artifacts from RAS table
// ─────────────────────────────────────────────────────────────────
async function getUniqueRoleIndustryPairs() {
    // Note: UserProfile table is not used in Hawksyn, all data is in RAS.
    const profileRasList = await db.Ras.find({
        artifactType: 'PROFILE_CONFIRMED',
        status: 'FINAL'
    }).lean();

    console.log(`[TrendEngine] ${profileRasList.length} profile RAS records found`);

    const pairs = [];

    for (const ras of profileRasList) {
        const profile = ras.artifactJson?.confirmedProfile
            || ras.artifactJson?.profile
            || ras.artifactJson
            || {};

        // CV parsed data structure flexibility (identity/inferred vs flat roots)
        const role = profile?.current_role
            || profile?.identity?.currentRoleTitle
            || null;

        const industry = profile?.domain
            || profile?.industry
            || profile?.inferred?.domainIndicator
            || null;

        if (!role || !industry) continue;

        // Avoid duplicates (case-insensitive)
        const exists = pairs.find(p =>
            p.role.toLowerCase() === role.toLowerCase() &&
            p.industry.toLowerCase() === industry.toLowerCase()
        );

        if (!exists) {
            pairs.push({ role: role.trim(), industry: industry.trim() });
        }
    }

    console.log(`[TrendEngine] ${pairs.length} unique role+industry pairs found`);
    return pairs;
}

/**
 * HELPER 2 — generatePulse
 * Generates scores from AI Provider for a role+industry pair
 */
async function generatePulse(role, industry) {
    const prompt = `You are a career market analyst. Generate accurate current market trend scores for career risk assessment.

Role: ${role}
Industry: ${industry}

Return ONLY valid JSON (no markdown, no explanation, no extra text):
{
  "aiExposureScore": <number 0-100, how exposed this role is to AI displacement — higher means more risk>,
  "careerMomentumScore": <number 0-100, career growth momentum for this role currently>,
  "skillRelevanceScore": <number 0-100, how relevant current skills are in market>,
  "opportunityWindowScore": <number 0-100, opportunity availability for this role>,
  "careerMomentumMonths": <number 6-36, months of positive momentum runway>,
  "opportunityWindowYears": <number 1-5, years of opportunity window>,
  "insightText": "<one specific factual market insight for this role, e.g. X% of professionals with this profile are adding Y skill in last Z months>"
}

Rules:
- All score values must be numbers between 0-100
- careerMomentumMonths must be a number between 6-36
- opportunityWindowYears must be a number between 1-5
- insightText must be one sentence only
- Base your assessment on current AI adoption trends and job market conditions`;

    const { data: parsed, duration, provider } = await generateJSON(prompt);
    console.log(`[TrendEngine] AI Pulse generated in ${duration} via ${provider}`);

    // Basic validation
    const required = [
        'aiExposureScore', 'careerMomentumScore',
        'skillRelevanceScore', 'opportunityWindowScore',
        'careerMomentumMonths', 'opportunityWindowYears', 'insightText'
    ];
    for (const key of required) {
        if (parsed[key] === undefined || parsed[key] === null) {
            throw new Error(`Gemini response missing field: ${key}`);
        }
    }

    return parsed;
}

// ─────────────────────────────────────────────────────────────────
// MAIN — runTrendEngine
// Exported — used for both cron and manual trigger
// ─────────────────────────────────────────────────────────────────
async function runTrendEngine() {
    console.log('\n[TrendEngine] ⚙️  Starting run...');
    const startTime = Date.now();

    try {
        // ── Step 1: Expire old pulses ──────────────────────
        const expired = await db.MarketPulse.updateMany(
            { expiresAt: { $lt: new Date() }, isActive: true },
            { $set: { isActive: false } }
        );
        console.log(`[TrendEngine] Expired ${expired.modifiedCount} old pulses`);

        // ── Step 2: Fetch unique pairs from users ────────────
        const pairs = await getUniqueRoleIndustryPairs();

        if (pairs.length === 0) {
            console.log('[TrendEngine] No profiles with role/industry found in RAS. Skipping.');
            return;
        }

        // ── Step 3: Gemini call for each pair ────────────────
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let successCount = 0;
        let failCount = 0;

        for (const pair of pairs) {
            try {
                console.log(`[TrendEngine] Generating for: ${pair.role} / ${pair.industry}`);

                const trends = await generatePulse(pair.role, pair.industry);

                const roleSlug = pair.role.replace(/\s+/g, '_').toUpperCase();
                const industrySlug = pair.industry.replace(/\s+/g, '_').toUpperCase();
                const pulseId = `MP_${today}_${roleSlug}_${industrySlug}`;
                const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                // Upsert — update if today's pulse already exists
                await db.MarketPulse.findOneAndUpdate(
                    { pulseId },
                    {
                        $set: {
                            pulseId,
                            role: pair.role,
                            industry: pair.industry,
                            aiExposureScore: trends.aiExposureScore,
                            careerMomentumScore: trends.careerMomentumScore,
                            skillRelevanceScore: trends.skillRelevanceScore,
                            opportunityWindowScore: trends.opportunityWindowScore,
                            careerMomentumMonths: trends.careerMomentumMonths,
                            opportunityWindowYears: trends.opportunityWindowYears,
                            insightText: trends.insightText,
                            isActive: true,
                            expiresAt,
                            generatedBy: 'CRON_WEEKLY',
                            updatedAt: new Date()
                        },
                        $setOnInsert: { createdAt: new Date() }
                    },
                    { upsert: true, new: true }
                );

                console.log(`[TrendEngine] ✅ Saved pulse for ${pair.role} / ${pair.industry}`);
                successCount++;

                // ── Step 4: Find affected users → notify ──
                // Not UserProfile — get runId from RAS PROFILE_CONFIRMED
                // FIX: Escape special characters (like '/') and expand search paths
                const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const roleRegex = new RegExp(escapeRegExp(pair.role), 'i');
                const industryRegex = new RegExp(escapeRegExp(pair.industry), 'i');

                const affectedRas = await db.Ras.find({
                    artifactType: 'PROFILE_CONFIRMED',
                    status: 'FINAL',
                    $and: [
                        {
                            $or: [
                                { 'artifactJson.confirmedProfile.identity.currentRoleTitle': roleRegex },
                                { 'artifactJson.profile.identity.currentRoleTitle': roleRegex },
                                { 'artifactJson.identity.currentRoleTitle': roleRegex },
                                { 'artifactJson.confirmedProfile.current_role': roleRegex },
                                { 'artifactJson.profile.current_role': roleRegex },
                                { 'artifactJson.current_role': roleRegex },
                                { 'artifactJson.role': roleRegex }
                            ]
                        },
                        {
                            $or: [
                                { 'artifactJson.confirmedProfile.inferred.domainIndicator': industryRegex },
                                { 'artifactJson.profile.inferred.domainIndicator': industryRegex },
                                { 'artifactJson.inferred.domainIndicator': industryRegex },
                                { 'artifactJson.confirmedProfile.domain': industryRegex },
                                { 'artifactJson.profile.domain': industryRegex },
                                { 'artifactJson.domain': industryRegex },
                                { 'artifactJson.industry': industryRegex }
                            ]
                        }
                    ]
                }).select('runId').lean();

                const runIds = affectedRas.map(r => r.runId);
                const runs = await db.Runs.find({ runId: { $in: runIds } }).select('userId').lean();
                const userIds = [...new Set(runs.map(r => r.userId))];

                console.log(`[TrendEngine] ${userIds.length} users to notify for trend update in ${pair.role} / ${pair.industry}`);
                // TODO V1Light: Push notification code below
                // if (userIds.length > 0) { ... notification engine logic ... }

            } catch (pairErr) {
                console.error(`[TrendEngine] ❌ Failed for ${pair.role} / ${pair.industry}:`, pairErr.message);
                failCount++;
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[TrendEngine] Run complete in ${elapsed}s — ✅ ${successCount} success, ❌ ${failCount} failed\n`);

    } catch (error) {
        console.error('[TrendEngine] Fatal error:', error.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// CRON SCHEDULE
//
// Testing  → '*/2 * * * *'     (every 2 minutes)
// Production → '0 2 * * 0'    (Sunday 2AM IST)
// ─────────────────────────────────────────────────────────────────
cron.schedule('0 2 * * 0', runTrendEngine, {
    timezone: 'Asia/Kolkata'
});

console.log('[TrendEngine] Cron scheduled — running weekly (Sunday 2AM IST)');

// ─────────────────────────────────────────────────────────────────
// EXPORT — for manual trigger
// Used in commandCenter.routes.js
// ─────────────────────────────────────────────────────────────────
module.exports = { runTrendEngine };
