/**
 * Contextual & Organizational Environment Detectors
 */

function detectStartupNative(cv, stats) {
    const keywords = ['early-stage', 'series a', 'series b', 'founding team', 'equity', 'scaled from 0', 'fast-paced', 'scrappy'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2 || (cv.roles || []).some(r => (r.role_metadata?.company || '').toLowerCase().includes('startup'));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Deep experience in high-growth, early-stage, or venture-backed environments.' : 'No significant startup-native signals detected.',
        anchors: []
    };
}

function detectBigTechAlumni(cv, stats) {
    const bigTech = ['google', 'microsoft', 'amazon', 'apple', 'meta', 'facebook', 'netflix', 'uber', 'airbnb'];
    const companies = (cv.roles || []).map(r => (r.role_metadata?.company_canonical || r.role_metadata?.company || '').toLowerCase());
    
    const matches = bigTech.filter(bt => companies.some(c => c.includes(bt)));
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `Exposure to the high-scale engineering and operational standards of ${matches.join(', ')}.` : 'No Tier-1 Big Tech alumni signals found.',
        anchors: [{ type: 'BIG_TECH_COMPANIES', value: matches }]
    };
}

function detectMatureEnterpriseLeader(cv, stats) {
    const keywords = ['fortune 500', 'legacy', 'global conglomerate', 'steady-state', 'optimization', 'large-scale transformation'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2 && stats.avg_tenure_months > 36;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to manage and lead within large, established corporate structures.' : 'Career context is not primarily mature enterprise.',
        anchors: []
    };
}

function detectPublicSectorNavigator(cv, stats) {
    const keywords = ['government', 'ministry', 'public sector', 'policy', 'regulatory body', 'ias', 'niti aayog', 'psu'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experience working with or within government and public sector organizations.' : 'No significant public sector exposure detected.',
        anchors: []
    };
}

function detectFamilyOfficeProfessional(cv, stats) {
    const keywords = ['family office', 'promoter-led', 'private wealth', 'direct investment', 'wealth management for hni'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in managing assets or operations for high-net-worth family offices.' : 'No family office context detected.',
        anchors: []
    };
}

module.exports = {
    detectStartupNative,
    detectBigTechAlumni,
    detectMatureEnterpriseLeader,
    detectPublicSectorNavigator,
    detectFamilyOfficeProfessional
};
