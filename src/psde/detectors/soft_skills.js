/**
 * Soft Skills & Emotional Intelligence (EQ) Detectors
 */

function detectEmpatheticLeader(cv, stats) {
    const keywords = [
        'coaching', 'mentorship', 'people-first', 'culture-builder',
        'empathetic', 'servant leadership', 'talent development',
        'psychological safety', 'mentoring'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Demonstrates a people-first leadership style focused on mentorship and culture.' : 'No significant empathetic leadership signals detected.',
        anchors: []
    };
}

function detectConflictNavigator(cv, stats) {
    const keywords = [
        'conflict resolution', 'negotiation', 'stakeholder alignment',
        'mediation', 'dispute resolution', 'consensus building',
        'alignment', 'facilitation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.88 : 0,
        reasoning: isDetected ? 'Skilled in navigating complex stakeholder environments and resolving organizational conflicts.' : 'Limited evidence of conflict navigation skills.',
        anchors: []
    };
}

function detectResilientOperator(cv, stats) {
    const keywords = [
        'tenacity', 'resilience', 'high-pressure', 'stress management',
        'perseverance', 'overcame', 'turnaround', 'crisis management',
        'grit'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.91 : 0,
        reasoning: isDetected ? 'Proven ability to remain effective and drive results in high-pressure or volatile environments.' : 'No significant resilience signals found.',
        anchors: []
    };
}

function detectInfluentialCommunicator(cv, stats) {
    const keywords = [
        'storytelling', 'public speaking', 'executive presence',
        'persuasion', 'keynote', 'influencing', 'presentation skills',
        'written communication', 'articulated'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.87 : 0,
        reasoning: isDetected ? 'Possesses strong communication skills and the ability to influence executive-level stakeholders.' : 'Limited evidence of high-impact communication skills.',
        anchors: []
    };
}

function detectCollaborativeCatalyst(cv, stats) {
    const keywords = [
        'cross-functional', 'silo-breaker', 'collaboration', 'partnership',
        'inter-departmental', 'team player', 'joint venture', 'shared goals'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Acts as a catalyst for cross-departmental collaboration and breaking down organizational silos.' : 'No significant collaborative catalyst signals detected.',
        anchors: []
    };
}

module.exports = {
    detectEmpatheticLeader,
    detectConflictNavigator,
    detectResilientOperator,
    detectInfluentialCommunicator,
    detectCollaborativeCatalyst
};
