const { archetypeRegistry, calcConfidence, getArchetype, CLUSTER_MAP } = require('../registry');
const { calculateConfidence } = require('../confidence');
const { normalizeArchetypeOverlap } = require('../overlap');
const { validateContradictions } = require('../contradictions');
const { generateArchetypeExplanation } = require('../explanation');
const { applyInferenceBoosts } = require('../inference-linker');
const { applyDependencyBoosts } = require('../dependencies');
const { applyArchetypeMutex } = require('../mutex');
const { generateExecutiveSummary } = require('../explanation/summary');
const { runValidation } = require('../../validation');

/**
 * UNIFIED CAREER SIGNALS
 */
function computeCareerSignals(extractedCV, precomputedStats) {
    const roles = (extractedCV.roles || []);
    const aeus = (extractedCV.base_aeus || []);
    const total = aeus.length || 1;

    return {
        ...precomputedStats,
        pctOwned: aeus.filter(a => a.decision_level === 'owned').length / total,
        pctContributed: aeus.filter(a => a.decision_level === 'contributed').length / total,
        pctStrong: aeus.filter(a => a.evidence_strength === 'strong').length / total,
        pctVague: aeus.filter(a => (a.flags || []).includes('vague_action')).length / total,
        pctMetric: aeus.filter(a => a.metrics && a.metrics.metric_name).length / total,
        senioritySeq: precomputedStats.seniority_sequence || [],
        overlapFlag: precomputedStats.overlapFlag || false,
        gapPeriods: precomputedStats.gapPeriods || [],
        header: extractedCV.header || {}
    };
}

