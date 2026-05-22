/**
 * PSDE Inference Linker
 * Maps high-level consolidator inferences (IA-EUs) to archetype boosts
 */

const INFERENCE_MAP = {
    'Linear Career Trajectory': {
        boosts: [
            { archetype_id: 'ARCH_001_001', factor: 1.2 }, // Linear Growth
            { archetype_id: 'PROMO_VELOCITY', factor: 1.1 } // Hypothetical future ID
        ]
    },
    'Practice Building and Team Leadership': {
        boosts: [
            { archetype_id: 'ARCH_004_001', factor: 1.15 }, // Leadership Density
            { archetype_id: 'ARCH_008_001', factor: 1.25 }  // Executive Ownership
        ]
    },
    'Strong Operational Ownership': {
        boosts: [
            { archetype_id: 'ARCH_010_001', factor: 1.2 }   // Strategic Execution
        ]
    }
};

function applyInferenceBoosts(results, inferenceAEUs) {
    if (!inferenceAEUs || inferenceAEUs.length === 0) return results;

    const updatedResults = results.map(res => {
        let boostedScore = res.confidence_score;
        let flags = [...(res.flags || [])];

        inferenceAEUs.forEach(iaeu => {
            const mapEntry = INFERENCE_MAP[iaeu.claim] || INFERENCE_MAP[iaeu.reason];
            if (mapEntry) {
                const boost = mapEntry.boosts.find(b => b.archetype_id === res.archetype_id);
                if (boost) {
                    boostedScore *= boost.factor;
                    flags.push(`inference_boost:${iaeu.i_aeu_id || 'IAEU'}`);
                }
            }
        });

        // Cap at 0.98 to keep within production bounds
        boostedScore = Math.min(0.98, boostedScore);

        return {
            ...res,
            confidence_score: parseFloat(boostedScore.toFixed(2)),
            flags
        };
    });

    return updatedResults;
}

module.exports = { applyInferenceBoosts };
