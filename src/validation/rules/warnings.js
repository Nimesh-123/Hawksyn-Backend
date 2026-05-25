/**
 * WARNING Rules (VR_005 - VR_007, VR_012, VR_016, VR_017, VR_020)
 * These rules auto-fix data or handle set-level logic (Mutex/Dedup).
 */

// VR_005 — evidence_source should be cv_archetype_detection
function VR_005(aeu) {
    if (!aeu.evidence_source) {
        aeu.evidence_source = 'cv_archetype_detection';
        return { fixed: true, reason: 'evidence_source was missing — set to cv_archetype_detection' };
    }
    return { fixed: false };
}

// VR_006 — confidence_score must be in [0.0, 0.9] (Cap at 0.9 as per spec)
function VR_006(aeu) {
    let fixed = false;
    let reason = '';
    
    if (aeu.confidence_score > 0.9) {
        const old = aeu.confidence_score;
        aeu.confidence_score = 0.9;
        fixed = true;
        reason = `confidence clamped from ${old} to 0.9`;
    } else if (aeu.confidence_score < 0.0) {
        aeu.confidence_score = 0.0;
        fixed = true;
        reason = 'confidence clamped to 0.0';
    }
    return { fixed, reason };
}

// VR_007 — polarity check
function VR_007(aeu, archetypeRegistryMap) {
    const rule = archetypeRegistryMap.get(aeu.archetype_id);
    if (rule && rule.severity !== aeu.polarity) {
        return { fixed: false, reason: `polarity mismatch: registry=${rule.severity} AEU=${aeu.polarity}` };
    }
    return { fixed: false };
}

// VR_012 — if derivation_method is NOT direct_extraction, verbatim_quote must be null
function VR_012(aeu) {
    let fixedCount = 0;
    const nonDirect = ['aggregation', 'cross_field_computation', 'absence_check', 'user_provided'];
    
    for (const anchor of (aeu.evidence_anchors || [])) {
        if (nonDirect.includes(anchor.derivation_method) && anchor.verbatim_quote !== null) {
            anchor.verbatim_quote = null;
            fixedCount++;
        }
    }
    return { 
        fixed: fixedCount > 0, 
        reason: fixedCount > 0 ? `verbatim_quote cleared for ${fixedCount} non-direct anchors` : '' 
    };
}

// VR_016 — Mutex: within mutex_group, only highest-confidence detected AEU survives
function VR_016(allAEUs, archetypeRegistryMap) {
    const groups = {};

    for (const aeu of allAEUs) {
        const rule = archetypeRegistryMap.get(aeu.archetype_id);
        const group = rule?.mutex_group;
        if (!group || aeu.detection_state !== 'detected') continue;

        if (!groups[group]) groups[group] = [];
        groups[group].push(aeu);
    }

    const demoted = [];
    for (const [group, aeus] of Object.entries(groups)) {
        if (aeus.length <= 1) continue;
        
        aeus.sort((a, b) => b.confidence_score - a.confidence_score);
        
        for (let i = 1; i < aeus.length; i++) {
            aeus[i].detection_state = 'partial';
            demoted.push(aeus[i].archetype_id);
        }
    }
    return { demoted };
}

// VR_017 — No duplicate archetype_ids in same run
function VR_017(allAEUs) {
    const seen = new Map();
    const toRemoveIndices = new Set();

    allAEUs.forEach((aeu, index) => {
        if (seen.has(aeu.archetype_id)) {
            const existingIndex = seen.get(aeu.archetype_id);
            const existing = allAEUs[existingIndex];
            
            if (aeu.confidence_score > existing.confidence_score) {
                toRemoveIndices.add(existingIndex);
                seen.set(aeu.archetype_id, index);
            } else {
                toRemoveIndices.add(index);
            }
        } else {
            seen.set(aeu.archetype_id, index);
        }
    });

    return allAEUs.filter((_, i) => !toRemoveIndices.has(i));
}

// VR_020 — Single archetype must not produce multiple AEUs in same call
function VR_020(allAEUs) {
    return VR_017(allAEUs);
}

module.exports = { VR_005, VR_006, VR_007, VR_012, VR_016, VR_017, VR_020 };
