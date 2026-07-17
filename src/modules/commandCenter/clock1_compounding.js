// src/modules/commandCenter/clock1_compounding.js
const { detected, confidence, detected_count, get_detected_contributors } = require('./helpers');

/**
 * Calculates the score, condition, and contributors for Clock 1 (Career Compounding)
 * @param {Array} psdeArray - The array of detected PSDE signals
 * @returns {Object} { score, condition_id, contributors }
 */
function calculateClock1(psdeArray) {
    let baselineScore = 55;
    let conditionId = 'CC1_01'; // Default
    
    // Evaluate Conditions in Priority Order
    
    // Priority 1: High Compounding
    if (detected_count(psdeArray, ['ARCH_001_002', 'ARCH_001_003', 'ARCH_001_010', 'ARCH_001_011']) >= 1) {
        if (detected_count(psdeArray, ['ARCH_019_001', 'ARCH_008_011', 'ARCH_020_001']) === 0) {
            baselineScore = 80;
            conditionId = 'CC1_02';
        }
    }
    
    // Priority 2: Accelerated Growth
    else if (detected_count(psdeArray, ['ARCH_001_012', 'ARCH_001_013', 'ARCH_001_014', 'ARCH_001_015']) >= 1) {
        if (detected_count(psdeArray, ['ARCH_019_001', 'ARCH_019_004']) === 0) {
            baselineScore = 75;
            conditionId = 'CC1_03';
        }
    }
    
    // Priority 3: Stable Trajectory
    else if (detected_count(psdeArray, ['ARCH_025_003', 'ARCH_004_010']) >= 1) {
        if (detected(psdeArray, 'ARCH_014_006') === false) {
            baselineScore = 65;
            conditionId = 'CC1_04';
        }
    }
    
    // Priority 4: Stagnation Risk
    else if (detected_count(psdeArray, ['ARCH_001_005', 'ARCH_001_006']) >= 1) {
        if (detected_count(psdeArray, ['ARCH_014_007', 'ARCH_020_006']) >= 1) {
            baselineScore = 40;
            conditionId = 'CC1_05';
        }
    }
    
    // Priority 5: Career Attrition
    else if (detected_count(psdeArray, ['ARCH_019_003', 'ARCH_001_004', 'ARCH_019_006', 'ARCH_019_002']) >= 2) {
        if (detected_count(psdeArray, ['ARCH_012_004', 'ARCH_012_008']) === 0) {
            baselineScore = 20;
            conditionId = 'CC1_06';
        }
    }
    
    // Priority 6: Severe Disruption
    else if (detected_count(psdeArray, ['ARCH_020_003', 'ARCH_002_003']) >= 1) {
        baselineScore = 15;
        conditionId = 'CC1_07';
    }

    // Mathematical Adjustments
    let finalScore = baselineScore;

    // +5 for each stable increment
    if (detected(psdeArray, 'ARCH_025_003')) finalScore += 5;
    if (detected(psdeArray, 'ARCH_014_002')) finalScore += 5;

    // -5 for each drag
    if (detected(psdeArray, 'ARCH_019_004')) finalScore -= 5;
    if (detected(psdeArray, 'ARCH_014_006')) finalScore -= 5;
    if (detected(psdeArray, 'ARCH_008_011')) finalScore -= 5;

    // Cap the score between 0 and 100
    if (finalScore > 100) finalScore = 100;
    if (finalScore < 0) finalScore = 0;

    // Contributors (Top 5 support signals)
    const possibleContributors = [
        'ARCH_001_002', 'ARCH_001_003', 'ARCH_001_010', 'ARCH_001_011',
        'ARCH_001_012', 'ARCH_001_013', 'ARCH_001_014', 'ARCH_001_015',
        'ARCH_025_003', 'ARCH_004_010', 'ARCH_014_002', 'ARCH_019_003', 
        'ARCH_001_004', 'ARCH_019_006', 'ARCH_019_002', 'ARCH_020_003', 
        'ARCH_002_003'
    ];
    const contributors = get_detected_contributors(psdeArray, possibleContributors);

    return {
        score: finalScore,
        condition_id: conditionId,
        contributors: contributors
    };
}

module.exports = { calculateClock1 };
