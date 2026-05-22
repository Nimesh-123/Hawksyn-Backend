/**
 * Project & Program Governance Detectors
 */

function detectPMOArchitect(cv, stats) {
    const keywords = [
        'pmo setup', 'governance framework', 'project management office',
        'standardization', 'methodology implementation', 'pmo lead',
        'process standardization', 'reporting framework', 'pmo charter'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven ability to design and implement robust project management offices and governance frameworks.' : 'No significant PMO architect signals detected.',
        anchors: []
    };
}

function detectAgileCoach(cv, stats) {
    const keywords = [
        'scrum', 'kanban', 'agile transformation', 'sprint planning',
        'retrospectives', 'safe framework', 'agile methodology', 'lean startup',
        'agile coaching'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Expertise in leading agile transformations and coaching teams on modern delivery methodologies.' : 'Limited evidence of agile coaching leadership.',
        anchors: []
    };
}

function detectDeliveryLead(cv, stats) {
    const keywords = [
        'program delivery', 'programme delivery', 'execution roadmap', 'timeline management',
        'milestone tracking', 'stakeholder alignment', 'delivery excellence',
        'project execution', 'cross-functional delivery', 'capex programme', 'capex program'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Proven track record of driving complex program delivery and milestone-based execution.' : 'No significant delivery lead signals found.',
        anchors: []
    };
}

function detectRiskComplianceLead(cv, stats) {
    const keywords = [
        'risk mitigation', 'compliance framework', 'audit readiness',
        'internal controls', 'regulatory adherence', 'operational risk',
        'compliance audit', 'governance risk compliance', 'grc',
        'internal audit', 'risk function', 'treasury function', 'credit rating'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.91 : 0,
        reasoning: isDetected ? 'Specialist in managing organizational risk, internal controls, and regulatory compliance.' : 'Limited evidence of risk or compliance leadership.',
        anchors: []
    };
}

function detectChangeManagementSpecialist(cv, stats) {
    const keywords = [
        'organizational change', 'adoption rate', 'stakeholder engagement',
        'training programs', 'impact assessment', 'change strategy',
        'business transformation', 'culture change', 'strategic restructuring'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Expertise in driving organizational change and ensuring high adoption rates for new initiatives.' : 'No significant change management signals detected.',
        anchors: []
    };
}

module.exports = {
    detectPMOArchitect,
    detectAgileCoach,
    detectDeliveryLead,
    detectRiskComplianceLead,
    detectChangeManagementSpecialist
};
