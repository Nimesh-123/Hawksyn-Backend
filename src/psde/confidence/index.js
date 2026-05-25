/**
 * PSDE Confidence Calibration Engine
 * Calculates production-grade confidence with multi-factor provenance
 */

function calculateConfidence(detection, context) {
    const { validationMeta, stats, roleCount } = context;
    
    let base = detection.confidence || 0.7;
    
    // 1. Evidence Diversity Score (Cross-role support)
    const uniqueRoles = new Set((detection.evidence_aeu_ids || []).map(id => id.split('_')[0])).size;
    const diversityMultiplier = uniqueRoles > 1 ? 1.1 : 0.9;

    // 2. Chronology Quality (Structural integrity)
    const chronologyQuality = (validationMeta?.verbatim_match_rate || 1.0) * 0.2;

    // 3. Validation Penalty System
    let validationPenalty = 0;
    if (validationMeta?.total_violations > 0) {
        validationPenalty += (validationMeta.total_violations * 0.05);
    }

    // 4. Metrics Density Bonus
    const metricsBonus = stats.metrics_density > 1.2 ? 0.05 : 0;

    // finalScore components for provenance
    const scoreComponents = {
        evidence_strength: parseFloat((base * diversityMultiplier).toFixed(2)),
        chronology_quality: parseFloat(chronologyQuality.toFixed(2)),
        metrics_density: metricsBonus,
        validation_health: parseFloat((1.0 - validationPenalty).toFixed(2))
    };

    let finalScore = (base * diversityMultiplier) + chronologyQuality + metricsBonus - validationPenalty;

    // Cap ranges as per production requirements
    finalScore = Math.max(0.4, Math.min(0.98, finalScore));

    return {
        score: parseFloat(finalScore.toFixed(2)),
        provenance: scoreComponents
    };
}

module.exports = { calculateConfidence };
