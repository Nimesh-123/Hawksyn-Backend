// src/modules/commandCenter/helpers.js

/**
 * Checks if a specific archetype ID was detected in the PSDE array.
 * @param {Array} psdeArray - The array of PSDE signals
 * @param {String} archId - The ARCH_XXX_XXX ID
 * @returns {Boolean} true if detected, false otherwise
 */
function detected(psdeArray, archId) {
    if (!psdeArray || !Array.isArray(psdeArray)) return false;
    const signal = psdeArray.find(s => s.archetype_id === archId);
    return signal ? (signal.detection_state === 'detected') : false;
}

/**
 * Returns the confidence score of a detected archetype.
 * @param {Array} psdeArray - The array of PSDE signals
 * @param {String} archId - The ARCH_XXX_XXX ID
 * @returns {Number} confidence (0.0 to 1.0)
 */
function confidence(psdeArray, archId) {
    if (!psdeArray || !Array.isArray(psdeArray)) return 0;
    const signal = psdeArray.find(s => s.archetype_id === archId);
    return (signal && signal.detection_state === 'detected') ? (signal.confidence_score || 0) : 0;
}

/**
 * Counts how many archetypes from a given list were detected.
 * @param {Array} psdeArray - The array of PSDE signals
 * @param {Array<String>} archIdList - Array of ARCH_XXX_XXX IDs
 * @returns {Number} count of detected archetypes
 */
function detected_count(psdeArray, archIdList) {
    if (!psdeArray || !Array.isArray(psdeArray) || !Array.isArray(archIdList)) return 0;
    let count = 0;
    for (const archId of archIdList) {
        if (detected(psdeArray, archId)) {
            count++;
        }
    }
    return count;
}

/**
 * Returns the list of detected archetype IDs from the requested array
 */
function get_detected_contributors(psdeArray, possibleIds) {
    if (!psdeArray || !Array.isArray(psdeArray)) return [];
    // Only return up to 5, sorted by confidence (assuming psdeArray is sorted or we sort it here)
    const matched = psdeArray.filter(s => s.detection_state === 'detected' && possibleIds.includes(s.archetype_id));
    matched.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
    return matched.slice(0, 5).map(s => s.archetype_id);
}

module.exports = {
    detected,
    confidence,
    detected_count,
    get_detected_contributors
};
