const { db } = require('../models/index.model.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────────────
// HELPER 1 — computeValidityState
// Doc point 13: Priority order = Case > Clock > Frozen
// ─────────────────────────────────────────────────────────────────
function computeValidityState(userClock) {
    const now = new Date();

    // Priority 1: Case active (30 days — doc point 10)
    if (userClock?.caseValidUntil && new Date(userClock.caseValidUntil) > now) {
        const ms = new Date(userClock.caseValidUntil) - now;
        const daysLeft = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        return {
            state: 'ACTIVE_CASE',
            effectiveValidUntil: userClock.caseValidUntil,
            daysLeft
        };
    }

    // Priority 2: Clock valid (7 days — doc point 7)
    if (userClock?.clockValidUntil && new Date(userClock.clockValidUntil) > now) {
        const ms = new Date(userClock.clockValidUntil) - now;
        const daysLeft = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        return {
            state: 'ACTIVE_CLOCK',
            effectiveValidUntil: userClock.clockValidUntil,
            daysLeft
        };
    }

    // Priority 3: Frozen (doc point 7)
    return {
        state: 'FROZEN',
        effectiveValidUntil: null,
        daysLeft: 0
    };
}

// ─────────────────────────────────────────────────────────────────
// HELPER 2 — findActivePulse
// Role + industry fuzzy match — MarketPulse table se
// ─────────────────────────────────────────────────────────────────
async function findActivePulse(role, industry) {
    if (!role || !industry) return null;

    // Strict escape helper
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try exact match first
    let pulse = await db.MarketPulse.findOne({
        role: { $regex: new RegExp(`^${escapeRegex(role.trim())}$`, 'i') },
        industry: { $regex: new RegExp(`^${escapeRegex(industry.trim())}$`, 'i') },
        isActive: true
    }).sort({ createdAt: -1 });

    // Fallback: Fuzzy match role with strict industry
    if (!pulse) {
        pulse = await db.MarketPulse.findOne({
            role: { $regex: new RegExp(escapeRegex(role.trim()), 'i') },
            industry: { $regex: new RegExp(escapeRegex(industry.trim()), 'i') },
            isActive: true
        }).sort({ createdAt: -1 });
    }

    // Fallback: Industry only (if role is generic)
    if (!pulse) {
        pulse = await db.MarketPulse.findOne({
            industry: { $regex: new RegExp(escapeRegex(industry.trim()), 'i') },
            isActive: true
        }).sort({ createdAt: -1 });
    }

    return pulse;
}

// ─────────────────────────────────────────────────────────────────
// HELPER 3 — calculateClockScores
// Profile + pulse combine karke 4 user-specific scores
// ─────────────────────────────────────────────────────────────────
function calculateClockScores(profile, pulse) {
    const experienceYears = Number(
        profile?.experience_years || profile?.experienceYears || 0
    );

    // Career Momentum: experience adds up to +15 boost (doc: profile + market combined)
    const expBoost = Math.min(15, Math.floor(experienceYears / 2));
    const careerMomentum = Math.min(100, pulse.careerMomentumScore + expBoost);

    return {
        aiExposureScore: Math.round(pulse.aiExposureScore),
        careerMomentumScore: Math.round(careerMomentum),
        skillRelevanceScore: Math.round(pulse.skillRelevanceScore),
        opportunityWindowScore: Math.round(pulse.opportunityWindowScore),
        careerMomentumMonths: pulse.careerMomentumMonths,
        opportunityWindowYears: pulse.opportunityWindowYears
    };
}

// ─────────────────────────────────────────────────────────────────
// HELPER 4 — detectSignificantChange
// Doc point 5: threshold = 10 points → critical alert
// ─────────────────────────────────────────────────────────────────
function detectSignificantChange(userClock, newScores, threshold = 10) {
    if (!userClock?.aiExposureScore) return false;

    const deltas = [
        Math.abs(newScores.aiExposureScore - (userClock.aiExposureScore || 0)),
        Math.abs(newScores.careerMomentumScore - (userClock.careerMomentumScore || 0)),
        Math.abs(newScores.skillRelevanceScore - (userClock.skillRelevanceScore || 0)),
        Math.abs(newScores.opportunityWindowScore - (userClock.opportunityWindowScore || 0))
    ];

    return deltas.some(d => d >= threshold);
}

// ─────────────────────────────────────────────────────────────────
// HELPER 5 — saveClockHistory
// Doc point 4: every recalculation stored
// ─────────────────────────────────────────────────────────────────
async function saveClockHistory(userId, scores, triggeredBy, pulseId) {
    const historyId = `CH_${userId}_${Date.now()}`;
    await db.ClockHistory.create({
        historyId,
        userId,
        aiExposureScore: scores.aiExposureScore,
        careerMomentumScore: scores.careerMomentumScore,
        skillRelevanceScore: scores.skillRelevanceScore,
        opportunityWindowScore: scores.opportunityWindowScore,
        careerMomentumMonths: scores.careerMomentumMonths,
        opportunityWindowYears: scores.opportunityWindowYears,
        triggeredBy,
        pulseId: pulseId || null
    });
}

// ─────────────────────────────────────────────────────────────────
// HELPER 7 — getPeerBenchmarks
// Slide 15 Comparison Logic — Generates market bands based on pulse
// ─────────────────────────────────────────────────────────────────
function getPeerBenchmarks(score, type) {
    // Note: Scores typically vary by +/- 15-20 points for Top/Bottom bands
    // For AI Exposure, HIGH score is BAD, so Top 20% would be LOWER exposure.
    const isInverted = (type === 'AI_EXPOSURE'); 
    
    let top, median, bottom;
    
    if (isInverted) {
        top = Math.max(0, Math.round(score * 0.6));    // Elite have 40% less exposure
        median = Math.round(score);                    // Median is the market pulse
        bottom = Math.min(100, Math.round(score * 1.3)); // At risk have 30% more exposure
    } else {
        top = Math.min(100, Math.round(score * 1.25));  // Elite are 25% better
        median = Math.round(score);                    // Median is market pulse
        bottom = Math.max(0, Math.round(score * 0.7));  // Bottom are 30% worse
    }

    // Determine User State (Slide 15)
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
        userState: userState
    };
}

