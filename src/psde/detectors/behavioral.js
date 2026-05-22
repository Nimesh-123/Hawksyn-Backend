/**
 * Behavioral & Cognitive Archetype Detectors
 */

function detectAnalyticalPowerhouse(cv, stats) {
    const keywords = ['analytics', 'data-driven', 'statistical', 'modelling', 'quantitative', 'insights', 'regression', 'hypothesis'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 4 || stats.metrics_density > 3.0;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Candidate relies heavily on quantitative analysis and data-driven decision making.' : 'No strong analytical behavioral signals found.',
        anchors: isDetected ? [{ type: 'ANALYTICAL_KEYWORDS', value: matches }] : []
    };
}

function detectCrisisManager(cv, stats) {
    const keywords = ['crisis', 'turnaround', 'recovery', 'restructuring', 'emergency', 'mitigated', 'urgent', 'salvaged'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.88 : 0,
        reasoning: isDetected ? 'Demonstrated ability to lead and stabilize organizations during high-pressure crisis periods.' : 'No significant crisis management signals detected.',
        anchors: []
    };
}

function detectVisionaryLeader(cv, stats) {
    const keywords = ['envisioned', 'future-state', 'pioneered', 'long-term roadmap', 'strategic vision', 'disruptive', 'industry-first'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2 && (stats.seniority_sequence || []).some(s => s >= 6); // Principal/Partner level
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Focuses on long-term industry shifts and pioneering new strategic directions.' : 'Limited evidence of visionary-level strategic planning.',
        anchors: []
    };
}

function detectMethodicalOperator(cv, stats) {
    const keywords = ['process', 'standardization', 'framework', 'sop', 'governance', 'compliance', 'structured', 'workflow'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 4;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.85 : 0,
        reasoning: isDetected ? 'Prioritizes structured processes, governance, and methodical execution.' : 'No strong methodical behavioral signals found.',
        anchors: []
    };
}

function detectHighAmbitionSignal(cv, stats) {
    // High velocity + prestige education + top-tier employers
    const isDetected = stats.growth_velocity > 1.2 && 
                       (cv.education || []).some(e => e.institution_tier === 'tier1') &&
                       (cv.roles || []).some(r => (r.role_flags || []).includes('tier1_employer'));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Candidate demonstrates a consistent pattern of high-prestige and high-velocity career moves.' : 'Standard career ambition profile.',
        anchors: []
    };
}

module.exports = {
    detectAnalyticalPowerhouse,
    detectCrisisManager,
    detectVisionaryLeader,
    detectMethodicalOperator,
    detectHighAmbitionSignal
};
