/**
 * Engineering Leadership Detectors (Batch 25)
 */

function detectCTOVisionary(cv, stats) {
    const keywords = [
        'cto', 'chief technology officer', 'technical strategy', 'technology roadmap',
        'r&d leadership', 'board-level tech', 'technical advisory', 'long-term technology vision'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const isCTO = /\bcto\b/i.test(text) || text.includes('chief technology officer');
    const hasStrategy = keywords.slice(2).some(k => text.includes(k));
    const isDetected = isCTO && hasStrategy;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Demonstrated leadership in defining long-term technology strategy and architectural vision at the C-suite level.' : 'No significant CTO strategy signals detected.',
        anchors: []
    };
}

function detectVPEngineering(cv, stats) {
    const keywords = [
        'vp of engineering', 'vp engineering', 'head of engineering', 'engineering culture',
        'scaling engineering teams', 'delivery velocity', 'engineering operational excellence',
        'managing managers'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Proven track record of scaling engineering organizations, improving delivery velocity, and managing multi-tiered technical teams.' : 'Limited evidence of VP-level engineering management.',
        anchors: []
    };
}

function detectTechnicalCoFounder(cv, stats) {
    const keywords = [
        'co-founder', 'founding cto', 'founding engineer', 'early-stage equity',
        'built from scratch', 'investor relations', 'fundraising for tech', '0-to-1 tech'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const isFounder = /\bco-founder\b/i.test(text) || text.includes('founding');
    const isTech = stats.primaryDomain === 'tech' || text.includes('engineer') || text.includes('cto');
    const isDetected = isFounder && isTech;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Successfully led the technical birth of a product as a co-founder, balancing early-stage builds with business growth.' : 'No technical co-founder signals found.',
        anchors: []
    };
}

function detectHeadOfInfrastructure(cv, stats) {
    const keywords = [
        'head of infrastructure', 'director of infrastructure', 'platform engineering leadership',
        'reliability at scale', 'cloud budget optimization', 'sre leadership', 'devops culture',
        'infrastructure strategy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Specializes in the leadership of complex platform infrastructure, ensuring high availability and cost-efficient scaling.' : 'No significant infrastructure leadership signals detected.',
        anchors: []
    };
}

function detectEngineeringManagerPeople(cv, stats) {
    const keywords = [
        'engineering manager', 'people management', 'career pathing', 'recruitment engine',
        'team retention', 'mentoring leads', 'performance reviews', 'hiring roadmap'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Strong focus on the "Human API"—specializing in hiring, talent development, and building high-retention technical teams.' : 'Limited evidence of people-focused engineering management.',
        anchors: []
    };
}

module.exports = {
    detectCTOVisionary,
    detectVPEngineering,
    detectTechnicalCoFounder,
    detectHeadOfInfrastructure,
    detectEngineeringManagerPeople
};