// ─────────────────────────────────────────────────────────────────
// HELPER 6 — buildClocksResponse
// UI ke liye clean clock object with COLOR logic (Doc Slide 14)
// ─────────────────────────────────────────────────────────────────
function buildClocksResponse(scores) {
    const aiScore = scores.aiExposureScore;
    const momentumScore = scores.careerMomentumScore;
    const skillScore = scores.skillRelevanceScore;
    const oppScore = scores.opportunityWindowScore;

    return {
        aiExposure: {
            score: aiScore,
            display: `${aiScore}%`,
            risk: aiScore >= 70 ? 'HIGH' : aiScore >= 40 ? 'MEDIUM' : 'LOW',
            color: aiScore >= 70 ? 'RED' : aiScore >= 40 ? 'AMBER' : 'GREEN',
            showRiskBadge: aiScore >= 70,
            benchmarks: getPeerBenchmarks(aiScore, 'AI_EXPOSURE')
        },
        careerMomentum: {
            score: momentumScore,
            display: `${scores.careerMomentumMonths}M`,
            months: scores.careerMomentumMonths,
            color: momentumScore >= 70 ? 'GREEN' : momentumScore >= 40 ? 'AMBER' : 'RED',
            benchmarks: getPeerBenchmarks(momentumScore, 'VELOCITY')
        },
        skillRelevance: {
            score: skillScore,
            display: `${skillScore}%`,
            color: skillScore >= 70 ? 'GREEN' : skillScore >= 40 ? 'AMBER' : 'RED',
            benchmarks: getPeerBenchmarks(skillScore, 'SKILLS')
        },
        opportunityWindow: {
            score: oppScore,
            display: `${scores.opportunityWindowYears}YRS`,
            years: scores.opportunityWindowYears,
            color: 'BLUE' // Role Longevity is neutral
        }
    };
}


