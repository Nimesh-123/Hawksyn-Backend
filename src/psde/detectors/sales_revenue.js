/**
 * Sales & Revenue Excellence Detectors
 */

function detectSalesHunter(cv, stats) {
    const keywords = [
        'new business', 'acquisition', 'prospecting', 'cold calling',
        'closing deals', 'quota attainment', 'outbound sales',
        'revenue generation', 'business development'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Demonstrated strong performance in new business acquisition and sales hunting activities.' : 'No significant sales hunter signals detected.',
        anchors: []
    };
}

function detectAccountFarmer(cv, stats) {
    const keywords = [
        'upsell', 'cross-sell', 'account expansion', 'relationship management',
        'customer retention', 'account growth', 'renewals', 'farming',
        'key account management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven expertise in growing existing accounts and driving long-term customer value.' : 'Limited evidence of account farming or expansion skills.',
        anchors: []
    };
}

function detectRevOpsArchitect(cv, stats) {
    const keywords = [
        'sales ops', 'revenue ops', 'revops', 'crm optimization',
        'sales enablement', 'territory planning', 'sales forecasting',
        'salesforce', 'hubspot', 'sales stack'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Strategic thinker capable of designing and optimizing revenue operations and sales technology stacks.' : 'No significant RevOps architect signals found.',
        anchors: []
    };
}

function detectChannelStrategyLead(cv, stats) {
    const keywords = [
        'channel partners', 'alliances', 'indirect sales', 'resellers',
        'distribution network', 'partner ecosystem', 'channel sales',
        'joint go-to-market'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Expertise in building and managing indirect sales channels and strategic partnerships.' : 'Limited evidence of channel strategy leadership.',
        anchors: []
    };
}

function detectHighTicketCloser(cv, stats) {
    const keywords = [
        'enterprise sales', 'large deal size', 'complex sales cycle',
        'million dollar', 'high-ticket', 'seven-figure', 'executive-level selling',
        'strategic accounts', 'billion dollar', 'eight-figure', 'deal size'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven track record of closing high-value, complex enterprise deals.' : 'No significant high-ticket closer signals found.',
        anchors: []
    };
}

module.exports = {
    detectSalesHunter,
    detectAccountFarmer,
    detectRevOpsArchitect,
    detectChannelStrategyLead,
    detectHighTicketCloser
};
