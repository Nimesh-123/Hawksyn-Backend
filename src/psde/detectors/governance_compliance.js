/**
 * Enterprise Governance & Compliance Detectors
 */

function detectGovernanceGuardian(cv, stats) {
    const keywords = [
        'corporate governance', 'board relations', 'board of directors',
        'governance framework', 'stakeholder oversight', 'secretarial',
        'board meeting', 'directors report'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isSenior = (stats.seniority_sequence || []).some(s => s >= 7); 
    const isDetected = matches.length >= 2 && isSenior;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated experience in corporate governance and high-level board relations.' : 'No significant governance guardian signals detected.',
        anchors: []
    };
}

function detectRegulatoryNavigator(cv, stats) {
    const keywords = [
        'regulatory compliance', 'sec', 'rbi', 'fca', 'gdpr', 'hipaa',
        'complied with', 'regulatory reporting', 'license application',
        'statutory'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to manage complex regulatory landscapes and ensure statutory compliance.' : 'Limited evidence of regulatory navigation skills.',
        anchors: []
    };
}

function detectEthicsIntegrityLead(cv, stats) {
    const keywords = [
        'ethics', 'integrity', 'code of conduct', 'whistleblower',
        'anti-corruption', 'aml', 'kyc', 'transparency', 'ethical'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Strong focus on organizational ethics, integrity, and anti-corruption frameworks.' : 'No significant ethics and integrity signals detected.',
        anchors: []
    };
}

function detectPolicyArchitect(cv, stats) {
    const keywords = [
        'policy formulation', 'sop', 'standard operating procedures',
        'framework design', 'policy manual', 'procedural guidelines',
        'policy implementation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Skilled in designing and implementing enterprise-wide policies and standard operating procedures.' : 'Limited evidence of policy architecture skills.',
        anchors: []
    };
}

function detectAuditReadinessExpert(cv, stats) {
    const keywords = [
        'external audit', 'internal audit', 'sox', 'compliance audit',
        'audit readiness', 'audit findings', 'remediation', 'statutory audit',
        'iso audit'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in maintaining audit-ready operations and managing complex internal/external audit cycles.' : 'No significant audit readiness signals found.',
        anchors: []
    };
}

module.exports = {
    detectGovernanceGuardian,
    detectRegulatoryNavigator,
    detectEthicsIntegrityLead,
    detectPolicyArchitect,
    detectAuditReadinessExpert
};
