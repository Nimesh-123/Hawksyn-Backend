/**
 * Thought Leadership & Executive Presence Detectors
 */

function detectBoardAdvisor(cv, stats) {
    const keywords = [
        'board member', 'advisory board', 'board of directors',
        'non-executive director', 'strategic advisor to the board',
        'board observer', 'trustee'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    // Check for long keywords
    let isDetected = keywords.some(k => text.includes(k));
    
    // Check for short acronyms with word boundaries
    if (!isDetected && /\bned\b/i.test(text)) {
        isDetected = true;
    }
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Demonstrated experience in board-level advisory and corporate governance.' : 'No significant board advisor signals detected.',
        anchors: []
    };
}

function detectPublicSpeaker(cv, stats) {
    const keywords = [
        'speaker', 'keynote', 'panelist', 'conference speaker', 'public speaking',
        'presented at', 'guest lecturer', 'thought leadership sessions',
        'webinar host', 'podcaster'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const isDetected = keywords.some(k => {
        if (k === 'speaker') return /\bspeaker\b/i.test(text);
        return text.includes(k);
    });
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven track record of industry-level public speaking and conference participation.' : 'Limited evidence of public speaking roles.',
        anchors: []
    };
}

function detectESGChampion(cv, stats) {
    const keywords = [
        'esg', 'sustainability strategy', 'corporate social responsibility',
        'csr', 'environmental impact', 'social governance', 'sustainable development',
        'net zero', 'carbon neutrality', 'diversity and inclusion leader'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const isDetected = keywords.some(k => {
        if (k === 'esg' || k === 'csr') return new RegExp(`\\b${k}\\b`, 'i').test(text);
        return text.includes(k);
    });
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Active leadership in Environmental, Social, and Governance (ESG) initiatives.' : 'No significant ESG signals found.',
        anchors: []
    };
}

function detectIndustryInfluencer(cv, stats) {
    const keywords = [
        'whitepaper author', 'published in', 'industry influencer',
        'thought leader', 'opinion piece', 'contributing author',
        'patent holder', 'patent inventor', 'research publication',
        'top 50', 'top 100', 'featured in', 'recognized as', 'award'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.91 : 0,
        reasoning: isDetected ? 'Recognized as an industry authority through publications, patents, awards, or significant thought leadership.' : 'No significant industry influence signals detected.',
        anchors: []
    };
}

function detectStrategicAdvisor(cv, stats) {
    const keywords = [
        'strategic advisor', 'consultant to', 'executive coach',
        'management consultant', 'strategy consultant', 'trusted advisor',
        'c-suite advisor', 'business mentor'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'High-level strategic advisory experience, often at the C-suite or founder level.' : 'Limited evidence of strategic advisory roles.',
        anchors: []
    };
}

module.exports = {
    detectBoardAdvisor,
    detectPublicSpeaker,
    detectESGChampion,
    detectIndustryInfluencer,
    detectStrategicAdvisor
};
