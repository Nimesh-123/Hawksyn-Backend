/**
 * PSDE Overlap Normalization Engine
 */
function normalizeArchetypeOverlap(results) {
    for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
            const resA = results[i];
            const resB = results[j];

            // Calculate Jaccard similarity for evidence IDs
            const setA = new Set(resA.evidence_aeu_ids);
            const setB = new Set(resB.evidence_aeu_ids);
            const intersection = new Set([...setA].filter(x => setB.has(x)));
            
            const overlapRatio = intersection.size / Math.max(setA.size, setB.size);

            if (overlapRatio > 0.7) {
                // Penalize the one with lower confidence
                if (resA.confidence_score > resB.confidence_score) {
                    resB.confidence_score *= 0.8;
                    resB.flags.push('overlap_suppression');
                } else {
                    resA.confidence_score *= 0.8;
                    resA.flags.push('overlap_suppression');
                }
            }
        }
    }
    return results;
}

module.exports = { normalizeArchetypeOverlap };