async function runPSDEScan(extractedCV, precomputedStats, validationMeta, inferenceAEUs = [], runId = null, isDebug = false) {
    let results = [];
    const startTime = Date.now();
    const activeRunId = runId || `RUN_PSDE_${Date.now()}`;
    const debugTrace = [];

    const signals = computeCareerSignals(extractedCV, precomputedStats);
    
    // Convert registry to Map for efficient validation lookup
    const archetypeRegistryMap = new Map();
    archetypeRegistry.forEach(r => archetypeRegistryMap.set(r.id, r));

    // --- STEP 1: EXECUTE ALL DETECTORS (The 330 Loop) ---
    const { getArchetype, CLUSTER_MAP } = require('../registry');
    const maxRank = Math.max(...((signals.senioritySeq && signals.senioritySeq.length > 0) ? signals.senioritySeq : [3]));

    for (const archetype of archetypeRegistry) {
        let aeu;
        try {
            const detection = archetype.detector(extractedCV, signals);
            
            if (isDebug || process.env.PSDE_DEBUG_MODE === 'true') {
                debugTrace.push({
                    detector_name: archetype.detector.name || 'anonymous',
                    archetype_id: archetype.id,
                    input_values: { role_count: signals.role_count, avg_tenure_months: signals.avg_tenure_months, max_seniority_jump: signals.max_seniority_jump },
                    evaluated_conditions: 'captured',
                    matched_evidence: detection.anchors || [],
                    rejected_evidence: [],
                    confidence_calculation: { base: detection.confidence || 0, final: detection.confidence || 0 },
                    mutex_evaluation: 'pending',
                    final_decision: detection.detected ? 'detected' : 'rejected'
                });
            }
            const variantData = await getArchetype(archetype.id, maxRank);
            
            if (!variantData) {
                // Undocumented archetype handling (skips missing)
                const undocumentedIds = ['ARCH_RISK_002', 'ARCH_RISK_003', 'ARCH_DOMAIN_004', 'ARCH_IND_001', 'ARCH_IND_005'];
                if (undocumentedIds.includes(archetype.id)) {
                    console.warn(`[PSDE] WARNING: Undocumented ID triggered by detector but missing from master table: ${archetype.id}`);
                } else {
                    console.error(`[PSDE] ERROR: Archetype ${archetype.id} requested by detector but missing from master table.`);
                }
                continue;
            }

            if (detection.detected) {
                const context = { validationMeta, stats: signals, roleCount: signals.role_count };
                const confResult = calculateConfidence(detection, context);
                let finalConfidence = confResult.score;

                // Sanity check: detected=true must have conf > 0
                if (finalConfidence <= 0) finalConfidence = 0.4;
                
                if (isDebug || process.env.PSDE_DEBUG_MODE === 'true') {
                    debugTrace[debugTrace.length - 1].confidence_calculation = {
                        base: detection.confidence || 0,
                        provenance: confResult.provenance,
                        final: finalConfidence
                    };
                }

                const explanation = generateArchetypeExplanation(detection, extractedCV, { score: finalConfidence });

                aeu = {
                    archetype_id: variantData.id,
                    archetype_name: variantData.name,
                    cluster_id: normalizeClusterId(variantData.cluster),
                    dimension_id: archetype.dimension_id || `DIM_${variantData.cluster.toUpperCase()}`,
                    detection_state: 'detected',
                    confidence_score: finalConfidence,
                    polarity: variantData.polarity,
                    severity: variantData.polarity, // Aliased for backward compatibility
                    evidence_source: 'cv_archetype_detection',
                    minimum_anchors_required: 1,
                    actual_anchor_count: (detection.anchors || []).length,
                    evidence_anchors: (detection.anchors || []).map((anc, idx) => ({
                        anchor_id: anc.anchor_id || `${variantData.id}_ANC_${String(idx+1).padStart(3, '0')}`,
                        anchor_type: anc.anchor_type || anc.type,
                        anchor_value: anc.anchor_value || anc.value,
                        derivation_method: determineDerivationMethod(anc),
                        cv_location: anc.cv_location || 'computed_from_roles',
                        verbatim_quote: anc.verbatim_quote || anc.quote || null,
                        anchor_confidence: anc.anchor_confidence || 0.8,
                        section: anc.section || 'experience',
                        role_index: anc.role_index,
                        bullet_index: anc.bullet_index,
                        company: anc.company,
                        role: anc.role,
                        date: anc.date
                    })),
                    reasoning: detection.reasoning,
                    explanation: explanation,
                    flags: []
                };
            } else {
                aeu = buildNotDetectedAEU(archetype, variantData);
                if (aeu) {
                    aeu.confidence_score = 0; // Sanity check: detected=false must have conf = 0
                }
            }
        } catch (error) {
            console.error(`[PSDE] Detector failed for ${archetype.id}:`, error.message);
            const variantData = await getArchetype(archetype.id, maxRank);
            if(variantData) {
                aeu = buildNotDetectedAEU(archetype, variantData);
            }
        }
        if (aeu) results.push(aeu);
    }

    // --- STEP 2: POST-PROCESSING (Overlap, Contradictions, Mutex) ---
    results = normalizeArchetypeOverlap(results);
    results = validateContradictions(results);
    results = applyInferenceBoosts(results, inferenceAEUs);
    results = applyDependencyBoosts(results);
    results = await applyArchetypeMutex(results, isDebug || process.env.PSDE_DEBUG_MODE === 'true' ? debugTrace : null);

    // --- STEP 2.5: VALIDATION ENGINE (VR_001 - VR_020) ---
    console.log(`[PSDE] Running Validation Engine for run ${activeRunId}...`);
    const validationResult = await runValidation(
        results,
        archetypeRegistryMap,
        extractedCV.extraction_meta?.conditioned_text || '',
        activeRunId
    );
    
    results = validationResult.validated_aeus;
    const hallucinationCount = validationResult.hallucination_count;

    // --- STEP 3: SUMMARY COMPUTATION ---
    const detectedAEUs = results.filter(r => r.detection_state === 'detected');
    const topFired = [...detectedAEUs]
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, 10);

    const clusterSummary = {};
    results.forEach(res => {
        const cid = res.cluster_id || 'general';
        if (!clusterSummary[cid]) {
            clusterSummary[cid] = { detected: 0, partial: 0, not_detected: 0, contradicted: 0 };
        }
        clusterSummary[cid][res.detection_state]++;
    });

    const executiveSummary = generateExecutiveSummary(detectedAEUs, precomputedStats);

    const sanitizedSummary = sanitizeClusterSummary(clusterSummary);

    return {
        run_id: activeRunId,
        debug_trace: isDebug || process.env.PSDE_DEBUG_MODE === 'true' ? debugTrace : undefined,
        candidate_intelligence_summary: executiveSummary,
        archetype_results: results.filter(a => a.detection_state !== 'not_detected'), 
        total_evaluated: 330,
        total_detected: results.filter(a => a.detection_state === 'detected').length,
        total_partial: results.filter(a => a.detection_state === 'partial').length,
        total_not_detected: results.filter(a => a.detection_state === 'not_detected').length,
        total_contradicted: results.filter(a => a.detection_state === 'contradicted').length,
        hallucination_count: hallucinationCount,
        top_fired: topFired,
        cluster_summary: sanitizedSummary,
        meta: {
            total_scanned: 330,
            total_detected: detectedAEUs.length,
            scan_time_ms: Date.now() - startTime,
            generated_at: new Date()
        }
    };
}

