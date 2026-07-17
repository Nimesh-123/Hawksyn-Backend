/**
 * Product Mastery & Design Thinking Detectors
 */

function detectProductVisionary(cv, stats) {
    const keywords = [
        'product vision', 'strategic roadmap', 'long-term strategy',
        'strategic horizon', 'north star metric', 'product strategy',
        'market-shifting', 'future-proofing'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isSenior = (stats.seniority_sequence || []).some(s => s >= 6);
    const isDetected = matches.length >= 2 && isSenior;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated ability to define and lead a long-term high-level product vision.' : 'No significant product visionary signals detected.',
        anchors: []
    };
}

function detectDesignThinkingAdvocate(cv, stats) {
    const keywords = [
        'design thinking', 'user research', 'empathy mapping', 'personas',
        'usability testing', 'ux research', 'human-centered', 'prototyping',
        'customer journey'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Leads with empathy and user-centered design principles in product development.' : 'Limited evidence of design thinking advocacy.',
        anchors: []
    };
}

function detectRetentionSpecialist(cv, stats) {
    const keywords = [
        'retention', 'churn reduction', 'cohort analysis', 'amplitude',
        'mixpanel', 'pendo', 'funnel optimization', 'ltv', 'customer lifecycle',
        'activation rate'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Obsessed with product health metrics, specifically retention and user lifecycle optimization.' : 'No strong retention specialist signals found.',
        anchors: []
    };
}

function detectZeroToOneLead(cv, stats) {
    const keywords = [
        'mvp', '0 to 1', 'zero to one', 'product-market fit', 'pmf',
        'first-to-market', 'launched from scratch', 'initial launch',
        'early adopters'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record of taking products from zero to one and finding product-market fit.' : 'Limited evidence of zero-to-one product leadership.',
        anchors: []
    };
}

function detectVoCLead(cv, stats) {
    const keywords = [
        'nps', 'csat', 'voice of customer', 'voc', 'user feedback',
        'customer interviews', 'survey', 'customer obsession', 'user sentiment'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Maintains deep feedback loops with users to lead product improvements.' : 'No significant Voice-of-Customer leadership detected.',
        anchors: []
    };
}

module.exports = {
    detectProductVisionary,
    detectDesignThinkingAdvocate,
    detectRetentionSpecialist,
    detectZeroToOneLead,
    detectVoCLead
};
