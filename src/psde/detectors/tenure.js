/**
 * Tenure & Stability Detectors
 */

function detectLongTenure(cv, stats) {
    const isDetected = stats.avg_tenure_months > 36;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? `High average tenure of ${Math.round(stats.avg_tenure_months)} months per role.` : 'Tenure is below stability threshold.',
        anchors: isDetected ? [
            { type: 'AVG_TENURE_MONTHS', value: Math.round(stats.avg_tenure_months) }
        ] : []
    };
}

function detectJobHopper(cv, stats) {
    const avgTenure = stats.avg_tenure_months || 0;
    const isDetected = avgTenure < 18 && stats.role_count >= 3;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? `High mobility with average tenure of only ${Math.round(avgTenure)} months per role.` : 'Stability looks acceptable.',
        anchors: isDetected ? [
            { type: 'ROLE_COUNT', value: stats.role_count },
            { type: 'AVG_TENURE_MONTHS', value: Math.round(avgTenure) }
        ] : []
    };
}

function detectCareerConsistency(cv, stats) {
    const sequence = stats.senioritySeq || [];
    const isDetected = sequence.length >= 3 && !sequence.some((s, i) => i > 0 && s < sequence[i-1]);
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Uninterrupted upward or lateral career consistency.' : 'Career history shows fluctuations.',
        anchors: isDetected ? [
            { type: 'SENIORITY_SEQUENCE', value: sequence }
        ] : []
    };
}

function detectSectorLoyalist(cv, stats) {
    const sectors = new Set((cv.roles || []).flatMap(r => r.role_flags || []).filter(f => f.startsWith('sector_')));
    const isDetected = sectors.size === 1 && stats.role_count >= 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Candidate demonstrates deep commitment to a single industry vertical across their entire career.' : 'Career spans multiple industry sectors.',
        anchors: [{ type: 'SECTOR_COUNT', value: sectors.size }]
    };
}

function detectSerialContractor(cv, stats) {
    const contractRoles = (cv.roles || []).filter(r => r.role_metadata?.employment_type === 'contract');
    const isDetected = contractRoles.length >= 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 1.0 : 0,
        reasoning: isDetected ? 'Professional history is primarily comprised of short-term contract engagements.' : 'Standard full-time employment pattern.',
        anchors: [{ type: 'CONTRACT_ROLE_COUNT', value: contractRoles.length }]
    };
}

function detectBoomerangEmployee(cv, stats) {
    const companies = (cv.roles || []).map(r => (r.role_metadata?.company_canonical || '').toLowerCase()).filter(c => c);
    
    // Collapse consecutive duplicates (e.g., [BCG, BCG, Microsoft] -> [BCG, Microsoft])
    const collapsed = [];
    for (let i = 0; i < companies.length; i++) {
        if (i === 0 || companies[i] !== companies[i-1]) {
            collapsed.push(companies[i]);
        }
    }

    // A boomerang is when the collapsed list has duplicates
    const uniqueCollapsed = new Set(collapsed);
    const isDetected = uniqueCollapsed.size < collapsed.length;

    return {
        detected: isDetected,
        confidence: isDetected ? 1.0 : 0,
        reasoning: isDetected ? 'Successfully returned to a previous employer after gaining experience at a different organization.' : 'No boomerang employment (leaving and returning) detected.',
        anchors: []
    };
}

function detectShortTenureRisk(cv, stats) {
    const recentRoles = (cv.roles || []).slice(-2);
    const isDetected = recentRoles.length === 2 && recentRoles.every(r => {
        const start = new Date(r.role_metadata.start_date);
        const end = r.role_metadata.end_date === 'Present' ? new Date() : new Date(r.role_metadata.end_date);
        return (end - start) / (1000 * 60 * 60 * 24 * 30) < 12;
    });
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Recent career history shows multiple exits within the first 12 months.' : 'No recent short-tenure pattern.',
        anchors: []
    };
}

function detectFoundationBuilder(cv, stats) {
    const firstRole = (cv.roles || [])[0];
    if (!firstRole) return { detected: false };
    const start = new Date(firstRole.role_metadata.start_date);
    const end = firstRole.role_metadata.end_date === 'Present' ? new Date() : new Date(firstRole.role_metadata.end_date);
    const tenure = (end - start) / (1000 * 60 * 60 * 24 * 30);
    const isDetected = tenure > 48;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? 'Invested significant time (4+ years) in their inaugural career role.' : 'Standard early-career tenure.',
        anchors: [{ type: 'INITIAL_ROLE_TENURE', value: Math.round(tenure) }]
    };
}

function detectAnchorTenure(cv, stats) {
    const isDetected = (cv.roles || []).some(r => {
        const start = new Date(r.role_metadata.start_date);
        const end = r.role_metadata.end_date === 'Present' ? new Date() : new Date(r.role_metadata.end_date);
        return (end - start) / (1000 * 60 * 60 * 24 * 30) > 72;
    });
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Found at least one "anchor" role with 6+ years of continuous tenure.' : 'No long-term anchor roles detected.',
        anchors: []
    };
}

function detectHighMobilitySpecialist(cv, stats) {
    const isDetected = stats.role_count >= 5 && stats.avg_tenure_months < 24 && stats.avg_tenure_months >= 18;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.80 : 0,
        reasoning: isDetected ? 'Strategic and consistent movement between employers every 18-24 months.' : 'Standard mobility pattern.',
        anchors: [{ type: 'AVG_TENURE_MONTHS', value: stats.avg_tenure_months }]
    };
}

function detectEarlyExitPattern(cv, stats) {
    const earlyExits = (cv.roles || []).filter(r => {
        if (r.role_metadata.is_current) return false;
        const start = new Date(r.role_metadata.start_date);
        const end = new Date(r.role_metadata.end_date);
        return (end - start) / (1000 * 60 * 60 * 24 * 30) < 6;
    });
    const isDetected = earlyExits.length >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? `History contains ${earlyExits.length} exits within the first 6 months of employment.` : 'No recurring early-exit pattern.',
        anchors: [{ type: 'EARLY_EXIT_COUNT', value: earlyExits.length }]
    };
}

module.exports = {
    detectLongTenure,
    detectJobHopper,
    detectCareerConsistency,
    detectSectorLoyalist,
    detectSerialContractor,
    detectBoomerangEmployee,
    detectShortTenureRisk,
    detectFoundationBuilder,
    detectAnchorTenure,
    detectHighMobilitySpecialist,
    detectEarlyExitPattern
};
