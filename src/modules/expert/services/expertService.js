/**
 * Expert Scorer
 * Scores expert based on specialization match and current caseload.
 */
function scoreExpert(expert, redFlags, constraints, clientRole = '', caseDomain = '') {
    // 1. Role Match Score (30 points maximum)
    let roleScore = 0;
    const designation = (expert.designation || '').toLowerCase();
    const profileNote = (expert.profileNote || '').toLowerCase();
    const cRole = (clientRole || '').toLowerCase();
    
    if (cRole) {
        if (designation.includes(cRole) || cRole.includes(designation)) roleScore += 20;
        if (profileNote.includes(cRole)) roleScore += 10;
    }
    roleScore = Math.min(roleScore, 30);

    // 2. Area Match Score (30 points maximum)
    let areaScore = 0;
    const indExp = (expert.industryExpertise || []).map(s => s.toLowerCase());
    const specializations = (expert.specializations || []).map(s => s.toLowerCase());
    const cDomain = (caseDomain || '').toLowerCase();
    
    if (cDomain) {
        if (indExp.some(s => s.includes(cDomain))) areaScore += 15;
        if (specializations.some(s => s.includes(cDomain))) areaScore += 15;
    }
    
    // Add legacy red flag matches to area score
    for (const flag of redFlags) {
        if (flag.remediationCode && specializations.some(s => 
            flag.remediationCode.toLowerCase().includes(s) || 
            (s.includes('ai') && flag.severityBand === 'CRITICAL')
        )) {
            areaScore += 10;
        }
    }
    areaScore = Math.min(areaScore, 30);

    // 3. Rating Weight & Capacity (40 points maximum)
    const expYears = expert.experienceYears || 0;
    const rating = expert.ratingScore || 5.0; // Assume 5.0 if not rated
    const maxLoad = expert.maxCaseload || 20;
    const currDailyLoad = expert.dailyCaseloadCount || 0;
    
    const capacityScore = Math.round(((maxLoad - currDailyLoad) / maxLoad) * 20); // max 20
    const expScore = Math.min(expYears, 10); // max 10 for 10+ years
    const ratingScore = (rating / 5) * 10; // max 10

    let loadScore = capacityScore + expScore + ratingScore;
    loadScore = Math.min(loadScore, 40);

    return {
        totalScore: roleScore + areaScore + loadScore,
        roleScore,
        areaScore,
        loadScore,
        availableCapacity: maxLoad - currDailyLoad
    };
}

/**
 * Assignment Reason Builder
 */
function buildAssignmentReason(expert, redFlags, constraints, scoring) {
    const parts = [];

    if (scoring.roleScore > 10) parts.push(`Strong role match (${scoring.roleScore}/30)`);
    if (scoring.areaScore > 10) parts.push(`Strong domain match (${scoring.areaScore}/30)`);
    if (scoring.loadScore > 20) parts.push(`High capacity & rating (${Math.round(scoring.loadScore)}/40)`);

    const criticalConstraints = constraints
        .filter(c => c.band === 'CRITICAL')
        .map(c => c.constraintName);
    if (criticalConstraints.length > 0) {
        parts.push(`Critical constraints met: ${criticalConstraints.join(', ')}`);
    }

    parts.push(`Capacity available: ${scoring.availableCapacity} slots`);

    return parts.join('. ');
}

module.exports = {
    scoreExpert,
    buildAssignmentReason
};
