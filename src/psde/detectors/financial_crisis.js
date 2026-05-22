/**
 * Financial Literacy & Crisis DNA Detectors
 */

function detectCrisisDNA(cv, stats) {
    const keywords = [
        'restructuring', 'turnaround', 'bailout', 'bankruptcy', 
        'distressed', 'liquidity crisis', 'debt restructuring',
        'chapter 11', 'insolvency', 'recovery plan', 'workout'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Demonstrated resilience and leadership in distressed or high-stakes crisis environments.' : 'No significant crisis DNA signals detected.',
        anchors: []
    };
}

function detectFinancialLiteracyExpert(cv, stats) {
    const keywords = [
        'p&l management', 'profit and loss', 'budgeting', 'forecasting', 
        'financial modeling', 'audit oversight', 'variance analysis',
        'cash flow management', 'working capital', 'financial planning'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.91 : 0,
        reasoning: isDetected ? 'Possesses deep financial fluency and P&L accountability despite potentially non-finance titles.' : 'Limited evidence of deep financial literacy.',
        anchors: []
    };
}

function detectHypergrowthVeteran(cv, stats) {
    const keywords = [
        '10x', 'hypergrowth', 'exponential', 'rapid scale', 'hockey stick',
        'scaling from 0 to', 'scaling from 1 to', 'explosive growth'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Navigated the unique operational challenges of extreme hypergrowth environments.' : 'No hypergrowth signals found.',
        anchors: []
    };
}

function detectLeanSixSigmaPractitioner(cv, stats) {
    const keywords = [
        'six sigma', 'lean', 'kaizen', 'black belt', 'green belt', 
        'yellow belt', 'dmaic', 'continuous improvement', 'waste reduction',
        'process excellence'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.88 : 0,
        reasoning: isDetected ? 'Formally trained or experienced in Lean Six Sigma methodologies for operational excellence.' : 'No Lean Six Sigma signals detected.',
        anchors: []
    };
}

function detectCapitalEfficiencyLead(cv, stats) {
    const keywords = [
        'capex', 'unit economics', 'roic', 'wacc', 'capital expenditure',
        'asset utilization', 'operating efficiency', 'capital intensity',
        'resource allocation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.89 : 0,
        reasoning: isDetected ? 'Focuses on capital efficiency and optimizing the return on invested capital.' : 'Limited capital efficiency signals found.',
        anchors: []
    };
}

module.exports = {
    detectCrisisDNA,
    detectFinancialLiteracyExpert,
    detectHypergrowthVeteran,
    detectLeanSixSigmaPractitioner,
    detectCapitalEfficiencyLead
};
