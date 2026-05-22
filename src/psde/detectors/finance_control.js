/**
 * Finance & Commercial Control Detectors
 */

function detectFPAStrategist(cv, stats) {
    const keywords = [
        'fp&a', 'financial planning', 'forecasting', 'budgeting',
        'variance analysis', 'financial modeling', 'strategic planning',
        'p&l management', 'profit and loss'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Expertise in financial planning, analysis, and strategic forecasting.' : 'No significant FP&A strategist signals detected.',
        anchors: []
    };
}

function detectCommercialController(cv, stats) {
    const keywords = [
        'commercial control', 'deal desk', 'pricing strategy', 'margin improvement',
        'sales finance', 'profitability analysis', 'commercial finance',
        'contract negotiation', 'revenue optimization'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Proven track record in commercial finance, deal-making, and margin optimization.' : 'Limited evidence of commercial control expertise.',
        anchors: []
    };
}

function detectTreasuryTaxLead(cv, stats) {
    const keywords = [
        'treasury', 'tax planning', 'cash management', 'hedging',
        'transfer pricing', 'liquidity', 'corporate finance',
        'international tax', 'forex management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Specialized expertise in treasury operations, cash management, and tax strategy.' : 'No significant treasury and tax signals found.',
        anchors: []
    };
}

function detectMADealLead(cv, stats) {
    const keywords = [
        'm&a', 'due diligence', 'valuation', 'deal execution',
        'buy-side', 'sell-side', 'mergers and acquisitions',
        'transaction advisory', 'acquisition of', 'merger integration',
        'capital allocation', 'deal lifecycle', 'transaction structuring'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Proven expertise in managing the end-to-end M&A deal lifecycle, from valuation to execution.' : 'Limited evidence of M&A deal leadership.',
        anchors: []
    };
}

function detectInvestorRelationsExpert(cv, stats) {
    const keywords = [
        'investor relations', 'fundraising', 'equity story', 'shareholder management',
        'analyst calls', 'investor decks', 'ipo readiness', 'capital markets',
        'investor communication', 'credit rating', 'qip raise', 'fundraise'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Strong experience in managing investor relations, fundraising, and capital market communication.' : 'No significant investor relations signals detected.',
        anchors: []
    };
}

module.exports = {
    detectFPAStrategist,
    detectCommercialController,
    detectTreasuryTaxLead,
    detectMADealLead,
    detectInvestorRelationsExpert
};
