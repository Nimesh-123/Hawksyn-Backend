/**
 * ERROR Rules (VR_012 - VR_015, VR_018)
 * Failure here causes AEU downgrade or drop.
 */

const ALLOWED_CV_LOCATIONS = [
    'computed_from_full_cv', 'computed_from_roles', 'computed_from_dates',
    'computed_from_pattern', 'computed_from_role_history',
    'computed_from_term_clustering', 'computed_from_role_title_and_bullets'
];

// VR_013 — cv_location must be valid object or allowed string enum
async function VR_013(aeu) {
    for (const anchor of (aeu.evidence_anchors || [])) {
        const loc = anchor.cv_location;
        const isValidString = typeof loc === 'string' && ALLOWED_CV_LOCATIONS.includes(loc);
        const isValidObject = typeof loc === 'object' && loc !== null;
        if (!isValidString && !isValidObject) {
            return { pass: false, reason: `Invalid cv_location in anchor ${anchor.anchor_id || 'unidentified'}` };
        }
    }
    return { pass: true };
}

// VR_014 — if detection_state=detected, actual_anchor_count >= minimum_anchors_required
async function VR_014(aeu) {
    if (aeu.detection_state === 'detected') {
        const actual = aeu.actual_anchor_count || 0;
        const min = aeu.minimum_anchors_required || 1;
        if (actual < min) {
            return {
                pass: false,
                downgrade: true, // detected → partial
                reason: `anchor_count ${actual} < minimum_required ${min}`
            };
        }
    }
    return { pass: true };
}

// VR_015 — confidence_score >= archetype confidence_floor
async function VR_015(aeu, archetypeRegistryMap) {
    const rule = archetypeRegistryMap.get(aeu.archetype_id);
    if (!rule) return { pass: true };

    const floor = rule.confidence_floor || 0.4; // Default floor if not set
    if (aeu.detection_state === 'detected' && aeu.confidence_score < floor) {
        return {
            pass: false,
            downgrade: true,
            reason: `confidence ${aeu.confidence_score} < floor ${floor}`
        };
    }
    if (aeu.detection_state === 'partial' && aeu.confidence_score < floor) {
        return {
            pass: false,
            drop: true,
            reason: `partial AEU confidence ${aeu.confidence_score} < floor ${floor} — dropping`
        };
    }
    return { pass: true };
}

// VR_018 — required anchor types must be present
async function VR_018(aeu) {
    if (aeu.detection_state === 'detected' &&
        aeu.minimum_anchors_required > 0 &&
        (aeu.evidence_anchors || []).length === 0) {
        return {
            pass: false,
            downgrade: true,
            reason: 'No evidence anchors but detection_state=detected'
        };
    }
    return { pass: true };
}

module.exports = { VR_013, VR_014, VR_015, VR_018 };
