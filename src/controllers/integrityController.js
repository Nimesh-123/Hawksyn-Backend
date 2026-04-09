const { db } = require('../models/index.model.js');
const {
    getConstraintBand,
    evaluateRuleJson,
    calculateQuestionScore,
    evaluateCondition,
    calculateVltVerdict
} = require('../../utils/evaluationHelpers.js');


const SEVERITY_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function getDeepValue(obj, path) {
    if (!path || !obj) return undefined;
    
    // Direct lookup first
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current && current[part] !== undefined) {
            current = current[part];
        } else {
            current = undefined;
            break;
        }
    }
    if (current !== undefined) return current;

    // Smart Lookup: Try with common prefixes or casing differences
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetSlug = slug(parts[parts.length - 1]);
    
    // Synonym mapping for common mismatches
    const synonyms = {
        'topskills': ['skills', 'topskills', 'keyskills'],
        'currentcompanyname': ['company', 'currentcompany', 'name', 'companyname'],
        'currentcompany': ['company', 'currentcompany', 'name', 'companyname'],
        'industry': ['industry', 'domainindicator', 'domain', 'sector'],
        'yearsincurrentrole': ['duration', 'tenure', 'period', 'yearsinrole', 'experience'],
        'rolestartdate': ['duration', 'tenure', 'startdate', 'period', 'role_start_date'],
        'totalexperienceyears': ['totalexperienceyears', 'yearsofexperience', 'totalyears', 'experience', 'yearsexperience', 'totalexperience'],
        'yearsexperience': ['totalexperienceyears', 'yearsofexperience', 'totalyears', 'experience', 'yearsexperience', 'totalexperience'],
        'totalexperience': ['totalexperienceyears', 'yearsofexperience', 'totalyears', 'experience', 'yearsexperience', 'totalexperience'],
        'rolehistory': ['experience', 'pastroles', 'history']
    };
    const potentialSlugs = synonyms[targetSlug] || [targetSlug];

    const recursiveSearch = (o, depth = 0) => {
        if (depth > 6 || !o || typeof o !== 'object') return undefined; // Increased depth for arrays
        
        // Check keys in this level
        for (const k in o) {
            if (potentialSlugs.includes(slug(k))) return o[k];
        }

        // Dig deeper (handle arrays too)
        for (const k in o) {
            const found = recursiveSearch(o[k], depth + 1);
            if (found !== undefined) return found;
        }
        return undefined;
    };

    return recursiveSearch(obj);
}

function shouldTriggerWarning(warning, currentAccuracyBand) {
    if (!warning.minSeverityBand) return true;
    return (SEVERITY_ORDER[currentAccuracyBand] || 0) >= (SEVERITY_ORDER[warning.minSeverityBand] || 0);
}


