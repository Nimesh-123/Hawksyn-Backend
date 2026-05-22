/**
 * PSDE Explanation Engine: Narrative Synthesis
 * Generates recruiter-grade summaries for detected archetypes
 */

function generateArchetypeExplanation(detection, cv, confidence) {
    const supportingRoles = (cv.roles || []).filter(r => 
        detection.evidence_aeu_ids?.some(id => id.startsWith(r.role_id))
    ).map(r => r.role_metadata.title + ' @ ' + r.role_metadata.company);

    const supportingMetrics = (cv.base_aeus || []).filter(a => 
        detection.evidence_aeu_ids?.includes(a.aue_id) && a.metrics?.value
    ).map(a => a.metrics.value + ' ' + (a.metrics.metric_name || ''));

    // Narrative Synthesis
    let narrative = detection.reasoning;
    if (supportingRoles.length > 0) {
        narrative += ` This pattern was primarily observed during their tenure at ${supportingRoles.slice(0, 2).join(' and ')}.`;
    }
    if (supportingMetrics.length > 0) {
        narrative += ` Key impact includes: ${supportingMetrics.slice(0, 2).join(', ')}.`;
    }

    return {
        narrative: narrative,
        why_detected: [detection.reasoning],
        supporting_roles: [...new Set(supportingRoles)],
        supporting_metrics: supportingMetrics,
        confidence_breakdown: confidence.provenance,
        validation_notes: (confidence.provenance?.validation_penalty || 0) > 0 ? ['Score penalized due to CV integrity issues.'] : []
    };
}

module.exports = { generateArchetypeExplanation };
