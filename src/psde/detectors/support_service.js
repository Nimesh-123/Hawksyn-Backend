/**
 * Customer Support & Service Excellence Detectors
 */

function detectSupportArchitect(cv, stats) {
    const keywords = [
        'support operations', 'ticketing systems', 'zendesk', 'service cloud',
        'freshdesk', 'support strategy', 'help desk management', 'service desk'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven expertise in designing and managing large-scale customer support operations and systems.' : 'No significant support architect signals detected.',
        anchors: []
    };
}

function detectSLAChampion(cv, stats) {
    const keywords = [
        'sla', 'service level agreement', 'response time', 'resolution rate',
        'csat', 'customer satisfaction score', 'kpi tracking', 'first response time'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Focused on operational efficiency, consistently meeting or exceeding complex service level agreements.' : 'Limited evidence of SLA-driven leadership.',
        anchors: []
    };
}

function detectCommunityManager(cv, stats) {
    const keywords = [
        'community management', 'forum moderation', 'discord', 'user community',
        'social support', 'community engagement', 'brand community', 'community growth',
        'slack community'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in building and managing large user communities and social support environments.' : 'No significant community manager signals found.',
        anchors: []
    };
}

function detectTechnicalSupportLead(cv, stats) {
    const keywords = [
        'technical support', 'l2 support', 'l3 support', 'escalation management',
        'troubleshooting', 'incident management', 'root cause analysis', 'technical desk'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to lead technical support teams and manage complex escalations and incidents.' : 'Limited evidence of technical support leadership.',
        anchors: []
    };
}

function detectSelfServiceExpert(cv, stats) {
    const keywords = [
        'knowledge base', 'self-service', 'help center', 'support automation',
        'deflection rate', 'chatbot', 'faq management', 'technical documentation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specialist in leading support efficiency through self-service content and automated deflection strategies.' : 'No significant self-service signals detected.',
        anchors: []
    };
}

module.exports = {
    detectSupportArchitect,
    detectSLAChampion,
    detectCommunityManager,
    detectTechnicalSupportLead,
    detectSelfServiceExpert
};
