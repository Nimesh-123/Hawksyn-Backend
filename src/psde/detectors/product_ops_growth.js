/**
 * Product Operations & Growth Detectors
 */

function detectProductOpsLead(cv, stats) {
    const keywords = [
        'product operations', 'product ops', 'product efficiency',
        'product tooling', 'product lifecycle management', 'internal product processes',
        'standardizing product'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven expertise in optimizing product team efficiency through standardized processes and tooling.' : 'No significant product ops signals detected.',
        anchors: []
    };
}

function detectPLGChampion(cv, stats) {
    const keywords = [
        'product-led growth', 'plg', 'product-led', 'viral loops',
        'referral loops', 'freemium strategy', 'self-serve onboarding',
        'in-product expansion'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const hasShortAcronyms = /\bplg\b/i.test(text);
    const hasLongKeywords = keywords.some(k => k !== 'plg' && text.includes(k));
    const isDetected = hasLongKeywords || hasShortAcronyms;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in driving growth through product-native levers and viral loops.' : 'Limited evidence of product-led growth leadership.',
        anchors: []
    };
}

function detectDesignSystemArchitect(cv, stats) {
    const keywords = [
        'design system', 'component library', 'atomic design',
        'design-at-scale', 'style guide', 'ux standards', 'ui kit'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Experience in building and maintaining scalable design systems and UI/UX standards.' : 'No significant design system architect signals found.',
        anchors: []
    };
}

function detectMonetizationStrategist(cv, stats) {
    const keywords = [
        'pricing strategy', 'monetization', 'packaging strategy',
        'subscription model', 'revenue architecture', 'sku rationalization',
        'pricing tiers'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven ability to architect product monetization and pricing strategies for revenue growth.' : 'Limited evidence of monetization strategy expertise.',
        anchors: []
    };
}

function detectABTestingSpecialist(cv, stats) {
    const keywords = [
        'a/b testing', 'experimentation', 'multivariate testing',
        'statistical significance', 'experiment roadmap', 'hypothesis testing',
        'split testing'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.91 : 0,
        reasoning: isDetected ? 'Highly data-driven approach using rigorous experimentation and split testing to drive product improvements.' : 'No significant experimentation signals detected.',
        anchors: []
    };
}

module.exports = {
    detectProductOpsLead,
    detectPLGChampion,
    detectDesignSystemArchitect,
    detectMonetizationStrategist,
    detectABTestingSpecialist
};
