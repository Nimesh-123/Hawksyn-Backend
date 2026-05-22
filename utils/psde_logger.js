const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../psde_audit.log');

/**
 * Logs PSDE scan results to a flat file for easy review and debugging.
 */
function logPSDEResult(candidateId, psdeResults) {
    const timestamp = new Date().toISOString();
    const detectedNames = psdeResults.archetype_results
        .filter(r => r.detection_state === 'detected')
        .map(r => r.archetype_name);
    
    const logEntry = {
        timestamp,
        candidate_id: candidateId,
        total_detected: psdeResults.meta.total_detected,
        detected_archetypes: detectedNames,
        cluster_summary: psdeResults.cluster_summary,
        // We include the full results but keep it formatted for readability
        raw_results: psdeResults.archetype_results.filter(r => r.detection_state === 'detected').map(r => ({
            id: r.archetype_id,
            name: r.archetype_name,
            conf: r.confidence_score,
            reason: r.reasoning
        }))
    };

    const divider = "\n" + "=".repeat(80) + "\n";
    const entryString = `[${timestamp}] CANDIDATE: ${candidateId}\n` +
                        `DETECTED (${psdeResults.meta.total_detected}): ${detectedNames.join(', ')}\n` +
                        `SUMMARY: ${JSON.stringify(psdeResults.cluster_summary)}\n` +
                        `DETAILS:\n${JSON.stringify(logEntry.raw_results, null, 2)}\n` +
                        divider;

    try {
        fs.appendFileSync(LOG_FILE, entryString, 'utf8');
        console.log(`[PSDE Logger] Results appended to ${path.basename(LOG_FILE)}`);
    } catch (err) {
        console.error('[PSDE Logger] Failed to write log:', err.message);
    }
}

module.exports = { logPSDEResult };
