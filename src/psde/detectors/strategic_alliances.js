/**
 * Strategic Alliances & Ecosystems Detectors
 */

function detectPartnershipArchitect(cv, stats) {
    const keywords = [
        'strategic partnership', 'alliance management', 'channel partner',
        'strategic alliance', 'joint go-to-market', 'gtm partnership',
        'co-selling', 'partner ecosystem'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven expertise in architecting and managing strategic business partnerships and alliances.' : 'No significant partnership signals detected.',
        anchors: []
    };
}

function detectEcosystemBuilder(cv, stats) {
    const keywords = [
        'ecosystem growth', 'marketplace strategy', 'platform ecosystem',
        'developer relations', 'community building', 'integrations strategy',
        'third-party developers', 'api ecosystem'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Experience in building and scaling complex business or technical ecosystems.' : 'Limited evidence of ecosystem building.',
        anchors: []
    };
}

function detectMAIntegrationExpert(cv, stats) {
    const keywords = [
        'post-merger integration', 'pmi', 'm&a integration',
        'merger synergy', 'acquisition integration', 'day 1 readiness',
        'consolidating entities'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const hasShortAcronyms = /\bpmi\b/i.test(text);
    const hasLongKeywords = keywords.some(k => k !== 'pmi' && text.includes(k));
    const isDetected = hasLongKeywords || hasShortAcronyms;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Specialist in the complex operational and cultural integration following M&A activity.' : 'No significant M&A integration signals found.',
        anchors: []
    };
}

function detectJointVentureStrategist(cv, stats) {
    const keywords = [
        'joint venture', 'jv management', 'jv governance',
        'cross-company collaboration', 'shared entity management',
        'formation of jv'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const hasShortAcronyms = /\bjv\b/i.test(text);
    const hasLongKeywords = keywords.some(k => !k.includes('jv') && text.includes(k));
    const isDetected = hasLongKeywords || hasShortAcronyms;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Expertise in navigating the governance and strategic alignment of joint ventures.' : 'Limited evidence of joint venture management.',
        anchors: []
    };
}

function detectFranchiseExpansionLead(cv, stats) {
    const keywords = [
        'franchise model', 'franchising strategy', 'master franchise',
        'franchisee management', 'franchise development', 'scaling via franchise'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Strong track record of scaling businesses through franchise and licensed expansion models.' : 'No significant franchise signals detected.',
        anchors: []
    };
}

module.exports = {
    detectPartnershipArchitect,
    detectEcosystemBuilder,
    detectMAIntegrationExpert,
    detectJointVentureStrategist,
    detectFranchiseExpansionLead
};
