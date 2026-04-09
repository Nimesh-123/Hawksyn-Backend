const { db } = require('../models/index.model.js');
const { evaluateDependencyRule } = require('../../utils/evaluationHelpers.js');

/**
 * API 1 — GET /api/runs/:runId/questions/next
 */
exports.getNextQuestions = async (req, res) => {
    try {
        const { runId } = req.params;

        // 1. Find run
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }

        // Status validation: Allow fetching questions if run is in any early state
        const allowedStatuses = ['CREATED', 'CV_UPLOADED', 'PROFILE_CONFIRMED', 'QUESTIONS_CONFIRMED', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED'];
        if (!allowedStatuses.includes(run.status)) {
            return res.status(400).json({ success: false, message: `Run is not in a state to fetch questions (${run.status})` });
        }

        // 2. Find MOI
        let moi = await db.MandatoryObjectiveInput.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });
        if (!moi) {
            moi = await db.MandatoryObjectiveInput.findOne({
                caseId: run.caseId,
                intentId: run.intentId,
                isActive: true
            });
        }

        if (!moi) {
            return res.status(404).json({ success: false, message: "Mandatory objective inputs config not found for this run" });
        }

        // 3. Find all mappings sorted by displayOrder
        const allMappings = await db.MoiQuestionMapping.find({
            moiId: moi.moiId,
            isActive: true
        }).sort({ displayOrder: 1 });

        // 4. Find already answered questions from RAS
        const rasRecords = await db.Ras.find({
            runId: runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            status: 'FINAL'
        });

        const answeredQuestionIds = [];
        const allAnswerObjects = [];
        rasRecords.forEach(record => {
            if (record.artifactJson.answers && Array.isArray(record.artifactJson.answers)) {
                record.artifactJson.answers.forEach(a => {
                    answeredQuestionIds.push(a.questionId);
                    allAnswerObjects.push(a);
                });
            }
        });

        // 5. Filter out answered questions
        const remainingMappings = allMappings.filter(m => !answeredQuestionIds.includes(m.questionId));

        // 5.5 Fetch User Profile for 'profile' source dependencies
        const userProfile = await db.UserProfile.findOne({ userId: req.user.id });
        const profileData = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

        // 6. Apply dependency rules
        const dependencySkipLog = [];
        const visibleQuestions = [];

        // Prepare comprehensive data map for shared evaluation logic
        const profileMap = {
            ...profileData,
            ...allAnswerObjects.reduce((acc, a) => ({ ...acc, [a.questionId]: a.answerValue }), {})
        };

        for (const mapping of remainingMappings) {
            const rule = await db.DependencyRules.findOne({
                targetQuestionId: mapping.questionId,
                isActive: true
            });

            if (!rule) {
                visibleQuestions.push(mapping);
                continue;
            }

            const shouldShow = evaluateDependencyRule(rule.ruleJson, profileMap);

            if (shouldShow) {
                visibleQuestions.push(mapping);
            } else {
                dependencySkipLog.push({
                    questionId: mapping.questionId,
                    skipReason: rule.skipReason || 'dependency_not_met',
                    dependsOn: 'multiple_conditions'
                });
            }
        }

        // 6.5 Check if any mappings exist at all
        if (allMappings.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No questions configured for this objective (MoiQuestionMapping is empty). Check database."
            });
        }

        // 7. If no visible questions left
        if (visibleQuestions.length === 0) {
            // Update status to QUESTIONS_CONFIRMED only if it's currently in an earlier state
            const terminalSteps = ['QUESTIONS_CONFIRMED', 'SIGNALS_COLLECTED', 'INTEGRITY_COMPLETE', 'REPORT_COMPLETE', 'EXPERT_ASSIGNED'];
            if (!terminalSteps.includes(run.status)) {
                await db.Runs.updateOne({ runId }, { $set: { status: 'QUESTIONS_CONFIRMED' } });
            }

            return res.status(200).json({
                success: true,
                data: {
                    isComplete: true,
                    message: "All questions answered"
                }
            });
        }

        // 8. Take next batch of 3
        const BATCH_SIZE = 3;
        const currentBatch = visibleQuestions.slice(0, BATCH_SIZE);
        const batchNumber = rasRecords.length + 1;

        // 9. Fetch full question details
        const questionDetails = await Promise.all(
            currentBatch.map(async (mapping) => {
                const q = await db.Questions.findOne({
                    questionId: mapping.questionId
                });
                if (!q) return null;
                return {
                    questionId: q.questionId,
                    questionText: q.questionText,
                    questionType: q.questionType,
                    options: q.optionsJson || [], // Schema uses optionsJson
                    scaleMin: q.scaleMin ?? null,
                    scaleMax: q.scaleMax ?? null,
                    numericMin: q.numericMin ?? null,
                    numericMax: q.numericMax ?? null,
                    isRequired: true,
                    displayOrder: mapping.displayOrder,
                    accuracyImpactFlag: mapping.accuracyImpactFlag
                };
            })
        );

        // Filter out any potential nulls if question data is missing
        const cleanQuestionDetails = questionDetails.filter(q => q !== null);

        return res.status(200).json({
            success: true,
            data: {
                runId,
                batchNumber,
                totalQuestions: allMappings.length,
                answeredCount: answeredQuestionIds.length,
                remainingCount: visibleQuestions.length,
                isLastBatch: visibleQuestions.length <= BATCH_SIZE,
                questions: cleanQuestionDetails,
                dependencySkipLog,
                progressLabel: `${answeredQuestionIds.length}/${allMappings.length}`
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 2 — POST /api/runs/:runId/questions/answers
 */
exports.saveAnswers = async (req, res) => {
    try {
        const { runId } = req.params;
        const { batchNumber, answers } = req.body;

        if (!batchNumber || !answers || !Array.isArray(answers)) {
            return res.status(400).json({ success: false, message: "batchNumber and answers array are required" });
        }

        // 1. Find run
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }

        // 2. Check for existing record
        const existing = await db.Ras.findOne({
            runId: runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            'artifactJson.batchNumber': batchNumber
        });

        if (existing && existing.status === 'FINAL') {
            return res.status(400).json({
                success: false,
                message: "This batch is already confirmed and cannot be changed."
            });
        }

        // 3. Validate answers
        for (const answer of answers) {
            const q = await db.Questions.findOne({
                questionId: answer.questionId
            });
            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: `Question ${answer.questionId} not found`
                });
            }

            if (q.questionType === 'MCQ') {
                const options = q.optionsJson || [];
                const optionValues = options.map(o => o.opt || o);
                if (!optionValues.includes(answer.answerValue)) {
                    return res.status(400).json({
                        success: false,
                        field: answer.questionId,
                        message: `Invalid option selected for ${answer.questionId}`
                    });
                }
            }

            if (q.questionType === 'NUMERIC') {
                const val = Number(answer.answerValue);
                const min = q.validationJson?.min ?? q.numericMin ?? 0;
                const max = q.validationJson?.max ?? q.numericMax ?? 9999999;

                if (val < min || val > max) {
                    return res.status(400).json({
                        success: false,
                        field: answer.questionId,
                        message: `Value must be between ${min} and ${max}`
                    });
                }
            }

            if (q.questionType === 'SCALE') {
                const val = Number(answer.answerValue);
                const min = q.validationJson?.min ?? q.scaleMin ?? 0;
                const max = q.validationJson?.max ?? q.scaleMax ?? 10;

                if (val < min || val > max) {
                    return res.status(400).json({
                        success: false,
                        field: answer.questionId,
                        message: `Scale value must be between ${min} and ${max}`
                    });
                }
            }
        }

        // 4. Save to RAS
        const rasId = `RAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

        await db.Ras.create({
            rasId,
            runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            artifactVersion: 1,
            artifactJson: {
                batchNumber,
                answers: answers.map(a => ({
                    questionId: a.questionId,
                    answerValue: a.answerValue,
                    answerLabel: a.answerLabel || null,
                    answeredAt: new Date()
                })),
                completeness: 'PASS'
            },
            status: 'FINAL'
        });

        // 5. Check if all questions are now answered to transition status
        let moi = await db.MandatoryObjectiveInput.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });

        if (moi) {
            const allMappings = await db.MoiQuestionMapping.find({ moiId: moi.moiId, isActive: true });
            const rasRecords = await db.Ras.find({
                runId: runId,
                stepNo: 3,
                artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
                status: 'FINAL'
            });

            const answeredQuestionIds = new Set();
            rasRecords.forEach(record => {
                if (record.artifactJson.answers) {
                    record.artifactJson.answers.forEach(a => answeredQuestionIds.add(a.questionId));
                }
            });

            if (answeredQuestionIds.size >= allMappings.length) {
                await db.Runs.updateOne({ runId }, { $set: { status: 'QUESTIONS_CONFIRMED' } });
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                rasId,
                runId,
                batchNumber,
                answeredCount: answers.length,
                message: "Your answers have been recorded. They will be used to evaluate risk, constraints, and accuracy."
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 3 — GET /api/runs/:runId/questions/status
 */
exports.getQuestionsStatus = async (req, res) => {
    try {
        const { runId } = req.params;

        // 1. Find run
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }

        // 2. Find MOI
        let moi = await db.MandatoryObjectiveInput.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            playbookVersionId: run.playbookVersionId,
            isActive: true
        });

        if (!moi) {
            moi = await db.MandatoryObjectiveInput.findOne({
                caseId: run.caseId,
                intentId: run.intentId,
                isActive: true
            });
        }

        if (!moi) {
            return res.status(404).json({ success: false, message: "Mandatory objective inputs config not found for this run" });
        }

        // 3. Find all mappings
        const allMappings = await db.MoiQuestionMapping.find({
            moiId: moi.moiId,
            isActive: true
        });

        if (allMappings.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No questions configured for this objective (MoiQuestionMapping is empty). Check database."
            });
        }

        // 4. Find all RAS records & Build answer map for dependency evaluation
        const rasRecords = await db.Ras.find({
            runId: runId,
            stepNo: 3,
            artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
            status: 'FINAL'
        });

        const answerMap = {};
        let answeredCount = 0;
        rasRecords.forEach(r => {
            if (r.artifactJson.answers) {
                r.artifactJson.answers.forEach(a => {
                    const resolvedValue = a.answerLabel || a.answerValue;
                    answerMap[a.questionId] = resolvedValue;
                    answeredCount++;
                });
            }
        });

        // 5. Evaluate Skips to find "Effective" total
        const { evaluateDependencyRule } = require('../../utils/evaluationHelpers');
        let skippedCount = 0;
        const skippedQuestionIds = [];

        for (const mapping of allMappings) {
            if (answerMap[mapping.questionId] !== undefined) continue;

            const rule = await db.DependencyRules.findOne({
                targetQuestionId: mapping.questionId,
                isActive: true
            });

            if (rule && rule.ruleJson) {
                const isMet = evaluateDependencyRule(rule.ruleJson, answerMap);
                if (!isMet) {
                    skippedCount++;
                    skippedQuestionIds.push(mapping.questionId);
                }
            }
        }

        const effectiveTotal = allMappings.length - skippedCount;
        const isComplete = answeredCount >= effectiveTotal;

        return res.status(200).json({
            success: true,
            data: {
                runId,
                totalQuestions: allMappings.length,
                answeredCount,
                skippedCount,
                effectiveTotal,
                remainingCount: Math.max(0, effectiveTotal - answeredCount),
                progressLabel: `${answeredCount}/${effectiveTotal}`,
                progressPercent: effectiveTotal > 0 ? Math.round((answeredCount / effectiveTotal) * 100) : 0,
                isComplete,
                batches: rasRecords.map(r => ({
                    batchNumber: r.artifactJson.batchNumber,
                    status: r.status,
                    questionCount: r.artifactJson.answers?.length || 0,
                    confirmedAt: r.createdAt
                })),
                message: isComplete
                    ? "Your answers have been successfully recorded and locked."
                    : "Some questions are still pending."
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
