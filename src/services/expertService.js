/**
 * Expert Scorer
 * Scores expert based on specialization match and current caseload.
 */
function scoreExpert(expert, redFlags, constraints) {
    let specializationScore = 0;
    const specializations = expert.specializations || [];

    for (const flag of redFlags) {
        if (flag.remediationCode && specializations.some(s =>
            flag.remediationCode.toLowerCase().includes(s.toLowerCase()) ||
            s.toLowerCase().includes('AI') && flag.severityBand === 'CRITICAL'
        )) {
            specializationScore += 30;
        }
    }

    for (const constraint of constraints) {
        if (constraint.band === 'CRITICAL' &&
            specializations.some(s => s.includes('AI') || s.includes('RISK'))) {
            specializationScore += 10;
        }
    }

    specializationScore = Math.min(specializationScore, 60);

    const maxLoad = expert.maxCaseload || 20;
    const currDailyLoad = expert.dailyCaseloadCount || 0;
    const loadScore = Math.round(((maxLoad - currDailyLoad) / maxLoad) * 40);

    return {
        totalScore: specializationScore + loadScore,
        specializationScore,
        loadScore,
        availableCapacity: maxLoad - currDailyLoad
    };
}

/**
 * Assignment Reason Builder
 */
function buildAssignmentReason(expert, redFlags, constraints, scoring) {
    const parts = [];

    if (scoring.specializationScore > 0) {
        const matchedFlags = redFlags
            .filter(f => f.severityBand === 'CRITICAL')
            .map(f => f.redFlagName);
        if (matchedFlags.length > 0) {
            parts.push(`Matched critical risk: ${matchedFlags.join(', ')}`);
        }
    }

    const criticalConstraints = constraints
        .filter(c => c.band === 'CRITICAL')
        .map(c => c.constraintName);
    if (criticalConstraints.length > 0) {
        parts.push(`Critical constraints: ${criticalConstraints.join(', ')}`);
    }

    parts.push(`Capacity available: ${scoring.availableCapacity} slots`);

    return parts.join('. ');
}

module.exports = {
    scoreExpert,
    buildAssignmentReason
};
