/**
 * International & Global Mobility Detectors
 */

function detectExpatLeader(cv, stats) {
    const keywords = [
        'expat', 'expatriate', 'overseas assignment', 'international assignment',
        'cross-cultural leadership', 'relocated to', 'working abroad'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1; // Even one explicit expat signal is high value
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Demonstrates experience as an expatriate leader with cross-cultural management exposure.' : 'No explicit expat leadership signals detected.',
        anchors: []
    };
}

function detectCrossBorderStrategist(cv, stats) {
    const keywords = [
        'international expansion', 'global strategy', 'cross-border', 
        'foreign markets', 'market entry strategy', 'global footprint',
        'international growth', 'apac', 'emea', 'latam', 'global role'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven expertise in driving international expansion and global market entry strategies.' : 'Limited evidence of cross-border strategic leadership.',
        anchors: []
    };
}

function detectEmergingMarketsPioneer(cv, stats) {
    const keywords = [
        'emerging markets', 'frontier markets', 'apac', 'mena', 'latam',
        'brics', 'southeast asia', 'middle east', 'africa', 'developing economies'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Extensive experience operating in and scaling across emerging or frontier markets.' : 'No significant emerging markets signals found.',
        anchors: []
    };
}

function detectMultiNationalOperator(cv, stats) {
    const keywords = [
        'mnc', 'multi-national', 'global operations', 'matrix organization',
        'regional headquarters', 'global role', 'international headquarters'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.90 : 0,
        reasoning: isDetected ? 'Seasoned operator within complex multi-national corporations and matrixed environments.' : 'Limited multi-national operational signals detected.',
        anchors: []
    };
}

function detectGlobalMobilityExpert(cv, stats) {
    const keywords = [
        'global mobility', 'immigration compliance', 'international relocation',
        'expatriate management', 'visa sponsorship', 'tax equalization',
        'mobility policy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Expertise in managing global mobility programs, immigration, and international relocations.' : 'No significant global mobility expert signals found.',
        anchors: []
    };
}

module.exports = {
    detectExpatLeader,
    detectCrossBorderStrategist,
    detectEmergingMarketsPioneer,
    detectMultiNationalOperator,
    detectGlobalMobilityExpert
};