exports.runIntegrityEngine = async (req, res) => {
    const startTime = Date.now();
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
        
        const allowedStatuses = ['PROFILE_CONFIRMED', 'QUESTIONS_CONFIRMED', 'SIGNALS_COLLECTED', 'INTEGRITY_COMPLETE', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED'];
        if (!allowedStatuses.includes(run.status)) {
            return res.status(400).json({ success: false, message: `Invalid state for analysis: ${run.status}` });
        }

        const rasInputs = await db.Ras.find({ runId, status: 'FINAL' });

        const profileArtifact = rasInputs.find(r => r.artifactType === 'PROFILE_CONFIRMED');
        let profileSnapshot = profileArtifact?.artifactJson || run.cvSnapshot?.parsedData || {};

        // SMART UNWRAPPING: Keep the container if it has identity/work OR inferred
        let depth = 0;
        let root = profileSnapshot;
        while (depth < 3 && root && !root.identity && !root.work) {
            if (root.confirmedProfile) root = root.confirmedProfile;
            else if (root.structured) root = root.structured;
            else if (root.data) root = root.data;
            else break;
            depth++;
        }
        
        // ALWAYS Merge inferred if present in the original artifact
        const originalInferred = (profileArtifact?.artifactJson || {}).inferred || run.cvSnapshot?.parsedData?.inferred;
        if (originalInferred) {
            root = { ...root, inferred: { ...(root.inferred || {}), ...originalInferred } };
        }
        profileSnapshot = root;

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
                const data = record.artifactJson;
                // AI output often puts signals in 'signals' or 'coverage'
                const signalSource = data.signals || data.coverage || [];
                
                if (Array.isArray(signalSource)) {
                    signalSource.forEach(s => allSignals.push(s));
                } else if (typeof signalSource === 'object' && signalSource !== null) {
                    // If signals is an object, check for nested signals/coverage
                    const nested = signalSource.signals || signalSource.coverage || [];
                    if (Array.isArray(nested)) {
                        nested.forEach(s => allSignals.push(s));
                    }
                }
            });

        if (allAnswers.length === 0) {
            return res.status(400).json({ success: false, message: 'No objective inputs found. Complete Step 3 first.' });
        }

        const evaluationLib = await db.EvaluationLibraryRegistry.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });

        if (!evaluationLib) return res.status(404).json({ success: false, message: 'Evaluation config not found' });

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
            intentId: { $in: [run.intentId, 'ALL'] },
            isActive: true
        });

        for (const constraint of constraints) {
            const mappings = await db.ConstraintQuestionMapping.find({
                constraintId: constraint.constraintId,
                isActive: true
            });

            let weightedSum = 0;
            let totalWeight = 0;
            if (mappings.length === 0) {
                console.warn(`[Integrity] No CQMT mappings found for Constraint: ${constraint.constraintId}`);
            }

            for (const mapping of mappings) {
                const scored = scoredAnswers.find(s => s.questionId === mapping.questionId);
                if (!scored) {
                    console.warn(`[Integrity] No scored answer found for Question: ${mapping.questionId} in mapping for ${constraint.constraintId}`);
                    continue;
                }
                weightedSum += scored.rawScore * (mapping.contributionWeight || 1);
                totalWeight += (mapping.contributionWeight || 1);
            }

            const constraintScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
            const bandResult = getConstraintBand(constraint, constraintScore);

            if (bandResult.isTerminal && constraintScore < 20) {
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

        const crtMap = await db.CoverageRequirements.find({ coverageSetId: evaluationLib.coverageSetId, isActive: true });
        const patterns = await db.DataPatternKeyTaxonomy.find({ caseId: run.caseId, intentId: run.intentId, isActive: true });
        
        let totalAnchorsRequired = crtMap.length;
        const resolutionResults = [];

        for (const crt of crtMap) {
            let evidenceCount = 0;
            const sources = typeof crt.requiredSourcesJson === 'string' ? JSON.parse(crt.requiredSourcesJson) : crt.requiredSourcesJson;

            // 1. Check MCQ Answers
            const qIds = sources?.questionIds || sources?.mcq_fields || sources?.question_ids || [];
            if (qIds.length > 0) {
                evidenceCount += qIds.filter(qid => allAnswers.some(a => a.questionId === qid)).length;
            }

            // 2. Check External Signals
            if (sources?.externalSignalIds || sources?.external_signal_ids) {
                const sIds = sources?.externalSignalIds || sources?.external_signal_ids || [];
                evidenceCount += sIds.filter(sid => allSignals.some(s => s.signalId === sid)).length;
            }

            // 3. Check Profile/CV Data (IER Fix)
            const pFields = sources?.profileFields || sources?.profile_fields || [];
            const cFields = sources?.cvFields || sources?.cv_fields || [];
            const allCandidateFields = [...new Set([...pFields, ...cFields])];

            if (allCandidateFields.length > 0) {
                evidenceCount += allCandidateFields.reduce((sum, field) => {
                    const val = getDeepValue(profileSnapshot, field);
                    
                    if (val === undefined || val === null || val === '' || val === 'N/A') return sum;
                    
                    // If it's an array (like skills), add its length as evidence
                    if (Array.isArray(val)) return sum + val.length;
                    return sum + 1;
                }, 0);
            }

            // 4. Check Data Patterns
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

        let policy = await db.AccuracyScoringPolicy.findOne({ caseId: run.caseId, intentId: run.intentId });
        if (!policy) {
            // Fallback to "ALL" if specific intent policy is missing
            policy = await db.AccuracyScoringPolicy.findOne({ caseId: run.caseId, intentId: 'ALL' });
        }

        if (!policy) {
            console.error(`[Integrity Engine] Accuracy policy not found for Case: ${run.caseId}, Intent: ${run.intentId} or ALL`);
            return res.status(404).json({ success: false, message: 'Accuracy policy not found' });
        }

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
        
        // --- Deterministic VLT Verdict Calculation ---
        const { verdict, compositeScore, confidence } = await calculateVltVerdict(db, {
            caseId: run.caseId,
            intentId: run.intentId,
            constraintResults,
            accuracyScore
        });

        const integrityPackId = `RAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const integrityPack = {
            runId,
            stepNo: 4,
            verdict,
            compositeScore,
            confidence,
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

        const totalDuration = (Date.now() - startTime) / 1000;

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId: integrityPackId,
                verdict: integrityPack.verdict,
                compositeScore: integrityPack.compositeScore,
                confidence: integrityPack.confidence,
                accuracy: integrityPack.accuracy,
                constraints: integrityPack.constraints,
                coverage: integrityPack.coverage,
                contradictions: integrityPack.contradictions,
                redFlags: integrityPack.redFlags,
                warnings: integrityPack.warnings,
                hasTerminalFailure,
                requiresEscalation: integrityPack.requiresEscalation,
                processingDuration: `${totalDuration}s`,
                message: 'Integrity engine completed successfully.'
            }
        });

    } catch (error) {
        console.error("[Integrity Engine Error]", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
