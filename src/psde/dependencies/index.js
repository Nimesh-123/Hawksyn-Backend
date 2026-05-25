/**
 * PSDE Archetype Dependency Engine
 * Handles semantic boosts between related archetypes
 */

const DEPENDENCY_BOOSTS = {
    'ARCH_008_001': { // Executive Ownership
        target_clusters: ['leadership'],
        factor: 1.15
    },
    'ARCH_009_001': { // Transformation Specialist
        target_archetypes: ['ARCH_010_001'], // Strategic Execution
        factor: 1.2
    }
};

function applyDependencyBoosts(results) {
    const detectedIds = results.map(r => r.archetype_id);
    
    return results.map(res => {
        let boostedScore = res.confidence_score;
        let flags = [...(res.flags || [])];

        // Apply boosts from other detected archetypes
        for (const [sourceId, config] of Object.entries(DEPENDENCY_BOOSTS)) {
            if (detectedIds.includes(sourceId) && sourceId !== res.archetype_id) {
                if (config.target_clusters?.includes(res.cluster) || config.target_archetypes?.includes(res.archetype_id)) {
                    boostedScore *= config.factor;
                    flags.push(`dependency_boost:${sourceId}`);
                }
            }
        }

        return {
            ...res,
            confidence_score: parseFloat(Math.min(0.98, boostedScore).toFixed(2)),
            flags
        };
    });
}

module.exports = { applyDependencyBoosts };
