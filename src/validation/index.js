const { VR_001, VR_002, VR_003, VR_004, VR_008, VR_009, VR_010, VR_011 } = require('./rules/fatal');
const { VR_013, VR_014, VR_015, VR_018 } = require('./rules/errors');
const { VR_005, VR_006, VR_007, VR_012, VR_016, VR_017 } = require('./rules/warnings');
const { logValidationFailure } = require('./audit');

/**
 * Main Validation Engine Orchestrator
 * Runs VR_001 to VR_020 in sequence.
 */
async function runValidation(allAEUs, archetypeRegistryMap, conditionedText, runId) {
    const validated = [];
    let hallucination_count = 0;

    for (const aeu of allAEUs) {
        let dropped = false;

        // ─── FATAL RULES (stop on first failure) ───
        const fatalRules = [
            { id: 'VR_001', fn: () => VR_001(aeu) },
            { id: 'VR_002', fn: () => VR_002(aeu, archetypeRegistryMap) },
            { id: 'VR_003', fn: () => VR_003(aeu, archetypeRegistryMap) },
            { id: 'VR_004', fn: () => VR_004(aeu) },
            { id: 'VR_008', fn: () => VR_008(aeu) },
            { id: 'VR_009', fn: () => VR_009(aeu) },
            { id: 'VR_010', fn: () => VR_010(aeu) },
        ];

        for (const rule of fatalRules) {
            const result = await rule.fn();
            if (!result.pass) {
                await logValidationFailure({
                    run_id: runId,
                    rule_id: rule.id,
                    severity: 'FATAL',
                    archetype_id: aeu.archetype_id,
                    failure_detail: result.reason,
                    raw_aeu: aeu
                });
                dropped = true;
                break;
            }
        }
        if (dropped) continue;

        // VR_011 — contradicted (not drop)
        const vr011 = await VR_011(aeu, conditionedText);
        if (!vr011.pass && vr011.contradicted) {
            aeu.detection_state = 'contradicted';
            aeu.confidence_score = Math.max(0, aeu.confidence_score / 2); // Halve confidence
            hallucination_count++;
            await logValidationFailure({
                run_id: runId,
                rule_id: 'VR_011',
                severity: 'FATAL',
                archetype_id: aeu.archetype_id,
                failure_detail: vr011.reason,
                raw_aeu: aeu
            });
        }

        // ─── WARNING RULES (auto-fix) ───
        VR_005(aeu);
        VR_006(aeu);
        VR_007(aeu, archetypeRegistryMap);
        VR_012(aeu);

        // ─── ERROR RULES (downgrade) ───
        const errorRules = [
            { id: 'VR_013', fn: () => VR_013(aeu) },
            { id: 'VR_014', fn: () => VR_014(aeu) },
            { id: 'VR_015', fn: () => VR_015(aeu, archetypeRegistryMap) },
            { id: 'VR_018', fn: () => VR_018(aeu) },
        ];

        for (const rule of errorRules) {
            const result = await rule.fn();
            if (!result.pass) {
                await logValidationFailure({
                    run_id: runId,
                    rule_id: rule.id,
                    severity: 'ERROR',
                    archetype_id: aeu.archetype_id,
                    failure_detail: result.reason,
                    raw_aeu: aeu
                });

                if (result.drop) { 
                    dropped = true; 
                    break; 
                }
                if (result.downgrade) {
                    // detected → partial → drop
                    if (aeu.detection_state === 'detected') {
                        aeu.detection_state = 'partial';
                    } else if (aeu.detection_state === 'partial') { 
                        dropped = true; 
                        break; 
                    }
                }
            }
        }
        if (dropped) continue;

        validated.push(aeu);
    }

    // ─── SET-LEVEL WARNING RULES ───
    const deduped = VR_017(validated);
    const { demoted } = VR_016(deduped, archetypeRegistryMap);

    if (hallucination_count > 0) {
        console.warn(`⚠️ [Validation] Hallucinations detected: ${hallucination_count} in run ${runId}`);
    }

    return {
        validated_aeus: deduped,
        hallucination_count,
        mutex_demotions: demoted
    };
}

module.exports = { runValidation };
