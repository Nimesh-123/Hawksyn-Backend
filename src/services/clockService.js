const { db } = require('../models/index.model.js');
const { generateJSON } = require('./aiProvider.js');

/**
 * AI Score Generator
 */
async function generateClockScores({ role, industry, skills, achievements, tenure }) {
    const skillsText = Array.isArray(skills) ? skills.join(', ') : (skills || 'Not specified');
    const achievementsText = Array.isArray(achievements) ? achievements.join(', ') : (achievements || 'Not specified');
    const prompt = `You are a career risk analyst for Hawksyn Decision Assurance Platform.  Calculate 4 clock scores for this professional based on current market conditions.

User Profile:
- Role: ${role}
- Industry: ${industry}
- Skills: ${skillsText}
- Key Achievements: ${achievementsText}
- Current Tenure: ${tenure} years

Calculate these 4 scores:

1. AI Exposure Score (0-100):
   How much of this user's daily work can now be done by AI tools?
   Higher score = more risk.
   Check if AI agents can perform tasks listed in their achievements.

2. Career Momentum Score (0-100):
   How fast are jobs in this sector opening vs closing right now?
   Based on job postings growth minus layoff frequency.

3. Skill Relevance Score (0-100):
   What % of top-tier job listings require this user's skills as MANDATORY?
   Compare user skills against Must-Have requirements in current job postings.

4. Opportunity Window Score (0-100):
   How much runway does this role have before becoming stale?
   Based on current tenure vs market-standard tenure limit for this role.

Return ONLY valid JSON, no markdown, no explanation:
{
  "aiExposureScore": <number 0-100>,
  "aiExposureJustification": "<one brutal honest sentence about AI risk for this specific role>",

  "careerMomentumScore": <number 0-100>,
  "careerMomentumJustification": "<one sentence with specific hiring vs firing trend for this sector>",
  "careerMomentumMonths": <number 6-36>,

  "skillRelevanceScore": <number 0-100>,
  "skillRelevanceJustification": "<one sentence comparing user skills vs current job requirements>",

  "opportunityWindowScore": <number 0-100>,
  "opportunityWindowJustification": "<one sentence predicting value peak for this role>",
  "opportunityWindowYears": <number 1-5>,

  "trendTrigger": "<single most important market event affecting this profile right now>"
}

Rules:
- All scores must be numbers 0-100
- careerMomentumMonths must be 6-36
- opportunityWindowYears must be 1-5
- Each justification = exactly one sentence, brutally honest
- trendTrigger = one specific market event
- Base on real current AI adoption trends`;

    const { data, duration, provider, usage } = await generateJSON(prompt);
    console.log(`[ClockService] ✅ AI calculation complete in ${duration} via ${provider}`);
    
    const [llm, model] = (provider || 'AI-Model').split('-');

    return { 
        ...data, 
        calculationDuration: duration,
        llm: llm || 'AI',
        model: model || 'Model',
        tokenUsage: usage
    };
}

/**
 * Validity Logic (Priority: Case > Clock > Frozen)
 */
function computeValidityState(userClock) {
    const now = new Date();

    if (userClock?.caseValidUntil && new Date(userClock.caseValidUntil) > now) {
        const ms = new Date(userClock.caseValidUntil) - now;
        const daysLeft = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        return { state: 'ACTIVE_CASE', effectiveValidUntil: userClock.caseValidUntil, daysLeft };
    }

    if (userClock?.clockValidUntil && new Date(userClock.clockValidUntil) > now) {
        const ms = new Date(userClock.clockValidUntil) - now;
        const daysLeft = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        return { state: 'ACTIVE_CLOCK', effectiveValidUntil: userClock.clockValidUntil, daysLeft };
    }

    return { state: 'FROZEN', effectiveValidUntil: null, daysLeft: 0 };
}

/**
 * Fuzzy Match Market Pulse
 */
async function findActivePulse(role, industry) {
    if (!role || !industry) return null;
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let pulse = await db.MarketPulse.findOne({
        role: { $regex: new RegExp(`^${escapeRegex(role.trim())}$`, 'i') },
        industry: { $regex: new RegExp(`^${escapeRegex(industry.trim())}$`, 'i') },
        isActive: true
    }).sort({ createdAt: -1 });

    if (!pulse) {
        pulse = await db.MarketPulse.findOne({
            role: { $regex: new RegExp(escapeRegex(role.trim()), 'i') },
            industry: { $regex: new RegExp(escapeRegex(industry.trim()), 'i') },
            isActive: true
        }).sort({ createdAt: -1 });
    }

    if (!pulse) {
        pulse = await db.MarketPulse.findOne({
            industry: { $regex: new RegExp(escapeRegex(industry.trim()), 'i') },
            isActive: true
        }).sort({ createdAt: -1 });
    }

    return pulse;
}

