/**
 * Tenure & Stability Detectors
 */

function detectLongTenure(cv, stats) {
    const isDetected = stats.avg_tenure_months > 36;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `High average tenure of ${Math.round(stats.avg_tenure_months)} months per role.` : 'Tenure is below stability threshold.',
        anchors: isDetected ? [
            { type: 'AVG_TENURE_MONTHS', value: Math.round(stats.avg_tenure_months) }
        ] : []
    };
}

function detectJobHopper(cv, stats) {
    const corporateStints = [];
    let currentStint = null;

    // Group roles chronologically by company
    // CV roles are typically passed in (usually oldest to newest or newest to oldest). We assume `repairChronology` ordered them, but we sort to be safe.
    const sortedRoles = [...(cv.roles || [])].sort((a, b) => new Date(a.role_metadata.start_date) - new Date(b.role_metadata.start_date));

    sortedRoles.forEach(r => {
        if (!r.role_metadata || !r.role_metadata.start_date) return;
        
        const title = (r.role_metadata.title || '').toLowerCase();
        const isEntrepreneurial = /founder|co-founder|freelance|self-employed|entrepreneur/i.test(title);
        const isInternship = /intern|internship/i.test(title);

        if (isEntrepreneurial || isInternship) return; // Skip

        const company = (r.role_metadata.company_canonical || r.role_metadata.company || '').toLowerCase().trim();
        const start = new Date(r.role_metadata.start_date);
        const end = r.role_metadata.end_date === 'Present' || r.role_metadata.is_current ? new Date() : new Date(r.role_metadata.end_date);
        const months = (end - start) / (1000 * 60 * 60 * 24 * 30);

        if (currentStint && currentStint.company === company) {
            currentStint.months += months;
            currentStint.roles.push(r);
        } else {
            if (currentStint) corporateStints.push(currentStint);
            currentStint = { company, months, roles: [r] };
        }
    });
    if (currentStint) corporateStints.push(currentStint);

    const totalCorporateMonths = corporateStints.reduce((sum, s) => sum + s.months, 0);
    const avgTenure = corporateStints.length > 0 ? totalCorporateMonths / corporateStints.length : 0;
    
    // PIF Rule: 4 or more full-time jobs and averaged less than two years (24 months)
    const isDetected = corporateStints.length >= 4 && avgTenure < 24;

    const shortStints = corporateStints.filter(s => s.months < 24);

    const anchors = isDetected ? shortStints.map((s, i) => ({
        anchor_id: `HOPPER_ROLE_${i}`,
        type: 'SHORT_ROLE',
        value: `Employed at ${s.roles[0].role_metadata.company_canonical || s.roles[0].role_metadata.company} for < 24m`,
        section: 'experience',
        role_index: s.roles[0].role_index || (i + 1),
        company: s.roles[0].role_metadata.company_canonical || s.roles[0].role_metadata.company,
        role: s.roles.map(r => r.role_metadata.title).join(' / '),
        date: `${s.roles[0].role_metadata.start_date} - ${s.roles[s.roles.length - 1].role_metadata.end_date}`
    })) : [];

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `High mobility with average tenure of only ${Math.round(avgTenure)} months per corporate stint across ${corporateStints.length} employers.` : 'Stability looks acceptable.',
        anchors: anchors
    };
}

function detectCareerConsistency(cv, stats) {
    const sequence = stats.senioritySeq || [];
    const isDetected = sequence.length >= 3 && !sequence.some((s, i) => i > 0 && s < sequence[i-1]);
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
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
        confidence: isDetected ? 0.50 : 0,
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
        confidence: isDetected ? 0.50 : 0,
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
        confidence: isDetected ? 0.50 : 0,
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
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Found at least one "anchor" role with 6+ years of continuous tenure.' : 'No long-term anchor roles detected.',
        anchors: []
    };
}

function detectHighMobilitySpecialist(cv, stats) {
    const isDetected = stats.role_count >= 5 && stats.avg_tenure_months < 24 && stats.avg_tenure_months >= 18;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'high-level and consistent movement between employers every 18-24 months.' : 'Standard mobility pattern.',
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
        confidence: isDetected ? 0.50 : 0,
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
