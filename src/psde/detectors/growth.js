/**
 * Growth & Trajectory Detectors
 */

function detectLinearGrowth(cv, stats) {
    const sequence = stats.senioritySeq || [];
    const internalPromos = (cv.roles || []).filter(r => (r.role_flags || []).includes('internal_promotion')).length;
    
    const isDetected = internalPromos >= 1 || (sequence.length > 2 && sequence[sequence.length-1] > sequence[0]);
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Candidate shows consistent upward career direction or internal promotions.' : 'career direction appears lateral or stable.',
        anchors: isDetected ? [
            { type: 'TITLE_SENIORITY_SEQUENCE', value: sequence },
            { type: 'INTERNAL_PROMOTION_COUNT', value: internalPromos }
        ] : []
    };
}

function detectInternalPromotion(cv, stats) {
    const roles = cv.roles || [];
    let promoCount = 0;
    
    // Check for same company in consecutive roles (reverse chronological)
    for (let i = 0; i < roles.length - 1; i++) {
        const currentComp = (roles[i].role_metadata?.company_canonical || '').toLowerCase();
        const prevComp = (roles[i+1].role_metadata?.company_canonical || '').toLowerCase();
        if (currentComp && currentComp === prevComp) {
            promoCount++;
        }
    }

    const isDetected = promoCount > 0;

    return {
        detected: isDetected,
        confidence: isDetected ? 1.0 : 0,
        reasoning: isDetected ? `Successfully achieved ${promoCount} internal vertical movements within employers.` : 'No internal promotion chains detected.',
        anchors: isDetected ? [
            { type: 'INTERNAL_PROMOTION_COUNT', value: promoCount }
        ] : []
    };
}

function detectPromotionVelocity(cv, stats) {
    const isDetected = (stats.growth_velocity || 0) > 0.5;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `High promotion velocity (${stats.growth_velocity}) relative to career length.` : 'Standard promotion velocity.',
        anchors: isDetected ? [
            { type: 'GROWTH_VELOCITY', value: stats.growth_velocity }
        ] : []
    };
}

function detectFastTrackGrowth(cv, stats) {
    const isDetected = (stats.max_seniority_jump || 0) >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Accelerated career growth with significant jumps in seniority.' : 'Standard career progression.',
        anchors: isDetected ? [
            { type: 'MAX_SENIORITY_JUMP', value: stats.max_seniority_jump }
        ] : []
    };
}

function detectAcceleratedGrowth(cv, stats) {
    const isDetected = (stats.growth_velocity || 0) > 1.8;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Exceptional career progression significantly exceeding peer benchmarks.' : 'Progression is at a standard pace.',
        anchors: isDetected ? [{ type: 'GROWTH_VELOCITY', value: stats.growth_velocity }] : []
    };
}

function detectStagnantTrajectory(cv, stats) {
    const sequence = stats.senioritySeq || [];
    const isDetected = sequence.length >= 3 && sequence.every(s => s === sequence[0]);
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Long-term role stability without vertical seniority advancement.' : 'Vertical movement detected.',
        anchors: isDetected ? [{ type: 'SENIORITY_SEQUENCE', value: sequence }] : []
    };
}

function detectEarlyCareerPeak(cv, stats) {
    const sequence = stats.senioritySeq || [];
    if (sequence.length < 4) return { detected: false };
    const firstHalf = sequence.slice(0, Math.floor(sequence.length / 2));
    const secondHalf = sequence.slice(Math.floor(sequence.length / 2));
    const isDetected = Math.max(...firstHalf) > Math.max(...secondHalf);
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'High seniority achieved early in career followed by lateral or downward moves.' : 'No early peak detected.',
        anchors: isDetected ? [{ type: 'SENIORITY_SEQUENCE', value: sequence }] : []
    };
}

function detectLateBloomer(cv, stats) {
    const sequence = stats.senioritySeq || [];
    if (sequence.length < 4) return { detected: false };
    const midPoint = Math.floor(sequence.length / 2);
    const isDetected = sequence[sequence.length - 1] > sequence[midPoint] && sequence[midPoint] <= sequence[0];
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Significant career acceleration in the latter half of professional history.' : 'Standard progression pattern.',
        anchors: isDetected ? [{ type: 'SENIORITY_SEQUENCE', value: sequence }] : []
    };
}

function detectMultiLevelJump(cv, stats) {
    const isDetected = (stats.max_seniority_jump || 0) >= 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Found a multi-level leap in seniority between consecutive roles.' : 'No multi-level jumps detected.',
        anchors: isDetected ? [{ type: 'MAX_SENIORITY_JUMP', value: stats.max_seniority_jump }] : []
    };
}

function detectInternalMobilitySpecialist(cv, stats) {
    const companies = (cv.roles || []).map(r => r.role_metadata?.company_canonical);
    const uniqueCompanies = new Set(companies.filter(c => c)).size;
    const isDetected = stats.role_count >= 4 && uniqueCompanies <= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Strong record of working through multiple roles and promotions within very few employers.' : 'Standard external mobility pattern.',
        anchors: isDetected ? [{ type: 'ROLE_COUNT', value: stats.role_count }, { type: 'COMPANY_COUNT', value: uniqueCompanies }] : []
    };
}

function detectPivotSuccess(cv, stats) {
    const isDetected = (cv.roles || []).some(r => (r.role_flags || []).includes('sector_pivot') && (r.role_flags || []).includes('internal_promotion'));
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Successfully transitioned sectors and achieved promotion in the new domain.' : 'No clear pivot-success pattern.',
        anchors: []
    };
}

function detectPivotStruggle(cv, stats) {
    const pivotIndex = (cv.roles || []).findIndex(r => (r.role_flags || []).includes('sector_pivot'));
    const isDetected = pivotIndex !== -1 && pivotIndex < cv.roles.length - 1 && (cv.roles[pivotIndex + 1].role_metadata?.end_date === 'Present' || false) === false && (stats.senioritySeq[pivotIndex + 1] < stats.senioritySeq[pivotIndex]);
    return {
        detected: isDetected,
        confidence: isDetected ? 0.75 : 0,
        reasoning: isDetected ? 'Sector pivot followed by a drop in seniority or short tenure.' : 'No pivot struggle detected.',
        anchors: []
    };
}

function detectConsistentHighVelocity(cv, stats) {
    const isDetected = stats.role_count >= 3 && stats.growth_velocity > 1.2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Maintained high promotion speed across at least 3 distinct roles.' : 'Velocity is not consistently high.',
        anchors: [{ type: 'GROWTH_VELOCITY', value: stats.growth_velocity }]
    };
}

function detectPlateauRisk(cv, stats) {
    const currentTenure = stats.avg_tenure_months || 0; // Simplified for current role
    const isDetected = currentTenure > 60 && stats.growth_velocity < 0.3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.70 : 0,
        reasoning: isDetected ? 'High tenure in current role with low recent seniority movement (potential stagnation).' : 'No plateau risk detected.',
        anchors: [{ type: 'CURRENT_TENURE', value: currentTenure }]
    };
}

module.exports = {
    detectLinearGrowth,
    detectInternalPromotion,
    detectPromotionVelocity,
    detectFastTrackGrowth,
    detectAcceleratedGrowth,
    detectStagnantTrajectory,
    detectEarlyCareerPeak,
    detectLateBloomer,
    detectMultiLevelJump,
    detectInternalMobilitySpecialist,
    detectPivotSuccess,
    detectPivotStruggle,
    detectConsistentHighVelocity,
    detectPlateauRisk
};
