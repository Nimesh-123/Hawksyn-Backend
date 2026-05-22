/**
 * Impact & Leadership Detectors
 */

function detectQuantifiedImpact(cv, stats) {
    const isDetected = (stats.metrics_density || 0) > 1.5;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'High density of quantified business outcomes detected across roles.' : 'Outcome quantification is below threshold.',
        anchors: isDetected ? [
            { type: 'PCT_METRIC_PRESENT', value: Math.round(stats.metrics_density * 20) } // Mock 20 bullets avg
        ] : []
    };
}

function detectLeadershipDensity(cv, stats) {
    const isDetected = (stats.leadership_signal_count || 0) >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? `Found ${stats.leadership_signal_count} leadership signals including hiring, mentoring, or team growth.` : 'Limited explicit leadership signals found.',
        anchors: isDetected ? [
            { type: 'LEADERSHIP_SIGNAL_COUNT', value: stats.leadership_signal_count }
        ] : []
    };
}

function detectExecutiveOwnership(cv, stats) {
    const allAeus = (cv.roles || []).flatMap(r => r.base_aeus || []);
    const ownedCount = allAeus.filter(a => a.decision_level === 'owned').length;
    const highComplexityCount = allAeus.filter(a => a.complexity === 'high').length;
    
    const pctOwned = allAeus.length > 0 ? (ownedCount / allAeus.length) * 100 : 0;
    const isDetected = pctOwned > 60 && highComplexityCount >= 3;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'High percentage of owned decisions and high-complexity initiatives.' : 'Limited evidence of executive-level autonomy.',
        anchors: isDetected ? [
            { type: 'PCT_OWNED', value: Math.round(pctOwned) }
        ] : []
    };
}

function detectBudgetOwner(cv, stats) {
    const budgetAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('budget') || 
        (a.raw_text || '').toLowerCase().includes('managed spend')
    );
    const isDetected = budgetAeus.length >= 1;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Found evidence of direct budget management or financial oversight.' : 'No explicit mention of budget ownership.',
        anchors: [{ type: 'BUDGET_AEU_COUNT', value: budgetAeus.length }]
    };
}

function detectPandLResponsibility(cv, stats) {
    const plAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('p&l') || 
        (a.raw_text || '').toLowerCase().includes('profit and loss')
    );
    const isDetected = plAeus.length >= 1;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.98 : 0,
        reasoning: isDetected ? 'Found explicit P&L responsibility, a strong signal of business ownership.' : 'No P&L responsibility detected.',
        anchors: []
    };
}

function detectGlobalStakeholderMgmt(cv, stats) {
    const globalAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('global') || 
        (a.raw_text || '').toLowerCase().includes('international') ||
        (a.raw_text || '').toLowerCase().includes('across regions')
    );
    const isDetected = globalAeus.length >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? 'Experience managing stakeholders across multiple global regions or international markets.' : 'Stakeholder interaction appears local or regional.',
        anchors: [{ type: 'GLOBAL_AEU_COUNT', value: globalAeus.length }]
    };
}

function detectMentorshipProfile(cv, stats) {
    const mentorAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('mentor') || 
        (a.raw_text || '').toLowerCase().includes('coached') ||
        (a.raw_text || '').toLowerCase().includes('developed talent')
    );
    const isDetected = mentorAeus.length >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Candidate actively invests in developing others through formal or informal mentorship.' : 'Limited explicit mention of talent development.',
        anchors: []
    };
}

function detectTeamBuilder(cv, stats) {
    const buildAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('built a team') || 
        (a.raw_text || '').toLowerCase().includes('hired') ||
        (a.raw_text || '').toLowerCase().includes('grew the practice')
    );
    const isDetected = buildAeus.length >= 1;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Evidence of building teams or practices from scratch or during rapid growth phases.' : 'No explicit team-building signals found.',
        anchors: []
    };
}

function detectStakeholderNavigator(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        a.complexity === 'high' && a.decision_level === 'supported'
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.80 : 0,
        reasoning: isDetected ? 'Navigates complex high-stakes environments by supporting executive decision-makers.' : 'Standard stakeholder interaction pattern.',
        anchors: []
    };
}

function detectHighPerformanceCulture(cv, stats) {
    const metricCount = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => a.metrics?.value).length;
    const isDetected = metricCount >= 8;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Consistent focus on high-performance metrics and quantified success across their history.' : 'Standard focus on performance metrics.',
        anchors: [{ type: 'METRIC_DENSITY_TOTAL', value: metricCount }]
    };
}

function detectCrossFunctionalLeader(cv, stats) {
    const xFnCount = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => a.team_context?.cross_functional).length;
    const isDetected = xFnCount >= 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.88 : 0,
        reasoning: isDetected ? 'Strong record of leading initiatives across diverse functional departments.' : 'Standard functional focus.',
        anchors: [{ type: 'XFN_SIGNAL_COUNT', value: xFnCount }]
    };
}

function detectRevenueDriver(cv, stats) {
    const revAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('revenue') || 
        (a.raw_text || '').toLowerCase().includes('sales growth') ||
        (a.raw_text || '').toLowerCase().includes('top-line')
    );
    const isDetected = revAeus.length >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven track record of driving top-line revenue growth and commercial success.' : 'Limited evidence of direct revenue impact.',
        anchors: []
    };
}

function detectEfficiencyExpert(cv, stats) {
    const effAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('efficiency') || 
        (a.raw_text || '').toLowerCase().includes('cost reduction') ||
        (a.raw_text || '').toLowerCase().includes('optimis')
    );
    const isDetected = effAeus.length >= 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Specializes in driving operational efficiencies and bottom-line savings.' : 'Standard operational focus.',
        anchors: []
    };
}

module.exports = {
    detectQuantifiedImpact,
    detectLeadershipDensity,
    detectExecutiveOwnership,
    detectBudgetOwner,
    detectPandLResponsibility,
    detectGlobalStakeholderMgmt,
    detectMentorshipProfile,
    detectTeamBuilder,
    detectStakeholderNavigator,
    detectHighPerformanceCulture,
    detectCrossFunctionalLeader,
    detectRevenueDriver,
    detectEfficiencyExpert
};
