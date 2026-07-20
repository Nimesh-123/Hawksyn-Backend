/**
 * FATAL Rules (VR_001 - VR_011)
 * Failure here causes AEU to be dropped or marked contradicted.
 */

// VR_001 — JSON schema valid against AEU schema
async function VR_001(aeu) {
    const required = [
        'archetype_id', 'archetype_name', 'dimension_id',
        'detection_state', 'confidence_score', 'polarity', 'evidence_source',
        'minimum_anchors_required', 'actual_anchor_count', 'evidence_anchors'
    ];

    const detectionStates = ['detected', 'partial', 'contradicted', 'not_detected'];
    const polarities = ['positive', 'negative', 'neutral', 'context_dependent'];
    const evidenceSources = [
        'cv_explicit', 'cv_archetype_detection', 'cv_inferred',
        'mcq_answer', 'external_signal', 'contradiction_derived', 'user_added_context'
    ];
    // Pattern ARCH_000_000 or ARCH_GEN_EXT_000.
    const archetypeIdPattern = /^ARCH_[A-Z0-9_]+_[0-9]+$/;

    for (const field of required) {
        if (aeu[field] === undefined || aeu[field] === null) {
            return { pass: false, reason: `Missing required field: ${field}` };
        }
    }
    
    if (!archetypeIdPattern.test(aeu.archetype_id))
        return { pass: false, reason: `Invalid archetype_id format: ${aeu.archetype_id}` };
    
    if (!detectionStates.includes(aeu.detection_state))
        return { pass: false, reason: `Invalid detection_state: ${aeu.detection_state}` };
    
    if (typeof aeu.confidence_score !== 'number' || aeu.confidence_score < 0 || aeu.confidence_score > 1)
        return { pass: false, reason: `Invalid confidence_score: ${aeu.confidence_score}` };
    
    if (!polarities.includes(aeu.polarity))
        return { pass: false, reason: `Invalid polarity: ${aeu.polarity}` };
    
    if (!evidenceSources.includes(aeu.evidence_source))
        return { pass: false, reason: `Invalid evidence_source: ${aeu.evidence_source}` };
    
    if (!Array.isArray(aeu.evidence_anchors))
        return { pass: false, reason: 'evidence_anchors must be array' };

    return { pass: true };
}

// VR_002 — archetype_id exists in archetype_registry and is_active=true
async function VR_002(aeu, archetypeRegistryMap) {
    const rule = archetypeRegistryMap.get(aeu.archetype_id);
    if (!rule) {
        return { pass: false, reason: `archetype_id not in registry: ${aeu.archetype_id}` };
    }
    // Using enabled instead of is_active to match our current schema
    if (rule.enabled === false) {
        return { pass: false, reason: `archetype_id is disabled in registry: ${aeu.archetype_id}` };
    }
    return { pass: true };
}

// VR_003 — cluster_id matches the cluster that produced this AEU
async function VR_003(aeu, archetypeRegistryMap) {
    const { getArchetype } = require('../../psde/registry/index.js');
    let data = await getArchetype(aeu.archetype_id, 3); // 3 defaults to JR_MID/ALL variant
    
    if (data) {
        if (data.cluster !== aeu.cluster_id) {
            return { pass: false, reason: `cluster mismatch: AEU says ${aeu.cluster_id} but master table says ${data.cluster}` };
        }
    }
    return { pass: true };
}

const CLUSTER_ID_MAP = {
    'growth': 'C1',
    'stability': 'C2',
    'leadership': 'C3',
    'scope': 'C3',
    'impact': 'C4',
    'execution': 'C4',
    'skills': 'C5',
    'behavioral': 'C5',
    'identity': 'C6',
    'risk': 'C6',
    'contextual': 'C6',
    'domain': 'C7',
    'industry': 'C7',
    'network': 'C8',
    'global': 'C8',
    'specialization': 'C5',
    'engineering': 'C5',
    'product': 'C5',
    'governance': 'C3',
    'revenue': 'C4',
    'service': 'C4',
    'people': 'C3',
    'finance': 'C4',
    'legal': 'C6',
    'operations': 'C4',
    'marketing': 'C4',
    'intelligence': 'C5',
    'credentials': 'C7',
    'strategy': 'C3',
    'general': 'C6'
};

function normalizeClusterId(clusterId) {
    return CLUSTER_ID_MAP[clusterId] || clusterId;
}

// VR_004 — actual_anchor_count == evidence_anchors.length
async function VR_004(aeu) {
    const count = (aeu.evidence_anchors || []).length;
    if (aeu.actual_anchor_count !== count) {
        return { pass: false, reason: `actual_anchor_count ${aeu.actual_anchor_count} != evidence_anchors.length ${count}` };
    }
    return { pass: true };
}

// VR_008 — anchor_type must be valid string and non-empty
async function VR_008(aeu) {
    for (const anchor of (aeu.evidence_anchors || [])) {
        if (!anchor.anchor_type || typeof anchor.anchor_type !== 'string') {
            return { pass: false, reason: `Invalid anchor_type in anchor ${anchor.anchor_id || 'unidentified'}` };
        }
    }
    return { pass: true };
}

// VR_009 — anchor_value type must not be undefined
async function VR_009(aeu) {
    for (const anchor of (aeu.evidence_anchors || [])) {
        if (anchor.anchor_value === undefined) {
            return { pass: false, reason: `anchor_value undefined in anchor ${anchor.anchor_id || 'unidentified'}` };
        }
    }
    return { pass: true };
}

// VR_010 — if derivation_method=direct_extraction, verbatim_quote must be non-null
async function VR_010(aeu) {
    for (const anchor of (aeu.evidence_anchors || [])) {
        if (anchor.derivation_method === 'direct_extraction' && !anchor.verbatim_quote) {
            return { pass: false, reason: `direct_extraction anchor missing verbatim_quote: ${anchor.anchor_id || 'unidentified'}` };
        }
    }
    return { pass: true };
}

// VR_011 — verbatim_quote must appear in conditioned_cv text
async function VR_011(aeu, conditionedText) {
    if (!conditionedText || aeu.detection_state === 'not_detected') return { pass: true };
    
    const normalise = s => s ? s.toLowerCase().replace(/\s+/g, ' ').trim() : '';
    const cvNorm = normalise(conditionedText);

    for (const anchor of (aeu.evidence_anchors || [])) {
        if (anchor.derivation_method === 'direct_extraction' && anchor.verbatim_quote) {
            const quoteNorm = normalise(anchor.verbatim_quote);
            if (quoteNorm && !cvNorm.includes(quoteNorm)) {
                return {
                    pass: false,
                    contradicted: true, // do not drop — mark contradicted
                    reason: `verbatim_quote not found in CV: "${anchor.verbatim_quote.slice(0, 60)}..."`
                };
            }
        }
    }
    return { pass: true };
}

module.exports = { VR_001, VR_002, VR_003, VR_004, VR_008, VR_009, VR_010, VR_011 };
