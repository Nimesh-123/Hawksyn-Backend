/**
 * Functional Specialization & Strategic Depth Detectors
 */

function detectPLGExpert(cv, stats) {
    const keywords = ['plg', 'product-led', 'freemium', 'self-serve', 'viral loop', 'user acquisition cost', 'cac', 'ltv', 'churn reduction', 'product-driven growth'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in Product-Led Growth (PLG) strategies and unit economics.' : 'No significant PLG signals detected.',
        anchors: []
    };
}

function detectCapitalAllocationExpert(cv, stats) {
    const keywords = ['capital allocation', 'investment committee', 'portfolio management', 'm&a strategy', 'valuation', 'roi', 'irr', 'funding round', 'equity', 'fundraise'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isSenior = (stats.seniority_sequence || []).some(s => s >= 6); 
    const isDetected = matches.length >= 2 && isSenior;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Involved in high-level capital allocation, investment strategy, or portfolio oversight.' : 'Limited evidence of capital allocation responsibility.',
        anchors: []
    };
}

function detectProfitabilityDriver(cv, stats) {
    const keywords = [
        'ebitda', 'profitability', 'bottom-line', 'margin expansion', 
        'cost efficiency', 'operating leverage', 'break-even',
        'cost transformation', 'savings', 'cost reduction', 'opex reduction',
        'p&l improvement'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record of leading bottom-line profitability and large-scale cost transformations.' : 'No strong profitability-driver signals found.',
        anchors: []
    };
}

function detectCategoryCreator(cv, stats) {
    const keywords = ['category creator', 'new market', 'blue ocean', 'evangelized', 'first-to-market', 'defined the space', 'pioneered'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experience in defining and building entirely new market categories.' : 'No category creation signals detected.',
        anchors: []
    };
}

function detectAgileTransformationLead(cv, stats) {
    const keywords = ['agile transformation', 'scrum', 'kanban', 'safe', 'okr', 'sprint', 'velocity', 'ceremonies', 'squads', 'agile delivery'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Led organizational shifts toward agile methodologies and modern delivery frameworks.' : 'No significant agile transformation signals detected.',
        anchors: []
    };
}

function detectGTMArchitect(cv, stats) {
    // Robust text scanning including flattened AEUs
    const allText = [
        JSON.stringify(cv.header || {}),
        (cv.roles || []).map(r => JSON.stringify(r.role_metadata)).join(' '),
        (cv.base_aeus || []).map(a => a.raw_text + ' ' + a.object).join(' '),
        (cv.skills?.skills || []).map(s => s.skill_name).join(' ')
    ].join(' ').toLowerCase();

    const coreKeywords = ['go-to-market', 'gtm', 'market entry', 'commercial roadmap', 'market-entry'];
    const executionKeywords = ['product launch', 'scaling sales', 'revenue architecture', 'distribution', 'pricing strategy', 'sales motion'];
    
    const coreMatches = coreKeywords.filter(k => allText.includes(k));
    const executionMatches = executionKeywords.filter(k => allText.includes(k));
    
    // Low threshold because GTM is a high-value strategy signal
    const isDetected = coreMatches.length >= 1 || executionMatches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in designing and executing go-to-market (GTM) strategies.' : 'Limited GTM architecture signals found.',
        anchors: []
    };
}

module.exports = {
    detectPLGExpert,
    detectCapitalAllocationExpert,
    detectProfitabilityDriver,
    detectCategoryCreator,
    detectAgileTransformationLead,
    detectGTMArchitect
};
