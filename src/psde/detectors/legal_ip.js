/**
 * Legal & Intellectual Property Detectors
 */

function detectGeneralCounsel(cv, stats) {
    const keywords = [
        'general counsel', 'legal strategy', 'board advisor',
        'corporate governance', 'legal department head', 'chief legal officer',
        'legal risk management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven expertise as a high-level legal advisor and head of legal operations.' : 'No significant general counsel signals detected.',
        anchors: []
    };
}

function detectIPStrategist(cv, stats) {
    const keywords = [
        'intellectual property', 'patents', 'trademarks', 'ip portfolio',
        'licensing agreement', 'patent filing', 'ip strategy',
        'copyright management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in intellectual property strategy and portfolio management.' : 'Limited evidence of IP high-level leadership.',
        anchors: []
    };
}

function detectLitigationSpecialist(cv, stats) {
    const keywords = [
        'litigation', 'dispute resolution', 'arbitration', 'courtroom',
        'legal defense', 'trial management', 'settlement negotiation',
        'commercial disputes'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Extensive experience in managing complex litigation, disputes, and arbitration.' : 'No significant litigation specialist signals found.',
        anchors: []
    };
}

function detectPrivacyDataEthicsLead(cv, stats) {
    const keywords = [
        'gdpr', 'data privacy', 'data protection', 'privacy by design',
        'hipaa', 'ccpa', 'data ethics', 'privacy officer',
        'information governance'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven expertise in data privacy, ethical data management, and global regulatory compliance.' : 'Limited evidence of privacy and data ethics leadership.',
        anchors: []
    };
}

function detectContractManagementExpert(cv, stats) {
    const keywords = [
        'contract management', 'legal operations', 'commercial law', 'clm',
        'contract lifecycle', 'legal ops', 'procurement legal',
        'service level agreements'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in managing contract lifecycles and optimizing legal operations.' : 'No significant contract management signals detected.',
        anchors: []
    };
}

module.exports = {
    detectGeneralCounsel,
    detectIPStrategist,
    detectLitigationSpecialist,
    detectPrivacyDataEthicsLead,
    detectContractManagementExpert
};
