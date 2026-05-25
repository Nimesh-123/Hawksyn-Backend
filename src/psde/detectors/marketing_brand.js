/**
 * Marketing & Brand Strategy Detectors
 */

function detectBrandArchitect(cv, stats) {
    const keywords = [
        'brand strategy', 'brand positioning', 'employer branding',
        'brand identity', 'brand equity', 'brand guidelines',
        'rebranding', 'brand narrative'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven expertise in designing and maintaining high-impact brand identities and strategies.' : 'No significant brand architect signals detected.',
        anchors: []
    };
}

function detectPerformanceMarketer(cv, stats) {
    const keywords = [
        'performance marketing', 'roas', 'cac', 'paid search',
        'sem', 'paid social', 'media buying', 'attribution modeling',
        'customer acquisition cost', 'return on ad spend'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Data-driven marketer with expertise in paid acquisition, ROAS optimization, and performance scaling.' : 'Limited evidence of performance marketing expertise.',
        anchors: []
    };
}

function detectContentStrategist(cv, stats) {
    const keywords = [
        'content strategy', 'storytelling', 'content marketing',
        'copywriting', 'creative direction', 'editorial calendar',
        'video production', 'social media strategy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Skilled storyteller capable of designing and executing complex content and creative strategies.' : 'No significant content strategist signals found.',
        anchors: []
    };
}

function detectGrowthMarketer(cv, stats) {
    const keywords = [
        'growth marketing', 'growth hacking', 'experimentation',
        'conversion rate optimization', 'cro', 'a/b testing',
        'funnel optimization', 'viral loops', 'retention marketing'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Proven expertise in growth hacking, experimentation, and full-funnel optimization.' : 'Limited evidence of growth marketing leadership.',
        anchors: []
    };
}

function detectPRCommunicationsLead(cv, stats) {
    const keywords = [
        'public relations', 'corporate communications', 'media relations',
        'crisis management', 'press release', 'thought leadership',
        'earned media', 'spokesperson'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.91 : 0,
        reasoning: isDetected ? 'Experienced communications leader with a track record in reputation management and media relations.' : 'No significant PR and communications signals detected.',
        anchors: []
    };
}

module.exports = {
    detectBrandArchitect,
    detectPerformanceMarketer,
    detectContentStrategist,
    detectGrowthMarketer,
    detectPRCommunicationsLead
};