/**
 * Score Calculation
 */
function calculateClockScores(profile, pulse) {
    const experienceYears = Number(profile?.experience_years || profile?.experienceYears || 0);
    const expBoost = Math.min(15, Math.floor(experienceYears / 2));
    const careerMomentum = Math.min(100, pulse.careerMomentumScore + expBoost);

    return {
        aiExposureScore: Math.round(pulse.aiExposureScore),
        careerMomentumScore: Math.round(careerMomentum),
        skillRelevanceScore: Math.round(pulse.skillRelevanceScore),
        opportunityWindowScore: Math.round(pulse.opportunityWindowScore),
        careerMomentumMonths: pulse.careerMomentumMonths,
        opportunityWindowYears: pulse.opportunityWindowYears,
        aiExposureJustification: pulse.aiExposureJustification || null,
        careerMomentumJustification: pulse.careerMomentumJustification || null,
        skillRelevanceJustification: pulse.skillRelevanceJustification || null,
        opportunityWindowJustification: pulse.opportunityWindowJustification || null,
        trendTrigger: pulse.trendTrigger || null
    };
}

/**
 * Significance Check
 */
function detectSignificantChange(userClock, newScores, threshold = 15) {
    if (!userClock?.aiExposureScore) return false;
    const deltas = [
        Math.abs(newScores.aiExposureScore - (userClock.aiExposureScore || 0)),
        Math.abs(newScores.careerMomentumScore - (userClock.careerMomentumScore || 0)),
        Math.abs(newScores.skillRelevanceScore - (userClock.skillRelevanceScore || 0)),
        Math.abs(newScores.opportunityWindowScore - (userClock.opportunityWindowScore || 0))
    ];
    return deltas.some(d => d >= threshold);
}

/**
 * Benchmarks Comparison
 */
/**
 * Benchmarks Comparison - Compares User Score vs Market Median
 */
function getPeerBenchmarks(score, marketMedian, type) {
    const isInverted = (type === 'AI_EXPOSURE');
    const median = Math.round(marketMedian);
    let top, bottom;

    // Calculate bands based on Market Median
    if (isInverted) {
        // For AI Exposure: Lower is better (Top 20% means low risk)
        top = Math.max(0, Math.round(median * 0.8));
        bottom = Math.min(100, Math.round(median * 1.2));
    } else {
        // For others: Higher is better (Top 20% means high momentum/skill)
        top = Math.min(100, Math.round(median * 1.2));
        bottom = Math.max(0, Math.round(median * 0.8));
    }

    // Determine user position relative to market bands
    let userState = 'Median';
    if (isInverted) {
        if (score <= top) userState = 'Top 20%';
        else if (score >= bottom) userState = 'Bottom 20%';
    } else {
        if (score >= top) userState = 'Top 20%';
        else if (score <= bottom) userState = 'Bottom 20%';
    }

    return { 
        top20: top, 
        median: median, 
        bottom20: bottom, 
        userState 
    };
}

/**
 * UI Response Object
 */
/**
 * UI Response Object - Compares User Score against Market Median
 */
function buildClocksResponse(userScores, userClock = {}, marketScores = null) {
    // 1. Extract User Scores
    const uAi  = userScores.aiExposureScore ?? 0;
    const uMom = userScores.careerMomentumScore ?? 0;
    const uSkl = userScores.skillRelevanceScore ?? 0;
    const uOpp = userScores.opportunityWindowScore ?? 0;

    // 2. Extract Market Medians (Fall back to user score if no market pulse exists)
    const mAi  = marketScores?.aiExposureScore ?? uAi;
    const mMom = marketScores?.careerMomentumScore ?? uMom;
    const mSkl = marketScores?.skillRelevanceScore ?? uSkl;
    const mOpp = marketScores?.opportunityWindowScore ?? uOpp;

    // 3. Generate Benchmarks for each clock
    const aiBench  = getPeerBenchmarks(uAi,  mAi,  'AI_EXPOSURE');
    const momBench = getPeerBenchmarks(uMom, mMom, 'CAREER_MOMENTUM');
    const sklBench = getPeerBenchmarks(uSkl, mSkl, 'SKILL_RELEVANCE');
    const oppBench = getPeerBenchmarks(uOpp, mOpp, 'OPPORTUNITY_WINDOW');

    return {
        aiExposure: {
            score: uAi,
            display: `${uAi}%`,
            risk: uAi > 70 ? 'HIGH' : uAi > 40 ? 'MEDIUM' : 'LOW',
            color: uAi > 70 ? 'RED' : uAi > 40 ? 'AMBER' : 'GREEN',
            showRiskBadge: uAi > 70,
            justification: userClock.aiExposureJustification || userScores.aiExposureJustification || null,
            benchmarks: aiBench
        },
        careerMomentum: {
            score: uMom,
            display: `${userScores.careerMomentumMonths ?? 18}M`,
            months: userScores.careerMomentumMonths ?? 18,
            color: uMom >= 70 ? 'GREEN' : uMom >= 40 ? 'AMBER' : 'RED',
            justification: userClock.careerMomentumJustification || userScores.careerMomentumJustification || null,
            benchmarks: momBench
        },
        skillRelevance: {
            score: uSkl,
            display: `${uSkl}%`,
            color: uSkl >= 70 ? 'GREEN' : uSkl >= 40 ? 'AMBER' : 'RED',
            justification: userClock.skillRelevanceJustification || userScores.skillRelevanceJustification || null,
            benchmarks: sklBench
        },
        opportunityWindow: {
            score: uOpp,
            display: `${userScores.opportunityWindowYears ?? 2}YRS`,
            years: userScores.opportunityWindowYears ?? 2,
            color: 'BLUE',
            justification: userClock.opportunityWindowJustification || userScores.opportunityWindowJustification || null,
            benchmarks: oppBench
        }
    };
}

