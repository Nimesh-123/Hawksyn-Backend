const { db } = require('../models/index.model.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * AI Score Generator
 */
async function generateClockScoresFromGemini({ role, industry, skills, achievements, tenure }) {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(clean);
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
function getPeerBenchmarks(score, type) {
    const isInverted = (type === 'AI_EXPOSURE');
    let top, median, bottom;

    if (isInverted) {
        top = Math.max(0, Math.round(score * 0.6));
        median = Math.round(score);
        bottom = Math.min(100, Math.round(score * 1.3));
    } else {
        top = Math.min(100, Math.round(score * 1.25));
        median = Math.round(score);
        bottom = Math.max(0, Math.round(score * 0.7));
    }

    let userState = 'Median';
    if (isInverted) {
        if (score <= top) userState = 'Top 20%';
        else if (score >= bottom) userState = 'Bottom 20%';
    } else {
        if (score >= top) userState = 'Top 20%';
        else if (score <= bottom) userState = 'Bottom 20%';
    }

    return { top20: top, median, bottom20: bottom, userState };
}

/**
 * UI Response Object
 */
function buildClocksResponse(scores, userClock = {}) {
    const aiScore = scores.aiExposureScore ?? 0;
    const momScore = scores.careerMomentumScore ?? 0;
    const sklScore = scores.skillRelevanceScore ?? 0;
    const oppScore = scores.opportunityWindowScore ?? 0;

    return {
        aiExposure: {
            score: aiScore,
            display: `${aiScore}%`,
            risk: aiScore > 70 ? 'HIGH' : aiScore > 40 ? 'MEDIUM' : 'LOW',
            color: aiScore > 70 ? 'RED' : aiScore > 40 ? 'AMBER' : 'GREEN',
            showRiskBadge: aiScore > 70,
            justification: userClock.aiExposureJustification || scores.aiExposureJustification || null,
            benchmarks: {
                top20: Math.max(0, aiScore - 14),
                median: aiScore,
                bottom20: Math.min(100, aiScore + 13),
                userState: 'Median'
            }
        },
        careerMomentum: {
            score: momScore,
            display: `${scores.careerMomentumMonths ?? 18}M`,
            months: scores.careerMomentumMonths ?? 18,
            color: momScore >= 70 ? 'GREEN' : momScore >= 40 ? 'AMBER' : 'RED',
            justification: userClock.careerMomentumJustification || scores.careerMomentumJustification || null,
            benchmarks: {
                top20: Math.min(100, momScore + 15),
                median: momScore,
                bottom20: Math.max(0, momScore - 26),
                userState: 'Median'
            }
        },
        skillRelevance: {
            score: sklScore,
            display: `${sklScore}%`,
            color: sklScore >= 70 ? 'GREEN' : sklScore >= 40 ? 'AMBER' : 'RED',
            justification: userClock.skillRelevanceJustification || scores.skillRelevanceJustification || null,
            benchmarks: {
                top20: Math.min(100, sklScore + 28),
                median: sklScore,
                bottom20: Math.max(0, sklScore - 28),
                userState: 'Median'
            }
        },
        opportunityWindow: {
            score: oppScore,
            display: `${scores.opportunityWindowYears ?? 2}YRS`,
            years: scores.opportunityWindowYears ?? 2,
            color: 'BLUE',
            justification: userClock.opportunityWindowJustification || scores.opportunityWindowJustification || null,
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
            console.log(`[ClockService] 🔍 No cached pulse. Calling Gemini AI...`);
            clockScores = await generateClockScoresFromGemini({
                role,
                industry,
                skills,
                achievements,
                tenure: experienceYears
            });
            console.log(`[ClockService] 🤖 Gemini calculation complete for ${role}`);
        }

        if (!clockScores) {
            throw new Error('Failed to generate clock scores.');
        }

        // 3. Save to UserClocks 
        const validityDays = 7;
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
                    ...clockScores,
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
            triggeredBy: 'AUTO_OPEN',
            calculatedAt: new Date()
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
            role:         profile?.current_role                || 'Professional',
            industry:     profile?.domain || profile?.industry || 'Technology',
            skills:       profile?.skills                      || [],
            achievements: profile?.achievements || profile?.key_achievements || [],
            tenure:       Number(profile?.experience_years     || 0)
        };

        let clockScores = null;
        try {
            clockScores = await generateClockScoresFromGemini(data);
        } catch (geminiErr) {
            console.warn(`[Expert] Gemini failed — using integrity pack fallback:`, geminiErr.message);
            const integrityRas = await db.Ras.findOne({ runId, artifactType: 'INTEGRITY_PACK', status: 'FINAL' });
            const constraints = integrityRas?.artifactJson?.constraints?.results || [];
            const cons001 = constraints.find(c => c.constraintId === 'CONS_AI_001');
            const cons002 = constraints.find(c => c.constraintId === 'CONS_AI_002');
            const cons003 = constraints.find(c => c.constraintId === 'CONS_AI_003');

            clockScores = {
                aiExposureScore:                cons001 ? Math.round(100 - cons001.score) : 50,
                aiExposureJustification:        'Score based on integrity analysis — market data unavailable.',
                careerMomentumScore:            cons003 ? cons003.score : 50,
                careerMomentumJustification:    'Score based on role uniqueness — market data unavailable.',
                careerMomentumMonths:           18,
                skillRelevanceScore:            cons001 ? cons001.score : 50,
                skillRelevanceJustification:    'Score based on automation exposure — market data unavailable.',
                opportunityWindowScore:         cons002 ? cons002.score : 50,
                opportunityWindowJustification: 'Score based on financial resilience — market data unavailable.',
                opportunityWindowYears:         2,
                trendTrigger:                   null
            };
        }

        const existingClock = await db.UserClocks.findOne({ userId });
        const caseValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.UserClocks.findOneAndUpdate(
            { userId },
            {
                $set: {
                    validityState:       'ACTIVE_CASE',
                    caseValidUntil,
                    clockValidUntil:     null,
                    effectiveValidUntil: caseValidUntil,
                    daysLeft:            30,
                    lastCalculatedBy:    'CASE_RUN',
                    lastCalculatedAt:    new Date(),
                    ...clockScores,
                    previousAiExposureScore:        existingClock?.aiExposureScore        ?? null,
                    previousCareerMomentumScore:    existingClock?.careerMomentumScore    ?? null,
                    previousSkillRelevanceScore:    existingClock?.skillRelevanceScore    ?? null,
                    previousOpportunityWindowScore: existingClock?.opportunityWindowScore ?? null,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        console.log(`[ClockService] ✅ Clocks refreshed for user ${userId} — 30 days`);
        return true;
    } catch (err) {
        console.warn(`[ClockService] ⚠️ Refresh failed:`, err.message);
    }
}

module.exports = {
    generateClockScoresFromGemini,
    computeValidityState,
    findActivePulse,
    calculateClockScores,
    detectSignificantChange,
    getPeerBenchmarks,
    buildClocksResponse,
    refreshClocksAfterCase,
    recalibrateForUser
};