function sanitizeClusterSummary(summary) {
    for (const cluster of Object.values(summary)) {
        for (const key of Object.keys(cluster)) {
            if (typeof cluster[key] === 'number' && isNaN(cluster[key])) {
                cluster[key] = 0;
            }
            if (cluster[key] === undefined || cluster[key] === null) {
                cluster[key] = 0;
            }
        }
        // Remove "suppressed" key entirely (no longer a valid state)
        delete cluster.suppressed;
    }
    return summary;
}

/**
 * Maps internal derivation methods and anchor types to the allowed enum values in PSDE_AEU_Schema.json
 */
function determineDerivationMethod(anc) {
    const type = (anc.anchor_type || anc.type || '').toUpperCase();
    const method = anc.derivation_method || '';
    const hasQuote = !!(anc.verbatim_quote || anc.quote);

    // 1. Map to Spec Enum based on type/logic
    let specMethod = 'aggregation'; // Default fallback

    if (type === 'SENIORITY_SEQUENCE' || type === 'AVG_TENURE_MONTHS' || type === 'PCT_METRIC_PRESENT' || type === 'PCT_OWNED') {
        specMethod = 'aggregation';
    } else if (type === 'GAP_COUNT' || type === 'MAX_GAP_MONTHS' || type === 'GROWTH_VELOCITY') {
        specMethod = 'cross_field_computation';
    } else if (type.includes('KEYWORDS') || type.includes('COMPANIES') || method === 'keyword_match') {
        specMethod = hasQuote ? 'direct_extraction' : 'aggregation';
    } else if (method === 'direct_extraction') {
        specMethod = hasQuote ? 'direct_extraction' : 'aggregation';
    } else if (method === 'absence') {
        specMethod = 'absence_check';
    } else if (method === 'calculation') {
        specMethod = 'cross_field_computation';
    } else if (method === 'computed_inference') {
        specMethod = 'aggregation';
    } else if (hasQuote) {
        specMethod = 'direct_extraction';
    }

    return specMethod;
}

function buildNotDetectedAEU(archetype, variantData) {
    return {
        archetype_id: variantData ? variantData.id : archetype.id,
        archetype_name: variantData ? variantData.name : archetype.name,
        cluster_id: normalizeClusterId(variantData ? variantData.cluster : archetype.cluster),
        dimension_id: archetype.dimension_id || `DIM_${(variantData ? variantData.cluster : archetype.cluster).toUpperCase()}`,
        detection_state: 'not_detected',
        confidence_score: 0.0,
        polarity: variantData ? variantData.polarity : 'negative',
        severity: variantData ? variantData.polarity : 'negative', // Aliased for backward compatibility
        evidence_source: 'cv_archetype_detection',
        minimum_anchors_required: 1,
        actual_anchor_count: 0,
        evidence_anchors: [],
        reasoning: 'No significant signals detected.',
        explanation: null,
        flags: []
    };
}



/**
 * Normalizes cluster_id to the Hawksyn C1-C8 format for UI compatibility.
 */
function normalizeClusterId(clusterId) {
    return CLUSTER_MAP[clusterId] || clusterId;
}

module.exports = { runPSDEScan };
