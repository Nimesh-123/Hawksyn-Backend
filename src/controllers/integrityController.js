const { db } = require('../models/index.model.js');
const notificationService = require('../services/notificationService');
const {
    getConstraintBand,
    evaluateRuleJson,
    calculateQuestionScore,
    evaluateCondition,
    calculateVltVerdict
} = require('../../utils/evaluationHelpers.js');


const SEVERITY_ORDER = { LOW: 1, PARTIAL: 2, FULL: 3, CRITICAL: 4 };

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
    const { runId } = req.params;

    try {
        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
        
        const allowedStatuses = ['PROFILE_CONFIRMED', 'QUESTIONS_CONFIRMED', 'SIGNALS_COLLECTED', 'INTEGRITY_COMPLETE', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED', 'PROCESSING_FAILED', 'CASE_FILE_LOCKED'];
        if (!allowedStatuses.includes(run.status)) {
            return res.status(400).json({ success: false, message: `Invalid state for analysis: ${run.status}` });
        }

        // --- STAGE 1: EXTRACTING ---
        await db.Runs.updateOne({ runId }, { $set: { status: 'EXTRACTING', failureStep: null, failureReason: null } });

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
                const signalSource = data.signals || data.coverage || [];
                if (Array.isArray(signalSource)) {
                    signalSource.forEach(s => allSignals.push(s));
                } else if (typeof signalSource === 'object' && signalSource !== null) {
                    const nested = signalSource.signals || signalSource.coverage || [];
                    if (Array.isArray(nested)) {
                        nested.forEach(s => allSignals.push(s));
                    }
                }
            });

        if (allAnswers.length === 0) {
            throw new Error('No objective inputs found. Complete Step 3 (Questions) first.');
        }

        // --- STAGE 2: CONTRA_CHECK (Logic Engine) ---
        await db.Runs.updateOne({ runId }, { $set: { status: 'CONTRA_CHECK' } });

        const evaluationLib = await db.EvaluationLibraryRegistry.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });

        if (!evaluationLib) throw new Error('Evaluation config (ELR) not found for this playbook.');

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
            for (const mapping of mappings) {
                const scored = scoredAnswers.find(s => s.questionId === mapping.questionId);
                if (!scored) continue;
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
        
        for (const crt of crtMap) {
            let evidenceCount = 0;
            const sources = typeof crt.requiredSourcesJson === 'string' ? JSON.parse(crt.requiredSourcesJson) : crt.requiredSourcesJson;

            const qIds = sources?.questionIds || sources?.mcq_fields || sources?.question_ids || [];
            if (qIds.length > 0) {
                evidenceCount += qIds.filter(qid => allAnswers.some(a => a.questionId === qid)).length;
            }

            if (sources?.externalSignalIds || sources?.external_signal_ids) {
                const sIds = sources?.externalSignalIds || sources?.external_signal_ids || [];
                evidenceCount += sIds.filter(sid => allSignals.some(s => s.signalId === sid)).length;
            }

            const pFields = sources?.profileFields || sources?.profile_fields || [];
            const cFields = sources?.cvFields || sources?.cv_fields || [];
            const allCandidateFields = [...new Set([...pFields, ...cFields])];

            if (allCandidateFields.length > 0) {
                evidenceCount += allCandidateFields.reduce((sum, field) => {
                    const val = getDeepValue(profileSnapshot, field);
                    if (val === undefined || val === null || val === '' || val === 'N/A') return sum;
                    if (Array.isArray(val)) return sum + val.length;
                    return sum + 1;
                }, 0);
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

            coverageResults.push({ anchor: crt.anchorName, sufficiency, penalty });
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

        // --- STAGE 3: SYNTHESIZING (Output Generation) ---
        await db.Runs.updateOne({ runId }, { $set: { status: 'SYNTHESIZING' } });

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

        let policy = await db.AccuracyScoringPolicy.findOne({ caseId: run.caseId, intentId: { $in: [run.intentId, 'ALL'] } });
        if (!policy) throw new Error('Accuracy scoring policy not found.');

        let accuracyScore = policy.baseScore || 100;
        const totalPenalty = Math.min(
            contradictionResults.reduce((sum, c) => sum + (c.accuracyPenaltyScore || 0), 0) +
            redFlagResults.reduce((sum, f) => sum + f.penaltyPoints, 0) +
            coveragePenalty,
            policy.maxTotalPenalty || 75
        );
        accuracyScore = Math.max(accuracyScore - totalPenalty, policy.floorScore || 0);

        let accuracyBand = 'LOW';
        const bands = policy.bandRulesJson || {};
        if (accuracyScore >= (bands.HIGH?.min || 80)) accuracyBand = 'FULL';
        else if (accuracyScore >= (bands.MEDIUM?.min || 60)) accuracyBand = 'PARTIAL';
        else accuracyBand = 'LOW';

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
        
        const { verdict, compositeScore, confidence } = await calculateVltVerdict(db, {
            caseId: run.caseId,
            intentId: run.intentId,
            constraintResults,
            accuracyScore
        });

        const integrityPackId = `RAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const integrityPack = {
            runId, stepNo: 4, verdict, compositeScore, confidence,
            accuracy: {
                score: accuracyScore,
                band: accuracyBand,
                totalPenalty: totalPenalty,
                escalationRequired: accuracyScore <= (policy.escalationThresholdScore || 40)
            },
            constraints: { results: constraintResults, hasTerminalFailure, terminalConstraints },
            coverage: { results: coverageResults, totalPenalty: coveragePenalty },
            contradictions: { triggered: contradictionResults },
            redFlags: { triggered: redFlagResults },
            warnings: warningResults,
            hasTerminalFailure,
            requiresEscalation: accuracyScore <= (policy.escalationThresholdScore || 40)
        };

        await db.Ras.create({
            rasId: integrityPackId, runId, stepNo: 4, artifactType: 'INTEGRITY_PACK',
            artifactVersion: 1, artifactJson: integrityPack, status: 'FINAL'
        });

        await db.Runs.updateOne({ runId }, { $set: { status: 'INTEGRITY_COMPLETE' } });

        // --- NEW: Step 4 In-Session Alerts (#3 & #4) ---
        try {
            const user = await db.User.findById(run.userId);
            if (user) {
                if (integrityPack.contradictions.triggered.length > 0) {
                    await notificationService.notifyContradictionDetected(runId, user);
                }
                if (integrityPack.coverage.totalPenalty > 4) { // Threshold for "Significant" missing data
                    await notificationService.notifyMissingDataWarning(runId, user);
                }
            }
        } catch (notifErr) {
            console.error('[Integrity-Notify] Failed to send in-session alerts:', notifErr.message);
        }

        // Trigger Success Notification (Existing)
        notificationService.notifyProcessingSuccess(runId);

        const totalDuration = (Date.now() - startTime) / 1000;

        return res.status(200).json({
            success: true,
            data: {
                runId,
                verdict: integrityPack.verdict,
                accuracy: integrityPack.accuracy,
                processingDuration: `${totalDuration}s`,
                message: 'Integrity engine completed successfully.'
            }
        });

    } catch (error) {
        console.error("[Integrity Engine Error]", error);
        
        // --- SAFE ERROR HANDLING ---
        const currentRun = await db.Runs.findOne({ runId });
        const failureStep = currentRun?.status || 'UNKNOWN';
        
        await db.Runs.updateOne({ runId }, { 
            $set: { 
                status: 'PROCESSING_FAILED',
                failureStep: failureStep,
                failureReason: error.message
            } 
        });

        // Trigger Failure Notification to System Admin
        notificationService.notifyProcessingFailure(runId, failureStep, error.message);

        return res.status(500).json({ 
            success: false, 
            message: error.message,
            failureStep: failureStep
        });
    }
};
