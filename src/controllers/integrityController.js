const { db } = require('../models/index.model.js');

/**
 * Helper function to evaluate conditions for contradictions and red flags
 */
function evaluateCondition(answerValue, operator, conditionValue) {
    if (answerValue === undefined || answerValue === null) return false;

    const numVal = Number(answerValue);
    const numCond = Number(conditionValue);
    const strVal = String(answerValue);
    const strCond = String(conditionValue);

    switch (operator.toLowerCase()) {
        case 'eq':
            return strVal === strCond;
        case 'neq':
            return strVal !== strCond;
        case 'gte':
            return numVal >= numCond;
        case 'lte':
            return numVal <= numCond;
        case 'gt':
            return numVal > numCond;
        case 'lt':
            return numVal < numCond;
        case 'in':
            if (Array.isArray(conditionValue)) {
                return conditionValue.includes(answerValue);
            }
            return String(conditionValue).split(',').map(v => v.trim()).includes(strVal);
        default:
            return false;
    }
}

/**
 * POST /api/v1/runs/:runId/integrity/run
 * Purpose: Run the full integrity engine for Hawksyn.
 */
exports.runIntegrityEngine = async (req, res) => {
    try {
        const { runId } = req.params;

        // STEP A — Load run + validate
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: 'Run not found' });
        }
        if (run.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, message: 'Run is not in progress' });
        }

        // STEP B — Load all inputs from RAS (Points #2 & #4.3)
        const rasInputs = await db.Ras.find({
            runId,
            status: 'FINAL'
        });

        // 1. Confirmed Profile Snapshot (Step-2)
        const profileSnapshot = rasInputs.find(r => r.artifactType === 'PROFILE_CONFIRMED')?.artifactJson || {};

        // 2. Objective Inputs Captured (Step-3)
        const allAnswers = [];
        rasInputs.filter(r => r.artifactType === 'OBJECTIVE_INPUTS_CAPTURED')
            .forEach(record => {
                if (record.artifactJson.answers && Array.isArray(record.artifactJson.answers)) {
                    record.artifactJson.answers.forEach(a => allAnswers.push(a));
                }
            });

        // 3. External Signals (Point #5.2)
        const allSignals = [];
        rasInputs.filter(r => r.artifactType === 'EXTERNAL_SIGNALS_CAPTURED')
            .forEach(record => {
                if (record.artifactJson.signals && Array.isArray(record.artifactJson.signals)) {
                    record.artifactJson.signals.forEach(s => allSignals.push(s));
                }
            });

        if (allAnswers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No objective inputs found. Complete Step 3 first.'
            });
        }

        // STEP C — Load ELR config
        const elr = await db.EvaluationLibraryRegistry.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });
        if (!elr) {
            return res.status(404).json({ success: false, message: 'Evaluation config (ELR) not found' });
        }

        // STEP D — Score each answer
        const scoredAnswers = [];
        for (const answer of allAnswers) {
            const q = await db.Questions.findOne({ questionId: answer.questionId });
            if (!q) continue;

            let score = 0;
            if (q.scoringType === 'MCQ_MAP') {
                const chosenOption = q.optionsJson?.find(o => (o.opt || o) === answer.answerValue);
                if (chosenOption) {
                    const optionScore = chosenOption.score;
                    const mapEntry = q.scoringMapJson?.find(m => m.optionScore === optionScore);
                    score = mapEntry ? mapEntry.normalizedScore : 0;
                }
            } else if (q.scoringType === 'NUMERIC_RANGE') {
                const val = Number(answer.answerValue);
                const ranges = q.scoringMapJson || {};
                for (const [range, pts] of Object.entries(ranges)) {
                    if (range.endsWith('+')) {
                        if (val >= parseInt(range)) { score = pts; break; }
                    } else {
                        const [min, max] = range.split('-').map(Number);
                        if (val >= min && val <= max) { score = pts; break; }
                    }
                }
            } else if (q.scoringType === 'SCALE_LINEAR') {
                const val = Number(answer.answerValue);
                const minScore = q.normalizationMin ?? 0;
                const maxScore = q.normalizationMax ?? 100;
                const range = (q.numericMax - q.numericMin) || 1;
                score = Math.round(minScore + ((val - q.numericMin) / range) * (maxScore - minScore));
            } else {
                const chosenOption = q.optionsJson?.find(o => (o.opt || o) === answer.answerValue);
                score = chosenOption ? (chosenOption.score || 0) : 0;
            }

            scoredAnswers.push({
                questionId: answer.questionId,
                answerValue: answer.answerValue,
                rawScore: score,
                weight: q.defaultWeight || 1,
                scoringType: q.scoringType
            });
        }

        // STEP E — Evaluate constraints (Uses CTT: thresholds array)
        const constraintResults = [];
        const constraints = await db.Constraints.find({
            caseId: run.caseId,
            intentId: run.intentId,
            isActive: true
        });

        for (const constraint of constraints) {
            const mappings = await db.ConstraintQuestionMapping.find({
                constraintId: constraint.constraintId,
                isActive: true
            });

            let weightedSum = 0;
            let totalWeight = 0;
            for (const mapping of mappings) {
                const scored = scoredAnswers.find(s => s.questionId === mapping.questionId);
                if (!scored) continue;
                weightedSum += scored.rawScore * (mapping.contributionWeight || 1);
                totalWeight += (mapping.contributionWeight || 1);
            }

            const constraintScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

            // ✅ FIX 1: Use CTT (Constraint Threshold Taxonomy) from model
            let band = 'UNCLASSIFIED';
            if (constraint.thresholds && Array.isArray(constraint.thresholds)) {
                const match = constraint.thresholds.find(t => constraintScore >= t.minScore && constraintScore <= t.maxScore);
                if (match) band = match.bandName;
            }

            constraintResults.push({
                constraintId: constraint.constraintId,
                constraintName: constraint.constraintName,
                score: constraintScore,
                band,
                isBlocking: constraint.isBlockingConstraint && (band === 'CRITICAL' || band === 'TERMINAL_FAILURE')
            });
        }

        // ✅ FIX 2: Coverage Check (CRT + CAT)
        const coverageResults = [];
        let coveragePenalty = 0;

        const crtMap = await db.CoverageRequirements.find({
            coverageSetId: elr.coverageSetId,
            isActive: true
        });

        // CAT (Constraint Adjustment Taxonomy / DataPatternKeyTaxonomy)
        const patterns = await db.DataPatternKeyTaxonomy.find({
            caseId: run.caseId,
            intentId: run.intentId,
            isActive: true
        });

        for (const crt of crtMap) {
            let sufficiency = 'MISSING';
            let evidenceCount = 0;

            // Check Question-based anchors
            if (crt.requiredSourcesJson?.questionIds) {
                const present = crt.requiredSourcesJson.questionIds.filter(qid => allAnswers.some(a => a.questionId === qid));
                evidenceCount += present.length;
            }

            // Check Signal-based anchors
            if (crt.requiredSourcesJson?.externalSignalIds) {
                const present = crt.requiredSourcesJson.externalSignalIds.filter(sid => allSignals.some(s => s.signalId === sid));
                evidenceCount += present.length;
            }

            // Check Pattern-based anchors (CAT logic)
            const relatedPatterns = patterns.filter(p => p.producesAnchorName === crt.anchorName);
            for (const pattern of relatedPatterns) {
                const presentSignals = pattern.requiredSignals.filter(sid => allSignals.some(s => s.signalId === sid));
                if (presentSignals.length >= (pattern.minRequiredSignals || 1)) {
                    evidenceCount += 1; // Pattern satisfied
                }
            }

            if (evidenceCount >= (crt.minimumEvidenceCount || 1)) sufficiency = 'FOUND';
            else if (evidenceCount > 0 && crt.allowsPartial) sufficiency = 'PARTIAL';
            else sufficiency = 'NOT FOUND';

            let penalty = 0;
            if (sufficiency === 'NOT FOUND') penalty = crt.missingPenaltyPoints || 0;
            else if (sufficiency === 'PARTIAL') penalty = crt.partialPenaltyPoints || 0;

            coveragePenalty += penalty;
            coverageResults.push({
                anchor: crt.anchorName,
                sufficiency,
                penalty,
                gapType: (sufficiency === 'FOUND') ? null : crt.gapType
            });
        }

        // ✅ FIX 3: Contradictions (CCT: ruleJson + CST: severity/penalty)
        const contradictionResults = [];
        const contradictions = await db.Contradictions.find({
            caseId: run.caseId,
            intentId: run.intentId,
            isActive: true
        });

        for (const contradiction of contradictions) {
            let triggered = false;
            // CCT logic (Rule Evaluation)
            if (contradiction.ruleJson && contradiction.ruleJson.conditions) {
                const results = contradiction.ruleJson.conditions.map(cond => {
                    const ans = allAnswers.find(a => a.questionId === cond.field);
                    if (!ans) return false;
                    return evaluateCondition(ans.answerValue, cond.operator, cond.value);
                });

                if (contradiction.ruleJson.operator === 'AND') triggered = results.every(r => r === true);
                else if (contradiction.ruleJson.operator === 'OR') triggered = results.some(r => r === true);
            }

            if (triggered) {
                contradictionResults.push({
                    contradictionId: contradiction.contradictionId,
                    contradictionName: contradiction.contradictionName,
                    // CST logic (Severity & Penalty)
                    severity: contradiction.severityBand || 'MEDIUM',
                    penaltyScore: contradiction.accuracyPenaltyPoints || 0
                });
            }
        }

        // ✅ FIX 4: Red Flag Uniqueness Check
        const redFlagResults = [];
        const allRedFlags = await db.RedFlagTaxonomy.find({
            caseId: run.caseId,
            intentId: run.intentId,
            isActive: true
        });

        const triggeredFlagIds = new Set();
        for (const flag of allRedFlags) {
            let triggered = false;

            if (flag.triggerSource === 'QUESTION_ANSWER') {
                const answer = allAnswers.find(a => a.questionId === flag.triggerReferenceId);
                if (answer) triggered = evaluateCondition(answer.answerValue, flag.ruleJson?.op || 'eq', flag.ruleJson?.value || '');
            } else if (flag.triggerSource === 'CONSTRAINT' || flag.triggerSource === 'CONSTRAINT_SCORE') {
                const constraint = constraintResults.find(c => c.constraintId === flag.triggerReferenceId);
                if (constraint && (constraint.band === 'CRITICAL' || constraint.band === 'FRAGILE')) triggered = true;
            } else if (flag.triggerSource === 'CONTRADICTION') {
                const contra = contradictionResults.find(c => c.contradictionId === flag.triggerReferenceId);
                if (contra) triggered = true;
            }

            // EXPLICIT UNIQUENESS CHECK
            if (triggered) {
                if (flag.uniquenessMode === 'UNIQUE' && triggeredFlagIds.has(flag.redFlagId)) {
                    continue; // Skip duplicate
                }
                triggeredFlagIds.add(flag.redFlagId);
                redFlagResults.push({
                    redFlagId: flag.redFlagId,
                    redFlagName: flag.redFlagName,
                    severityBand: flag.severityBand,
                    penaltyPoints: flag.penaltyPoints || 0,
                    remediationCode: flag.remediationCode || null, // ✅ Point #6.4
                    triggerSource: flag.triggerSource,
                    triggerReferenceId: flag.triggerReferenceId
                });
            }
        }

        // Warnings Mapping
        const warningResults = [];
        for (const flag of redFlagResults) {
            const warning = await db.Warnings.findOne({ redFlagId: flag.redFlagId, isActive: true });
            if (warning) warningResults.push({
                warningId: warning.warningId,
                warningTitle: warning.warningTitle,
                warningMessage: warning.warningMessage,
                severityBand: warning.severityBand,
                displayPriority: warning.displayPriority || 99
            });
        }
        warningResults.sort((a, b) => a.displayPriority - b.displayPriority);

        // Score Calculation
        const policy = await db.AccuracyScoringPolicy.findOne({ caseId: run.caseId, intentId: run.intentId, isActive: true });
        if (!policy) return res.status(404).json({ success: false, message: 'Accuracy policy not found' });

        let accuracyScore = policy.baseScore || 100;
        const totalPenalty = Math.min(
            contradictionResults.reduce((sum, c) => sum + c.penaltyScore, 0) +
            redFlagResults.reduce((sum, f) => sum + f.penaltyPoints, 0) +
            coveragePenalty,
            policy.maxTotalPenalty || 75
        );

        accuracyScore = Math.max(accuracyScore - totalPenalty, policy.floorScore || 0);

        let accuracyBand = 'VERY_LOW';
        if (policy.bandRulesJson) {
            const bands = policy.bandRulesJson;
            if (accuracyScore >= bands.HIGH?.min) accuracyBand = 'HIGH';
            else if (accuracyScore >= bands.MEDIUM?.min) accuracyBand = 'MEDIUM';
            else if (accuracyScore >= bands.LOW?.min) accuracyBand = 'LOW';
        }

        // ✅ FIX 5: Integrity Pack (Single RAS Artifact)
        const integrityPackId = `RAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const integrityPack = {
            runId,
            stepNo: 4,
            accuracy: { accuracyScore, accuracyBand, totalPenalty },
            constraints: constraintResults,
            coverage: { results: coverageResults, totalPenalty: coveragePenalty },
            contradictions: contradictionResults,
            redFlags: redFlagResults,
            warnings: warningResults,
            requiresEscalation: accuracyScore <= (policy.escalationThresholdScore || 40)
        };

        await db.Ras.create({
            rasId: integrityPackId,
            runId,
            stepNo: 4,
            artifactType: 'INTEGRITY_PACK',
            artifactVersion: 1,
            artifactJson: integrityPack,
            status: 'FINAL'
        });

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId: integrityPackId,
                ...integrityPack,
                message: 'Integrity engine completed successfully.'
            }
        });

    } catch (error) {
        console.error("[Integrity Engine Error]", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
