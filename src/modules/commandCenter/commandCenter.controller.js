const { db } = require('../../models/index.model.js');
const { runTrendEngine } = require('../signals/crons/trendEngine.cron.js');
const { 
    computeValidityState, 
    findActivePulse, 
    calculateClockScores, 
    detectSignificantChange, 
    buildClocksResponse,
    generateClockScores
} = require('../../services/clockService');
const { calculateAICost, convertToLocalCurrency } = require('../admin/helpers/aiCostHelper.js');
const { detectRegionFromIP } = require('../../../utils/regionHelper');

async function saveClockHistory(userId, scores, type, pulseId) {
    try {
        const historyId = `HIST_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        await db.ClockHistory.create({
            historyId,
            userId,
            ...scores,
            calculatedBy: type,
            pulseId,
            calculatedAt: new Date()
        });
    } catch (err) {
        console.warn('[CommandCenter] History save failed:', err.message);
    }
}


exports.getCommandCenter = async (req, res) => {
    try {
        const { userId } = req.params;
        const mongoose = require('mongoose');

        // Cast to ObjectId to avoid mismatches
        let userObjId;
        try {
            userObjId = new mongoose.Types.ObjectId(userId);
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid User ID format' });
        }

        const user = await db.User.findById(userObjId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const userProfile = await db.UserProfile.findOne({ userId: userObjId });
        const profile = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        const role = profile.identity?.currentRoleTitle || null;
        const industry = profile.inferred?.domainIndicator || null;

        let userClock = await db.UserClocks.findOne({ userId: String(userId) });

        // Recalibrate for confirmed user if clocks are missing
        if (!userClock && userProfile?.isConfirmed === true) {
            console.log(`[CommandCenter] Auto-fixing missing clocks for confirmed user: ${userId}`);
            await require('../../services/clockService').recalibrateForUser(String(userId), profile);
            userClock = await db.UserClocks.findOne({ userId: String(userId) });
        }

        if (!userClock) {
            return res.status(200).json({ 
                success: true, 
                data: { validityState: 'FROZEN', clocks: null, message: 'Please complete Step 1 to initialize clocks.' } 
            });
        }

        // Validity State
        const validity = computeValidityState(userClock);

        // Find active market pulse (for insight text only)
        const pulse = await findActivePulse(role, industry);

        // 1. Check for Assigned Expert (Run Priority)
        const activeRun = await db.Runs.findOne({ userId: userObjId }).sort({ createdAt: -1 });
        let assignedExperts = [];

        if (activeRun) {
            const expertAssignment = await db.Ras.findOne({
                runId: activeRun.runId,
                artifactType: 'EXPERT_ASSIGNED'
            });

            if (expertAssignment?.artifactJson?.assignedExpert) {
                assignedExperts = [expertAssignment.artifactJson.assignedExpert];
            }
        }

        // 2. Fallback to Discovery Experts if nothing assigned
        if (assignedExperts.length === 0) {
            const activeSpecialists = await db.RiskAuditorRegistry.find({ 
                isActive: true,
                status: 'ACTIVE'
            }).limit(3).lean();

            assignedExperts = activeSpecialists.map(specialist => ({
                auditorId: specialist.auditorId,
                auditorName: specialist.auditorName,
                specializations: specialist.specializations,
                displayRole: specialist.professionalBackground || 'Risk Specialist'
            }));
        }

        // Scores directly from UserClocks — NEVER recalculate on GET
        const clocksData = {
            aiExposureScore:        userClock.aiExposureScore        ?? 0,
            careerMomentumScore:    userClock.careerMomentumScore    ?? 0,
            skillRelevanceScore:    userClock.skillRelevanceScore    ?? 0,
            opportunityWindowScore: userClock.opportunityWindowScore ?? 0,
            careerMomentumMonths:   userClock.careerMomentumMonths   ?? 18,
            opportunityWindowYears: userClock.opportunityWindowYears ?? 2,
        };

        const marketPulseData = pulse ? {
            pulseId: pulse.pulseId,
            insight: pulse.insightText || '',
            updatedAt: pulse.updatedAt || pulse.createdAt
        } : null;

        const dashboardResponse = {
            userId: String(userId),
            profile: {
                role:       profile?.identity?.currentRoleTitle || profile?.identity?.headline_title || profile?.current_role || role || 'Professional',
                industry:   profile?.inferred?.domainIndicator || profile?.domain || profile?.industry || industry || 'Technology',
                experience: Number(profile?.inferred?.totalExperienceYears || profile?.experience_years || 0)
            },
            validityState:       userClock.validityState,
            daysLeft:            userClock.daysLeft,
            effectiveValidUntil: userClock.effectiveValidUntil,
            
            // Build clock response using stored data vs market median
            clocks: buildClocksResponse(clocksData, userClock, pulse),

            trendTrigger: userClock.trendTrigger || null,
            insightText:  userClock.insightText  || null,
            marketPulse:  marketPulseData,
            pulseAvailable:    !!pulse,
            significantChange: false,
            canRefresh:        userClock.validityState === 'FROZEN',
            experts:           assignedExperts,
            tokenUsage:        userClock.tokenUsage || null,
            cost:              userClock.tokenUsage ? calculateAICost((userClock.llm || 'Anthropic') + '-' + (userClock.model || 'Haiku'), userClock.tokenUsage) : 0,
            localCost:         userClock.tokenUsage ? convertToLocalCurrency(calculateAICost((userClock.llm || 'Anthropic') + '-' + (userClock.model || 'Haiku'), userClock.tokenUsage), detectRegionFromIP(req.ip || '122.161.48.0').currency).amount : 0,
            localCurrency:     detectRegionFromIP(req.ip || '122.161.48.0').currency,
            message:           'Command center loaded successfully.'
        };

        return res.status(200).json({ success: true, data: dashboardResponse });

    } catch (error) {
        console.error('[CommandCenter] Error:', error);
        return res.status(500).json({ success: false, message: `Command center loading failed: ${error.message}`, error: error.message });
    }
};


exports.runHawk = async (req, res) => {
    try {
        const { userId } = req.params;

        const userClock = await db.UserClocks.findOne({ userId });
        const validity = computeValidityState(userClock);

        if (validity.state === 'ACTIVE_CASE') {
            return res.status(400).json({
                success: false,
                message: 'Your clocks are currently synced with a live Case. Recalibration is not needed.'
            });
        }

        const userProfile = await db.UserProfile.findOne({ userId });
        const profileData = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        let achievements = profileData?.work?.experience?.[0]?.achievements || profileData?.achievements || [];
        if (!achievements.length && profileData?.work?.experience?.[0]?.description) {
            achievements = profileData.work.experience[0].description.split('\n').filter(Boolean);
        }

        const dataForGemini = {
            role:         profileData?.identity?.currentRoleTitle || profileData?.identity?.headline_title || profileData?.current_role || 'Professional',
            industry:     profileData?.inferred?.domainIndicator || profileData?.domain || profileData?.industry || 'Technology',
            skills:       profileData?.composition?.skills?.technical || profileData?.skills || [],
            achievements: achievements,
            tenure:       Number(profileData?.inferred?.totalExperienceYears || profileData?.experience_years || 0)
        };

        // Recalculate using Unified AI Chain (Primary: Claude)
        const newScores = await generateClockScores(dataForGemini);
        const significantChange = detectSignificantChange(userClock, newScores);
        const clockValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.UserClocks.findOneAndUpdate(
            { userId },
            {
                $set: {
                    ...newScores,
                    aiExposureJustification:        newScores.aiExposureJustification,
                    careerMomentumJustification:    newScores.careerMomentumJustification,
                    skillRelevanceJustification:    newScores.skillRelevanceJustification,
                    opportunityWindowJustification: newScores.opportunityWindowJustification,
                    trendTrigger:                   newScores.trendTrigger || null,
                    validityState:    'ACTIVE_CLOCK',
                    clockValidUntil,
                    effectiveValidUntil: clockValidUntil,
                    daysLeft:         30,
                    lastCalculatedBy: 'HAWK',
                    lastCalculatedAt: new Date(),
                    updatedAt:        new Date()
                }
            },
            { upsert: true }
        );

        await saveClockHistory(userId, newScores, 'HAWK', null);

        return res.status(200).json({
            success: true,
            data: {
                hawkRun: true,
                validityState: 'ACTIVE_CLOCK',
                tokenUsage: newScores.tokenUsage,
                cost: calculateAICost(newScores.llm + '-' + newScores.model, newScores.tokenUsage),
                localCost: convertToLocalCurrency(calculateAICost(newScores.llm + '-' + newScores.model, newScores.tokenUsage), detectRegionFromIP(req.ip || '122.161.48.0').currency).amount,
                localCurrency: detectRegionFromIP(req.ip || '122.161.48.0').currency,
                clockValidUntil,
                daysLeft: 30,
                clocks: buildClocksResponse(newScores, newScores, newScores), // Benchmarks relative to fresh AI scores
                insightText: newScores.trendTrigger || newScores.aiExposureJustification,
                significantChange,
                message: 'Hawk complete. Clocks recalibrated and valid for 30 days.'
            }
        });

    } catch (error) {
        console.error('[CommandCenter] runHawk error:', error);
        return res.status(500).json({ success: false, message: `Hawk calibration failed: ${error.message}`, error: error.message });
    }
};


exports.refreshClocksFromCase = async (req, res) => {
    try {
        const { userId } = req.params;
        const { runId } = req.body || {};

        const userProfile = await db.UserProfile.findOne({ userId });
        const profile = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        const role = profile.current_role || profile.identity?.currentRoleTitle || 'Professional';
        const industry = profile.domain || profile.industry || 'Technology';

        const pulse = await findActivePulse(role, industry);
        const caseValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const updateData = {
            validityState:       'ACTIVE_CASE',
            caseValidUntil,
            effectiveValidUntil: caseValidUntil,
            daysLeft:            30,
            lastCalculatedAt:    new Date(),
            lastCalculatedBy:    'CASE_RUN',
            // Pulse refresh logic for insightText
            ...(pulse ? { insightText: pulse.insightText, pulseId: pulse.pulseId } : {}),
            updatedAt: new Date()
        };

        const updatedClock = await db.UserClocks.findOneAndUpdate({ userId }, { $set: updateData }, { upsert: true, new: true });
        
        const usage = updatedClock.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        const usdCost = calculateAICost((updatedClock.llm || 'Anthropic') + '-' + (updatedClock.model || 'Haiku'), usage);
        const local = convertToLocalCurrency(usdCost, detectRegionFromIP(req.ip || '122.161.48.0').currency);

        return res.status(200).json({ 
            success: true, 
            message: 'Clocks validity refreshed successfully.',
            data: {
                tokenUsage: usage,
                cost: usdCost,
                localCost: local.amount,
                localCurrency: local.currency
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: `Clock refresh failed: ${error.message}`, error: error.message });
    }
};


exports.getCredits = async (req, res) => {
    try {
        const { userId } = req.params;
        const userCredits = await db.UserCredits.findOne({ userId });

        if (!userCredits) {
            return res.status(200).json({
                success: true,
                data: { checksBalance: 0, expertChatBalance: 0, transactions: [] }
            });
        }

        return res.status(200).json({ success: true, data: userCredits });
    } catch (error) {
        return res.status(500).json({ success: false, message: `Failed to fetch credits: ${error.message}`, error: error.message });
    }
};

exports.runTrendEngineManual = async (req, res) => {
    try {
        await runTrendEngine();
        return res.status(200).json({ success: true, message: 'Trend Engine run complete' });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Trend engine execution failed: ${err.message}`, error: err.message });
    }
};
