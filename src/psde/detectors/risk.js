/**
 * Risk & Volatility Detectors
 */

function detectCareerVolatility(cv, stats) {
    const sequence = stats.senioritySeq || [];
    let drops = 0;
    for (let i = 1; i < sequence.length; i++) {
        if (sequence[i] < sequence[i-1]) drops++;
    }
    
    const isDetected = drops >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Career trajectory shows seniority regression or downward movement.' : 'No significant seniority regression detected.',
        anchors: isDetected ? [
            { type: 'SENIORITY_DROP_COUNT', value: drops }
        ] : []
    };
}

function detectOverlappingRoles(cv, stats) {
    const isDetected = stats.overlapFlag === true;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.98 : 0,
        reasoning: isDetected ? 'Found role dates that overlap by more than 2 months (potential dual employment).' : 'No significant role overlaps detected.',
        anchors: isDetected ? [
            { type: 'OVERLAP_DETECTED', value: true }
        ] : []
    };
}

function detectCareerGaps(cv, stats) {
    const gaps = stats.gapPeriods || [];
    const education = cv.education || [];

    // Check each gap against education entries
    const unexplainedGaps = gaps.filter(gap => {
        if (gap.gap_months <= 6) return false;

        const gapStart = getGapStartDate(cv.roles, gap.after_role);
        const gapEnd = getGapEndDate(cv.roles, gap.before_role);

        if (!gapStart || !gapEnd) return true;

        // Check if any education overlaps this gap period
        const hasEducationDuringGap = education.some(edu => {
            if (!edu.year_completed) return false;
            const eduYear = parseInt(edu.year_completed);
            
            // Extract years from YYYY-MM
            const gapStartYear = parseInt(gapStart.split('-')[0]);
            const gapEndYear = parseInt(gapEnd.split('-')[0]);
            
            return eduYear >= gapStartYear && eduYear <= gapEndYear;
        });

        return !hasEducationDuringGap;
    });

    const isDetected = unexplainedGaps.length > 0;
    const maxGap = unexplainedGaps.length > 0 ? Math.max(...unexplainedGaps.map(g => g.gap_months)) : 0;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? `Found ${unexplainedGaps.length} unexplained career gaps exceeding 6 months.` : 'No significant unexplained career gaps detected.',
        anchors: isDetected ? [
            { type: 'GAP_COUNT', value: unexplainedGaps.length },
            { type: 'MAX_GAP_MONTHS', value: maxGap }
        ] : []
    };
}

function getGapStartDate(roles, roleIndex) {
    const role = (roles || []).find(r => r.role_index === roleIndex);
    return role?.role_metadata?.end_date || null;
}

function getGapEndDate(roles, roleIndex) {
    const role = (roles || []).find(r => r.role_index === roleIndex);
    return role?.role_metadata?.start_date || null;
}

function detectResponsibilityDeflation(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.flags || []).includes('vague_action') && a.complexity === 'low' && a.decision_level === 'supported'
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.75 : 0,
        reasoning: isDetected ? 'Pattern of low-complexity, vaguely defined responsibilities despite senior job titles.' : 'No significant responsibility deflation detected.',
        anchors: []
    };
}

function detectTitleInflation(cv, stats) {
    const isDetected = (cv.roles || []).some(r => 
        (r.role_metadata?.title || '').toLowerCase().includes('director') || 
        (r.role_metadata?.title || '').toLowerCase().includes('vp') ||
        (r.role_metadata?.title || '').toLowerCase().includes('head')
    ) && stats.total_experience_years < 7;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? 'High-seniority job titles achieved with significantly less than 7 years of total experience.' : 'Title-to-experience ratio appears standard.',
        anchors: [{ type: 'TOTAL_EXP_YEARS', value: stats.total_experience_years }]
    };
}

function detectFrequentSectorSwitching(cv, stats) {
    const companies = (cv.roles || []).map(r => (r.role_metadata?.company || '').toLowerCase());
    const sectors = new Set();
    companies.forEach(c => {
        if (c.includes('bank')) sectors.add('banking');
        else if (c.includes('pharma')) sectors.add('pharma');
        else if (c.includes('consult')) sectors.add('consulting');
        else sectors.add('other');
    });
    const isDetected = sectors.size >= 3 && stats.role_count <= 4;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.80 : 0,
        reasoning: isDetected ? 'Frequent changes in industry sectors, potentially indicating a lack of deep domain specialization.' : 'Sector movement is standard or focused.',
        anchors: [{ type: 'SECTOR_COUNT', value: sectors.size }]
    };
}

function detectDomainContamination(cv, stats) {
    const isDetected = (cv.extraction_meta?.validation_meta?.total_violations || 0) > 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.70 : 0,
        reasoning: isDetected ? 'Found evidence of cross-domain terminology contamination in role descriptions.' : 'No significant domain contamination found.',
        anchors: []
    };
}

function detectUnstableGrowthPattern(cv, stats) {
    const sequence = stats.senioritySeq || [];
    let fluctuations = 0;
    for (let i = 1; i < sequence.length; i++) {
        if (sequence[i] !== sequence[i-1]) fluctuations++;
    }
    const isDetected = fluctuations > 3 && stats.role_count <= 5;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.75 : 0,
        reasoning: isDetected ? 'Career trajectory shows frequent shifts in seniority levels within a short timeframe.' : 'Growth pattern appears stable or linear.',
        anchors: [{ type: 'FLUCTUATION_COUNT', value: fluctuations }]
    };
}

module.exports = {
    detectCareerVolatility,
    detectOverlappingRoles,
    detectCareerGaps,
    detectResponsibilityDeflation,
    detectTitleInflation,
    detectFrequentSectorSwitching,
    detectDomainContamination,
    detectUnstableGrowthPattern
};
