/**
 * HR & People Operations Detectors
 */

function detectTalentArchitect(cv, stats) {
    const keywords = [
        'talent acquisition', 'recruiting strategy', 'employer branding',
        'headhunting', 'hiring pipeline', 'talent sourcing', 'ats',
        'university relations'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in building talent acquisition strategies and scaling hiring pipelines.' : 'No significant talent architect signals detected.',
        anchors: []
    };
}

function detectCultureDesigner(cv, stats) {
    const keywords = [
        'culture building', 'employee engagement', 'organizational health',
        'company values', 'workplace culture', 'engagement surveys',
        'inclusion', 'belonging', 'internal communications'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to design and maintain high-performance organizational cultures.' : 'Limited evidence of culture design leadership.',
        anchors: []
    };
}

function detectTotalRewardsSpecialist(cv, stats) {
    const keywords = [
        'total rewards', 'compensation', 'benefits', 'equity strategy',
        'payroll', 'pension', 'stock options', 'esop', 'remuneration'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in total rewards, compensation structures, and equity-based benefit programs.' : 'No significant total rewards specialist signals found.',
        anchors: []
    };
}

function detectLearningDevelopmentLead(cv, stats) {
    const keywords = [
        'l&d', 'learning and development', 'upskilling', 'training programs',
        'instructional design', 'learning management system', 'lms',
        'talent development', 'e-learning'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Skilled in designing and implementing learning, development, and upskilling initiatives.' : 'Limited evidence of L&D leadership.',
        anchors: []
    };
}

function detectHROpsCompliance(cv, stats) {
    const keywords = [
        'hr operations', 'labor laws', 'employment compliance', 'hris',
        'workday', 'sap successfactors', 'hr policy', 'statutory compliance',
        'employee relations'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven experience in HR operations, systems, and employment law compliance.' : 'No significant HR Ops and compliance signals detected.',
        anchors: []
    };
}

module.exports = {
    detectTalentArchitect,
    detectCultureDesigner,
    detectTotalRewardsSpecialist,
    detectLearningDevelopmentLead,
    detectHROpsCompliance
};
