const { db } = require('../models/index.model.js');
const {
    getConstraintBand,
    evaluateRuleJson,
    calculateQuestionScore,
    evaluateCondition
} = require('../../utils/evaluationHelpers.js');

const SEVERITY_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function shouldTriggerWarning(warning, currentAccuracyBand) {
    if (!warning.minSeverityBand) return true;
    return (SEVERITY_ORDER[currentAccuracyBand] || 0) >= (SEVERITY_ORDER[warning.minSeverityBand] || 0);
}

/**
 * Main Integrity Engine Entry Point.
 */
exports.runIntegrityEngine = async (req, res) => {
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
        
        const allowedStatuses = ['PROFILE_CONFIRMED', 'QUESTIONS_CONFIRMED', 'SIGNALS_COLLECTED', 'INTEGRITY_COMPLETE', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED'];
        if (!allowedStatuses.includes(run.status)) {
            return res.status(400).json({ success: false, message: `Invalid state for analysis: ${run.status}` });
        }

        const rasInputs = await db.Ras.find({ runId, status: 'FINAL' });

        const profileSnapshot = rasInputs.find(r => r.artifactType === 'PROFILE_CONFIRMED')?.artifactJson || {};

        const allAnswersMap = new Map();
        rasInputs.filter(r => r.artifactType === 'OBJECTIVE_INPUTS_CAPTURED')
            .forEach(record => {
                if (record.artifactJson.answers && Array.isArray(record.artifactJson.answers)) {
                    record.artifactJson.answers.forEach(a => {
                        const resolvedValue = a.answerLabel || a.answerValue;
                        allAnswersMap.set(a.questionId, { ...a, resolvedValue });
                    });
                }
            });

        const allAnswers = Array.from(allAnswersMap.values());
        const answersMap = {};
        allAnswers.forEach(a => {
            answersMap[a.questionId] = a.resolvedValue;
        });

        const allSignals = [];
        rasInputs.filter(r => r.artifactType === 'EXTERNAL_SIGNALS_CAPTURED')
            .forEach(record => {
                if (record.artifactJson.signals && Array.isArray(record.artifactJson.signals)) {
                    record.artifactJson.signals.forEach(s => allSignals.push(s));
                }
            });

        if (allAnswers.length === 0) {
            return res.status(400).json({ success: false, message: 'No objective inputs found. Complete Step 3 first.' });
        }

        const elr = await db.EvaluationLibraryRegistry.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });
        if (!elr) return res.status(404).json({ success: false, message: 'Evaluation config not found' });

        const scoredAnswers = [];
        for (const answer of allAnswers) {
            const q = await db.Questions.findOne({ questionId: answer.questionId });
            if (!q) continue;

            const score = calculateQuestionScore(q, answer.resolvedValue);
            scoredAnswers.push({
                questionId: answer.questionId,
                answerValue: answer.resolvedValue,
                rawScore: score,
                weight: q.defaultWeight || 1,
                scoringType: q.scoringType
            });
        }

        const constraintResults = [];
        const terminalConstraints = [];
        let hasTerminalFailure = false;

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
            const bandResult = getConstraintBand(constraint, constraintScore);

            if (bandResult.isTerminal) {
                hasTerminalFailure = true;
                terminalConstraints.push(constraint.constraintId);
            }

            constraintResults.push({
                constraintId: constraint.constraintId,
                constraintName: constraint.constraintName,
                score: constraintScore,
                band: bandResult.band,
                color: bandResult.color,
                priority: bandResult.priority,
                isTerminal: bandResult.isTerminal,
                isBlocking: constraint.isBlockingConstraint && bandResult.isTerminal
            });
        }

        const coverageResults = [];
        let coveragePenalty = 0;
        let requiresEscalation = false;

        const crtMap = await db.CoverageRequirements.find({ coverageSetId: elr.coverageSetId, isActive: true });
        const patterns = await db.DataPatternKeyTaxonomy.find({ caseId: run.caseId, intentId: run.intentId, isActive: true });

        for (const crt of crtMap) {
            let evidenceCount = 0;

            if (crt.requiredSourcesJson?.questionIds) {
                evidenceCount += crt.requiredSourcesJson.questionIds.filter(qid => allAnswers.some(a => a.questionId === qid)).length;
            }

            if (crt.requiredSourcesJson?.externalSignalIds) {
                evidenceCount += crt.requiredSourcesJson.externalSignalIds.filter(sid => allSignals.some(s => s.signalId === sid)).length;
            }

            const relatedPatterns = patterns.filter(p => p.producesAnchorName === crt.anchorName);
            for (const pattern of relatedPatterns) {
                const presentSignals = pattern.requiredSignals.filter(sid => allSignals.some(s => s.signalId === sid));
                if (presentSignals.length >= (pattern.minRequiredSignals || 1)) evidenceCount += 1;
            }

            let sufficiency = evidenceCount >= (crt.minimumEvidenceCount || 1) ? 'FOUND' : (evidenceCount > 0 && crt.allowsPartial ? 'PARTIAL' : 'NOT_FOUND');
            let penalty = sufficiency === 'NOT_FOUND' ? (crt.missingPenaltyPoints || 0) : (sufficiency === 'PARTIAL' ? (crt.partialPenaltyPoints || 0) : 0);

            coveragePenalty += penalty;
            if (crt.escalationThreshold != null && penalty >= crt.escalationThreshold) requiresEscalation = true;

            coverageResults.push({ anchor: crt.anchorName, sufficiency, penalty, gapType: (sufficiency === 'FOUND') ? null : crt.gapType });
        }

        const contradictionResults = [];
        const contradictions = await db.Contradictions.find({ caseId: run.caseId, intentId: run.intentId, isActive: true });

        for (const contradiction of contradictions) {
            if (evaluateRuleJson(contradiction.ruleJson, answersMap)) {
                contradictionResults.push({
                    contradictionId: contradiction.contradictionId,
                    contradictionName: contradiction.contradictionName,
                    severity: contradiction.severityBand || contradiction.defaultSeverityBand || 'MEDIUM',
                    accuracyPenaltyScore: contradiction.accuracyPenaltyPoints || 0,
                    confidencePenaltyScore: contradiction.confidencePenaltyPoints || 0
                });
            }
        }

        const redFlagResults = [];
        const allRedFlags = await db.RedFlagTaxonomy.find({ caseId: run.caseId, intentId: run.intentId, isActive: true });
        const triggeredFlagIds = new Set();

        for (const flag of allRedFlags) {
            let triggered = false;
            if (flag.triggerSource === 'QUESTION_ANSWER') {
                triggered = evaluateCondition(flag.triggerReferenceId, flag.ruleJson?.op || 'eq', flag.ruleJson?.value || '', answersMap);
            } else if (flag.triggerSource === 'CONSTRAINT' || flag.triggerSource === 'CONSTRAINT_SCORE') {
                const constraint = constraintResults.find(c => c.constraintId === flag.triggerReferenceId);
                if (constraint) {
                    triggered = (flag.severityBand === 'CRITICAL' && constraint.band === 'CRITICAL') ||
                                (flag.severityBand === 'HIGH' && ['CRITICAL', 'FRAGILE'].includes(constraint.band)) ||
                                (flag.severityBand === 'MEDIUM' && ['CRITICAL', 'FRAGILE', 'MODERATE'].includes(constraint.band));
                }
            } else if (flag.triggerSource === 'CONTRADICTION') {
                triggered = contradictionResults.some(c => c.contradictionId === flag.triggerReferenceId);
            }

            if (triggered) {
                if (flag.uniquenessMode === 'UNIQUE' && triggeredFlagIds.has(flag.redFlagId)) continue;
                triggeredFlagIds.add(flag.redFlagId);
                redFlagResults.push({
                    redFlagId: flag.redFlagId,
                    redFlagName: flag.redFlagName,
                    severityBand: flag.severityBand,
                    penaltyPoints: flag.penaltyPoints || 0,
                    remediationCode: flag.remediationCode || null,
                    triggerSource: flag.triggerSource,
                    triggerReferenceId: flag.triggerReferenceId
                });
            }
        }

        const policy = await db.AccuracyScoringPolicy.findOne({ caseId: run.caseId, intentId: run.intentId, isActive: true });
        if (!policy) return res.status(404).json({ success: false, message: 'Accuracy policy not found' });

        let accuracyScore = policy.baseScore || 100;
        const totalPenalty = Math.min(
            contradictionResults.reduce((sum, c) => sum + (c.accuracyPenaltyScore || 0), 0) +
            redFlagResults.reduce((sum, f) => sum + f.penaltyPoints, 0) +
            coveragePenalty,
            policy.maxTotalPenalty || 75
        );
        accuracyScore = Math.max(accuracyScore - totalPenalty, policy.floorScore || 0);

        let accuracyBand = 'VERY_LOW';
        const bands = policy.bandRulesJson || {};
        if (accuracyScore >= (bands.HIGH?.min || 80)) accuracyBand = 'HIGH';
        else if (accuracyScore >= (bands.MEDIUM?.min || 60)) accuracyBand = 'MEDIUM';
        else if (accuracyScore >= (bands.LOW?.min || 40)) accuracyBand = 'LOW';

        const warningResults = [];
        for (const flag of redFlagResults) {
            const warning = await db.Warnings.findOne({ redFlagId: flag.redFlagId, isActive: true });
            if (warning && shouldTriggerWarning(warning, accuracyBand)) {
                warningResults.push({
                    warningId: warning.warningId,
                    warningTitle: warning.warningTitle,
                    warningMessage: warning.warningMessage,
                    severityBand: warning.severityBand,
                    displayPriority: warning.displayPriority || 99
                });
            }
        }
        warningResults.sort((a, b) => a.displayPriority - b.displayPriority);

        const integrityPackId = `RAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const integrityPack = {
            runId,
            stepNo: 4,
            accuracy: {
                score: accuracyScore,
                band: accuracyBand,
                totalPenalty: totalPenalty,
                escalationRequired: requiresEscalation || accuracyScore <= (policy.escalationThresholdScore || 40)
            },
            constraints: { results: constraintResults, hasTerminalFailure, terminalConstraints },
            coverage: { results: coverageResults, totalPenalty: coveragePenalty },
            contradictions: {
                triggered: contradictionResults,
                totalPenalty: contradictionResults.reduce((sum, c) => sum + (c.accuracyPenaltyScore || 0), 0)
            },
            redFlags: {
                triggered: redFlagResults,
                totalPenalty: redFlagResults.reduce((sum, f) => sum + (f.penaltyPoints || 0), 0)
            },
            warnings: warningResults,
            hasTerminalFailure,
            requiresEscalation: requiresEscalation || accuracyScore <= (policy.escalationThresholdScore || 40)
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

        await db.Runs.updateOne({ runId }, { $set: { status: 'INTEGRITY_COMPLETE' } });

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId: integrityPackId,
                accuracy: integrityPack.accuracy,
                constraints: integrityPack.constraints,
                coverage: integrityPack.coverage,
                contradictions: integrityPack.contradictions,
                redFlags: integrityPack.redFlags,
                warnings: integrityPack.warnings,
                hasTerminalFailure,
                requiresEscalation: integrityPack.requiresEscalation,
                message: 'Integrity engine completed successfully.'
            }
        });

    } catch (error) {
        console.error("[Integrity Engine Error]", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