/**
 * Clock Refresh Logic after case complete
 */
/**
 * Real-time recalibration for a specific user (Step 1 Hook)
 */
async function recalibrateForUser(userId, profile) {
    try {
        if (!userId || !profile) {
            console.error('[ClockService] ❌ Recalibrate failed: Missing userId or profile');
            return null;
        }

        const role = profile.identity?.currentRoleTitle || profile.current_role || 'Professional';
        const industry = profile.inferred?.domainIndicator || profile.domain || profile.industry || 'Technology';
        const skills = profile.composition?.skills?.technical || profile.skills || [];
        const achievements = profile.work?.experience?.[0]?.achievements || profile.achievements || [];
        const experienceYears = Number(profile.inferred?.totalExperienceYears || profile.experience_years || 0);

        console.log(`[ClockService] ⏳ Starting Recalibration for ${role} in ${industry}...`);

        let clockScores = null;
        const pulse = await findActivePulse(role, industry);

        if (pulse) {
            console.log(`[ClockService] ✅ Found matching Pulse: ${pulse.pulseId}`);
            clockScores = calculateClockScores(profile, pulse);
        } else {
            console.log(`[ClockService] 🔍 No cached pulse. Calling AI Provider...`);
            clockScores = await generateClockScores({
                role,
                industry,
                skills,
                achievements,
                tenure: experienceYears
            });
            console.log(`[ClockService] 🤖 AI calculation complete for ${role}`);
        }

        if (!clockScores) {
            throw new Error('Failed to generate clock scores.');
        }

        // 3. Save to UserClocks 
        const validityDays = 30;
        const clockValidUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

        console.log(`[ClockService] 💾 Saving to UserClocks for user: ${userId}`);
        const updatedClock = await db.UserClocks.findOneAndUpdate(
            { userId: String(userId) },
            {
                $set: {
                    validityState: 'ACTIVE_CLOCK',
                    clockValidUntil,
                    caseValidUntil: null,
                    effectiveValidUntil: clockValidUntil,
                    daysLeft: validityDays,
                    lastCalculatedBy: 'PROFILE_CONFIRM',
                    lastCalculatedAt: new Date(),
                    pulseId: pulse?.pulseId || null,
                    ...clockScores,
                    llm: clockScores.llm || 'N/A',
                    model: clockScores.model || 'N/A',
                    tokenUsage: clockScores.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    calculationDuration: clockScores.calculationDuration || null,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // 4. Record in History
        const historyId = `CLK_HIST_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        console.log(`[ClockService] 💾 Logging to ClockHistory: ${historyId}`);
        await db.ClockHistory.create({
            historyId,
            userId: String(userId),
            aiExposureScore: clockScores.aiExposureScore,
            careerMomentumScore: clockScores.careerMomentumScore,
            skillRelevanceScore: clockScores.skillRelevanceScore,
            opportunityWindowScore: clockScores.opportunityWindowScore,
            careerMomentumMonths: clockScores.careerMomentumMonths || 0,
            opportunityWindowYears: clockScores.opportunityWindowYears || 0,
            pulseId: pulse?.pulseId || null,
            triggeredBy: 'AUTO_OPEN',
            calculatedAt: new Date(),
            llm: clockScores.llm || 'N/A',
            model: clockScores.model || 'N/A',
            tokenUsage: clockScores.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            calculationDuration: clockScores.calculationDuration || null
        });

        console.log(`[ClockService] ✅ Successfully finished recalibration for ${userId}`);
        return updatedClock;
    } catch (err) {
        console.error(`[ClockService] ❌ CRITICAL: Recalibrate for user failed:`, err.message);
        return null;
    }
}

async function refreshClocksAfterCase(userId, runId) {
    try {
        if (!userId) return;

        const profileRas = await db.Ras.findOne({ runId, artifactType: 'PROFILE_CONFIRMED', status: 'FINAL' });
        const profile = profileRas?.artifactJson?.confirmedProfile || profileRas?.artifactJson?.profile || profileRas?.artifactJson || {};

        const data = {
            role: profile?.current_role || 'Professional',
            industry: profile?.domain || profile?.industry || 'Technology',
            skills: profile?.skills || [],
            achievements: profile?.achievements || profile?.key_achievements || [],
            tenure: Number(profile?.experience_years || 0)
        };

        let clockScores = null;
        try {
            clockScores = await generateClockScores(data);
        } catch (aiErr) {
            console.warn(`[Expert] AI Provider failed — using integrity pack fallback:`, aiErr.message);
            const integrityRas = await db.Ras.findOne({ runId, artifactType: 'INTEGRITY_PACK', status: 'FINAL' });
            const constraints = integrityRas?.artifactJson?.constraints?.results || [];
            const cons001 = constraints.find(c => c.constraintId === 'CONS_AI_001');
            const cons002 = constraints.find(c => c.constraintId === 'CONS_AI_002');
            const cons003 = constraints.find(c => c.constraintId === 'CONS_AI_003');

            clockScores = {
                aiExposureScore: cons001 ? Math.round(100 - cons001.score) : 50,
                aiExposureJustification: 'Score based on integrity analysis — market data unavailable.',
                careerMomentumScore: cons003 ? cons003.score : 50,
                careerMomentumJustification: 'Score based on role uniqueness — market data unavailable.',
                careerMomentumMonths: 18,
                skillRelevanceScore: cons001 ? cons001.score : 50,
                skillRelevanceJustification: 'Score based on automation exposure — market data unavailable.',
                opportunityWindowScore: cons002 ? cons002.score : 50,
                opportunityWindowJustification: 'Score based on financial resilience — market data unavailable.',
                opportunityWindowYears: 2,
                trendTrigger: null
            };
        }

        const existingClock = await db.UserClocks.findOne({ userId });
        const caseValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.UserClocks.findOneAndUpdate(
            { userId },
            {
                $set: {
                    validityState: 'ACTIVE_CASE',
                    caseValidUntil,
                    clockValidUntil: null,
                    effectiveValidUntil: caseValidUntil,
                    daysLeft: 30,
                    lastCalculatedBy: 'CASE_RUN',
                    lastCalculatedAt: new Date(),
                    ...clockScores,
                    llm: clockScores.llm || 'N/A',
                    model: clockScores.model || 'N/A',
                    tokenUsage: clockScores.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    calculationDuration: clockScores.calculationDuration || null,
                    previousAiExposureScore: existingClock?.aiExposureScore ?? null,
                    previousCareerMomentumScore: existingClock?.careerMomentumScore ?? null,
                    previousSkillRelevanceScore: existingClock?.skillRelevanceScore ?? null,
                    previousOpportunityWindowScore: existingClock?.opportunityWindowScore ?? null,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        console.log(`[ClockService] ✅ Clocks refreshed for user ${userId} — 30 days`);

        // ── NEW: Record Snapshot in History ──
        const historyId = `CLK_HIST_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        await db.ClockHistory.create({
            historyId,
            userId: String(userId),
            aiExposureScore: clockScores.aiExposureScore,
            careerMomentumScore: clockScores.careerMomentumScore,
            skillRelevanceScore: clockScores.skillRelevanceScore,
            opportunityWindowScore: clockScores.opportunityWindowScore,
            careerMomentumMonths: clockScores.careerMomentumMonths || 0,
            opportunityWindowYears: clockScores.opportunityWindowYears || 0,
            pulseId: null, // CASE_RUN is based on Run context, not a specific market pulse
            triggeredBy: 'CASE_RUN',
            calculatedAt: new Date(),
            llm: clockScores.llm || 'N/A',
            model: clockScores.model || 'N/A',
            tokenUsage: clockScores.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            calculationDuration: clockScores.calculationDuration || null
        });

        return true;
    } catch (err) {
        console.warn(`[ClockService] ⚠️ Refresh failed:`, err.message);
    }
}

module.exports = {
    generateClockScores,
    computeValidityState,
    findActivePulse,
    calculateClockScores,
    detectSignificantChange,
    getPeerBenchmarks,
    buildClocksResponse,
    refreshClocksAfterCase,
    recalibrateForUser
};
