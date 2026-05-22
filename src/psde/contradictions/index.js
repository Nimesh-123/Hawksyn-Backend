/**
 * PSDE Contradiction Engine
 */
const CONTRADICTION_MAP = {
    'ARCH_002_001': ['ARCH_RISK_001'], // Long Tenure vs Job Hopper
    'ARCH_001_001': ['ARCH_RISK_002'], // Linear Growth vs Inconsistent Progression
};

function validateContradictions(results) {
    const detectedIds = results.map(r => r.archetype_id);
    
    results.forEach(res => {
        const contradictions = CONTRADICTION_MAP[res.archetype_id] || [];
        contradictions.forEach(targetId => {
            if (detectedIds.includes(targetId)) {
                res.confidence_score *= 0.7;
                res.validation_state = 'contradicted';
                res.flags.push('logical_contradiction_detected');
            }
        });
    });
    
    return results;
}

module.exports = { validateContradictions };