// ═══════════════════════════════════════════════════════════════
// API 1 — GET /api/v1/users/:userId/command-center
// User dashboard open karta hai (doc point 3)
// ═══════════════════════════════════════════════════════════════
exports.getCommandCenter = async (req, res) => {
    try {
        const { userId } = req.params;

        // A. Load user
        const user = await db.User.findOne({ userId }); // Note: Using db.User as per project schema (id vs userId)
        if (!user) {
            // Check by _id if userId field not present
            const userById = await db.User.findById(userId);
            if (!userById) return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Load profile
        const userProfile = await db.UserProfile.findOne({ userId: req.params.userId });
        const profile = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        const role = profile.identity?.currentRoleTitle || null;
        const industry = profile.inferred?.domainIndicator || null;

        // B. Load existing UserClocks
        const userClock = await db.UserClocks.findOne({ userId });

        // C. Compute validity (doc point 13 priority rule)
        const validity = computeValidityState(userClock);

        // D. FROZEN → return frozen state immediately
        if (validity.state === 'FROZEN') {
            // Still load credits for balance display
            const credits = await db.UserCredits.findOne({ userId });
            return res.status(200).json({
                success: true,
                data: {
                    userId,
                    validityState: 'FROZEN',
                    daysLeft: 0,
                    effectiveValidUntil: null,
                    clocks: null,
                    insightText: null,
                    checksBalance: credits?.checksBalance ?? 0,
                    canRefresh: true, // Frozen state allows refresh
                    barColor: 'BLUE', // Bar turns blue when at zero (Slide 14)
                    message: 'Clocks frozen. Run Hawk to recalibrate or complete a case.'
                }
            });
        }

        // E. Find active market pulse (doc point 2, 3)
        const pulse = await findActivePulse(role, industry);

        if (!pulse) {
            // No pulse available — return last stored scores
            return res.status(200).json({
                success: true,
                data: {
                    userId,
                    validityState: validity.state,
                    daysLeft: validity.daysLeft,
                    effectiveValidUntil: validity.effectiveValidUntil,
                    clocks: userClock?.aiExposureScore != null
                        ? buildClocksResponse({
                            aiExposureScore: userClock.aiExposureScore,
                            careerMomentumScore: userClock.careerMomentumScore,
                            skillRelevanceScore: userClock.skillRelevanceScore,
                            opportunityWindowScore: userClock.opportunityWindowScore,
                            careerMomentumMonths: userClock.careerMomentumMonths,
                            opportunityWindowYears: userClock.opportunityWindowYears
                        })
                        : null,
                    insightText: userClock?.insightText || null,
                    pulseAvailable: false,
                    significantChange: false,
                    canRefresh: validity.daysLeft === 0,
                    barColor: validity.daysLeft === 0 ? 'BLUE' : 'GREY',
                    experts: await db.RiskAuditorRegistry.find({ isActive: true }).limit(3).lean().then(list => list.map(e => ({
                        auditorId: e.auditorId,
                        name: e.auditorName,
                        title: e.professionalBackground || 'Risk Expert',
                        caseSpecialization: e.specializations?.[0] || 'Role Assessment',
                        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.auditorName}`
                    }))),
                    message: 'Market pulse not yet available. Scores from last calibration shown.'
                }
            });
        }

        // F. Calculate fresh scores (doc point 3)
        const newScores = calculateClockScores(profile.inferred || {}, pulse);

        // G. Detect significant change (doc point 5)
        const significantChange = detectSignificantChange(userClock, newScores);

        // H. Update UserClocks
        await db.UserClocks.findOneAndUpdate(
            { userId },
            {
                $set: {
                    ...newScores,
                    insightText: pulse.insightText,
                    pulseId: pulse.pulseId,
                    validityState: validity.state,
                    effectiveValidUntil: validity.effectiveValidUntil,
                    daysLeft: validity.daysLeft,
                    // Preserve existing validity dates — AUTO_OPEN doesn't reset them
                    lastCalculatedAt: new Date(),
                    lastCalculatedBy: 'AUTO_OPEN',
                    previousAiExposureScore: userClock?.aiExposureScore ?? null,
                    previousCareerMomentumScore: userClock?.careerMomentumScore ?? null,
                    previousSkillRelevanceScore: userClock?.skillRelevanceScore ?? null,
                    previousOpportunityWindowScore: userClock?.opportunityWindowScore ?? null,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // I. Save history (doc point 4)
        await saveClockHistory(userId, newScores, 'AUTO_OPEN', pulse.pulseId);

        // J. Load credits
        const credits = await db.UserCredits.findOne({ userId });

        return res.status(200).json({
            success: true,
            data: {
                userId,
                validityState: validity.state,
                daysLeft: validity.daysLeft,
                effectiveValidUntil: validity.effectiveValidUntil,
                clocks: buildClocksResponse(newScores),
                insightText: pulse.insightText,
                pulseId: pulse.pulseId,
                checksBalance: credits?.checksBalance ?? 0,
                significantChange,
                canRefresh: validity.daysLeft === 0,
                barColor: validity.daysLeft === 0 ? 'BLUE' : 'GREY',
                experts: await db.RiskAuditorRegistry.find({ isActive: true }).limit(3).lean().then(list => list.map(e => ({
                    auditorId: e.auditorId,
                    name: e.auditorName,
                    title: e.professionalBackground || 'Risk Expert',
                    caseSpecialization: e.specializations?.[0] || 'Role Assessment',
                    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.auditorName}`
                }))),
                message: validity.state === 'ACTIVE_CASE'
                    ? `Clocks valid via active case — ${validity.daysLeft} days remaining.`
                    : `Clocks active — ${validity.daysLeft} days remaining.`
            }
        });

    } catch (error) {
        console.error('[CommandCenter] getCommandCenter error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════════
// API 2 — POST /api/v1/users/:userId/hawk
// Manual recalibration — consumes 1 credit (doc point 8, 9)
// Edge case: case active → no credit consumed (doc point 12)
// ═══════════════════════════════════════════════════════════════
exports.runHawk = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await db.User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const userClock = await db.UserClocks.findOne({ userId });
        const validity = computeValidityState(userClock);

        // Doc point 12: Case active → inform user, no credit consumed
        if (validity.state === 'ACTIVE_CASE') {
            return res.status(200).json({
                success: true,
                data: {
                    hawkRun: false,
                    creditConsumed: false,
                    validityState: 'ACTIVE_CASE',
                    daysLeft: validity.daysLeft,
                    checksBalance: (await db.UserCredits.findOne({ userId }))?.checksBalance ?? 0,
                    message: `Your clocks are already active via a running case. ${validity.daysLeft} days remaining. No check consumed.`
                }
            });
        }

        // Check credits (doc point 9)
        const credits = await db.UserCredits.findOne({ userId });
        if (!credits || credits.checksBalance < 1) {
            return res.status(402).json({
                success: false,
                data: {
                    hawkRun: false,
                    creditConsumed: false,
                    checksBalance: credits?.checksBalance ?? 0,
                    message: 'Insufficient checks. Purchase credits to run Hawk.'
                }
            });
        }

        // Load profile + pulse
        const userProfile = await db.UserProfile.findOne({ userId });
        const profile = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        const role = profile.identity?.currentRoleTitle || 'Professional';
        const industry = profile.inferred?.domainIndicator || 'Technology';

        const pulse = await findActivePulse(role, industry);
        if (!pulse) {
            return res.status(503).json({
                success: false,
                message: 'Market pulse not available yet. No check consumed. Try again later.'
            });
        }

        // Calculate new scores
        const newScores = calculateClockScores(profile.inferred || {}, pulse);

        // Significant change?
        const significantChange = detectSignificantChange(userClock, newScores);

        // +7 days validity from now (doc point 7, 8)
        const clockValidUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Update UserClocks
        await db.UserClocks.findOneAndUpdate(
            { userId },
            {
                $set: {
                    ...newScores,
                    insightText: pulse.insightText,
                    pulseId: pulse.pulseId,
                    validityState: 'ACTIVE_CLOCK',
                    clockValidUntil,
                    effectiveValidUntil: clockValidUntil,
                    daysLeft: 7,
                    lastCalculatedAt: new Date(),
                    lastCalculatedBy: 'HAWK',
                    previousAiExposureScore: userClock?.aiExposureScore ?? null,
                    previousCareerMomentumScore: userClock?.careerMomentumScore ?? null,
                    previousSkillRelevanceScore: userClock?.skillRelevanceScore ?? null,
                    previousOpportunityWindowScore: userClock?.opportunityWindowScore ?? null,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // Consume 1 credit (doc point 9)
        const newBalance = credits.checksBalance - 1;
        await db.UserCredits.findOneAndUpdate(
            { userId },
            {
                $set: { checksBalance: newBalance, updatedAt: new Date() },
                $push: {
                    transactions: {
                        type: 'HAWK_CONSUME',
                        amount: -1,
                        balanceAfter: newBalance,
                        note: `Hawk recalibration — ${new Date().toISOString()}`,
                        createdAt: new Date()
                    }
                }
            }
        );

        // Save history
        await saveClockHistory(userId, newScores, 'HAWK', pulse.pulseId);

        return res.status(200).json({
            success: true,
            data: {
                hawkRun: true,
                creditConsumed: true,
                checksBalance: newBalance,
                validityState: 'ACTIVE_CLOCK',
                clockValidUntil,
                daysLeft: 7,
                clocks: buildClocksResponse(newScores),
                insightText: pulse.insightText,
                significantChange,
                message: 'Hawk complete. Clocks recalibrated and valid for 7 days.'
            }
        });

    } catch (error) {
        console.error('[CommandCenter] runHawk error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════════
// API 3 — POST /api/v1/users/:userId/clock-refresh-from-case
// INTERNAL — called by expertController after case completes
// Doc point 10, 11: case run → 30 days validity, no credit consumed
// ═══════════════════════════════════════════════════════════════
exports.refreshClocksFromCase = async (req, res) => {
    try {
        const { userId } = req.params;
        const { runId } = req.body;

        const user = await db.User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const userProfile = await db.UserProfile.findOne({ userId });
        const profile = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        const role = profile.identity?.currentRoleTitle || null;
        const industry = profile.inferred?.domainIndicator || null;

        // +30 days validity (doc point 10)
        const caseValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Try to get fresh scores from pulse
        const pulse = await findActivePulse(role, industry);
        const newScores = pulse ? calculateClockScores(profile.inferred || {}, pulse) : null;

        const updateData = {
            validityState: 'ACTIVE_CASE',
            caseValidUntil,
            effectiveValidUntil: caseValidUntil,
            daysLeft: 30,
            lastCalculatedAt: new Date(),
            lastCalculatedBy: 'CASE_RUN',
            updatedAt: new Date()
        };

        if (newScores) {
            Object.assign(updateData, {
                ...newScores,
                insightText: pulse.insightText,
                pulseId: pulse.pulseId
            });
        }

        await db.UserClocks.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { upsert: true, new: true }
        );

        if (newScores) {
            await saveClockHistory(userId, newScores, 'CASE_RUN', pulse?.pulseId || null);
        }

        return res.status(200).json({
            success: true,
            data: {
                userId,
                runId: runId || null,
                validityState: 'ACTIVE_CASE',
                caseValidUntil,
                daysLeft: 30,
                clocksRefreshed: !!newScores,
                message: 'Clocks refreshed from case run. Valid for 30 days.'
            }
        });

    } catch (error) {
        console.error('[CommandCenter] refreshClocksFromCase error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════════
// API 4 — GET /api/v1/users/:userId/credits
// Credits balance + recent transactions
// ═══════════════════════════════════════════════════════════════
exports.getCredits = async (req, res) => {
    try {
        const { userId } = req.params;
        let credits = await db.UserCredits.findOne({ userId });

        if (!credits) {
            credits = await db.UserCredits.create({ userId, checksBalance: 0 });
        }

        return res.status(200).json({
            success: true,
            data: {
                userId,
                checksBalance: credits.checksBalance,
                transactions: (credits.transactions || []).slice(-10)
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
