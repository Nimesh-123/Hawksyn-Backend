/**
 * evaluateCondition — evaluates a single condition
 * Handles dot-notation, operator normalization, and "Label:score" format.
 */
function evaluateCondition(field, operator, value, dataMap) {
    if (!field || typeof field !== 'string') return false;

    // Support dot-notation for nested fields (Step 3)
    const actual = field.includes('.')
        ? field.split('.').reduce((obj, key) => obj?.[key], dataMap)
        : dataMap[field];

    if (actual === undefined || actual === null) return false;

    // Normalize operator — handles EQ/EQUALS/eq, LT/LESS_THAN/lt etc.
    const op = String(operator).toUpperCase()
        .replace('EQUALS', 'EQ')
        .replace('NOT_EQUALS', 'NEQ')
        .replace('GREATER_THAN_OR_EQUAL', 'GTE')
        .replace('LESS_THAN_OR_EQUAL', 'LTE')
        .replace('GREATER_THAN', 'GT')
        .replace('LESS_THAN', 'LT');

    // Handle "Label:score" format — e.g. "Actively using AI:3" → compare against "3"
    let compareValue = value;
    if (typeof value === 'string' && value.includes(':')) {
        compareValue = value.split(':')[1].trim();
    }

    const numericAnswer = Number(actual);
    const numericValue = Number(compareValue);

    switch (op) {
        case 'EQ':
            return String(actual) === String(compareValue) ||
                String(actual) === String(value);
        case 'NEQ':
            return String(actual) !== String(compareValue) &&
                String(actual) !== String(value);
        case 'GT': return numericAnswer > numericValue;
        case 'GTE': return numericAnswer >= numericValue;
        case 'LT': return numericAnswer < numericValue;
        case 'LTE': return numericAnswer <= numericValue;
        case 'IN':
            if (Array.isArray(value)) {
                return value.some(v => {
                    const cv = typeof v === 'string' && v.includes(':')
                        ? v.split(':')[1].trim() : String(v);
                    return String(actual) === cv || String(actual) === String(v);
                });
            }
            return String(actual) === String(compareValue);
        case 'NOT_IN':
            if (Array.isArray(value)) {
                return !value.some(v => {
                    const cv = typeof v === 'string' && v.includes(':')
                        ? v.split(':')[1].trim() : String(v);
                    return String(actual) === cv;
                });
            }
            return String(actual) !== String(compareValue);
        default:
            console.warn(`evaluateCondition: unknown operator "${operator}"`);
            return false;
    }
}

/**
 * HELPER 2 — Full ruleJson evaluator (AND/OR)
 * Used by: Step 4 Contradictions
 */
function evaluateRuleJson(ruleJson, answersMap) {
    if (!ruleJson || !Array.isArray(ruleJson.conditions)) return false;

    const results = ruleJson.conditions.map(c =>
        evaluateCondition(c.field || c.questionId || c.question_id, c.operator, c.value, answersMap)
    );

    const logic = (ruleJson.operator || 'AND').toUpperCase();
    if (logic === 'AND') return results.every(Boolean);
    if (logic === 'OR') return results.some(Boolean);
    return false;
}

/**
 * HELPER 3 — DependencyRule evaluator
 * Used by: Step 3 Questions skip logic
 * ruleJson format: { all: [...], any: [...] }
 */
function evaluateDependencyRule(ruleJson, profileMap) {
    if (!ruleJson) return true;  // no rule = always show

    const allPass = (ruleJson.all || []).every(c =>
        evaluateCondition(c.field || c.questionId || c.question_id, c.op || c.operator, c.value, profileMap)
    );
    const anyPass = (ruleJson.any || []).length === 0
        ? true
        : (ruleJson.any || []).some(c =>
            evaluateCondition(c.field || c.questionId || c.question_id, c.op || c.operator, c.value, profileMap)
        );

    return allPass && anyPass;
}

/**
 * HELPER 4 — Constraint band lookup (flat fields)
 * Used by: Step 4 Integrity Engine
 */
function getConstraintBand(constraint, score) {
    if (score >= constraint.strongMin && score <= constraint.strongMax)
        return {
            band: 'STRONG', color: constraint.strongColor,
            priority: constraint.strongPriority,
            isTerminal: constraint.strongIsTerminal
        };
    if (score >= constraint.moderateMin && score <= constraint.moderateMax)
        return {
            band: 'MODERATE', color: constraint.moderateColor,
            priority: constraint.moderatePriority,
            isTerminal: constraint.moderateIsTerminal
        };
    if (score >= constraint.fragileMin && score <= constraint.fragileMax)
        return {
            band: 'FRAGILE', color: constraint.fragileColor,
            priority: constraint.fragilePriority,
            isTerminal: constraint.fragileIsTerminal
        };
    if (score >= constraint.criticalMin && score <= constraint.criticalMax)
        return {
            band: 'CRITICAL', color: constraint.criticalColor,
            priority: constraint.criticalPriority,
            isTerminal: constraint.criticalIsTerminal
        };
    return { band: 'UNKNOWN', color: null, priority: 99, isTerminal: false };
}

/**
 * HELPER 5 — Question score calculator
 * Handles MCQ_MAP and NUMERIC_RANGE
 * Used by: Step 4 constraint scoring
 */
function calculateQuestionScore(question, answerValue) {
    const { scoringType, scoringMapJson, numericMin, numericMax, outOfRangePolicy, optionsJson } = question;

    if (scoringType === 'MCQ_MAP') {
        let optionScoreId = null;

        // Case 1: answerValue is numeric (e.g. "3" or 3)
        // Score points directly saved (legacy or batch flow)
        const parsed = Number(answerValue);
        if (!isNaN(parsed) && parsed > 0 && String(answerValue).length < 5) {
            optionScoreId = parsed;
        }

        // Case 2: answerValue is a string label
        // e.g. "Somewhat unique — few people do this"
        if (optionScoreId === null && Array.isArray(optionsJson)) {
            const matched = optionsJson.find(
                o => o.opt === String(answerValue).trim()
            );
            if (matched) optionScoreId = matched.score;
        }

        // Now get normalized score from scoringMapJson
        if (optionScoreId !== null) {
            if (Array.isArray(scoringMapJson) && scoringMapJson.length > 0) {
                const rule = scoringMapJson.find(
                    r => r.optionScore === optionScoreId
                );
                return rule ? rule.normalizedScore : 0;
            }
            // Fallback: If no scoringMapJson, treat optionScoreId as the final score
            // (Common in legacy seeds where optionsJson[i].score is the 0-100 value)
            return optionScoreId;
        }

        return 0;
    }

    if (scoringType === 'NUMERIC_RANGE') {
        let num = parseFloat(answerValue);
        if (isNaN(num)) return 0;

        // Apply CLAMP if outOfRangePolicy
        if (outOfRangePolicy === 'CLAMP') {
            num = Math.max(numericMin || 0, Math.min(numericMax || 100, num));
        }

        if (Array.isArray(scoringMapJson)) {
            const rule = scoringMapJson.find(
                r => num >= r.minVal && num <= r.maxVal
            );
            return rule ? rule.normalizedScore : 0;
        }
        return 0;
    }

    return 0;
}

const { generateText } = require('../../../services/aiProvider.js');
const { aiSemaphore } = require('../../../../utils/concurrency.js');

/**
 * callLLM — calls model in hierarchy: Claude -> Gemini -> OpenAI
 * modelFamily param is legacy/ignored now to follow tiered instructions
 */
async function callLLM({ systemPrompt, userPrompt, forceProvider = null }) {
    await aiSemaphore.acquire();
    try {
        const { content, usage, provider, duration } = await generateText(userPrompt, systemPrompt, forceProvider);
        return {
            text: content,
            usageMetadata: usage,
            modelUsed: provider,
            duration
        };
    } finally {
        aiSemaphore.release();
    }
}

/**
 * HELPER 6 — Verdict Logic Engine (Stage-based Deterministic Math)
 * Used by: Step 4 Integrity Engine / Step 7 Report
 * Processes formula, banding, and confidence stages.
 */
async function calculateVltVerdict(db, { caseId, intentId, constraintResults, accuracyScore }) {
    const vltRules = await db.VerdictLogicTable.find({
        caseId,
        intentId: { $in: [intentId, 'ALL'] },
        isActive: true
    }).sort({ stage: 1, priority: 1 });

    const context = { accuracy_score: accuracyScore };
    constraintResults.forEach((res, idx) => {
        context[res.constraintId] = res.score;
        context[`C${idx + 1}`] = res.score;
    });

    // FALLBACK: If no VLT rules, calculate mean of constraints to ensure non-zero compositeScore
    if (!vltRules.length) {
        const meanScore = constraintResults.length > 0
            ? Math.round(constraintResults.reduce((acc, c) => acc + (c.score || 0), 0) / constraintResults.length)
            : 0;
        return {
            verdict: meanScore < 30 ? 'ABORT' : (meanScore < 60 ? 'PAUSE' : 'PROCEED'),
            compositeScore: meanScore,
            confidence: accuracyScore > 70 ? 'HIGH' : 'MEDIUM'
        };
    }

    let compositeScore = 0;
    let verdict = 'PAUSE';
    let confidence = 'MEDIUM';

    for (const rule of vltRules) {
        const cond = rule.conditionJson || {};
        const action = rule.actionValueJson || {};
        const stage = typeof rule.stage === 'string' ? parseInt(rule.stage.replace('STAGE_', '')) : rule.stage;

        // --- STAGE 1: Composite Score Calculation ---
        if (stage === 1 && rule.actionType === 'COMPOSITE_SCORE') {
            if (cond.formula) {
                try {
                    let formula = cond.formula;
                    Object.keys(context).forEach(key => {
                        const regex = new RegExp(`\\b${key}\\b`, 'g');
                        formula = formula.replace(regex, context[key] || 0);
                    });
                    compositeScore = eval(formula);
                    context['composite'] = compositeScore;
                } catch (e) {
                    console.error(`[VLT] Formula error in ${rule.ruleId}:`, e.message);
                }
            }
        }

        // --- STAGE 2: Verdict Selection ---
        if (stage === 2 && rule.actionType === 'VERDICT') {
            let pass = true;
            if (cond.composite_gte != null && (context.composite || compositeScore) < cond.composite_gte) pass = false;
            if (cond.composite_lt != null && (context.composite || compositeScore) >= cond.composite_lt) pass = false;

            if (pass && action.verdict) verdict = action.verdict;
        }

        // --- STAGE 3: Confidence Banding ---
        if (stage === 3 && rule.actionType === 'CONFIDENCE') {
            let pass = true;
            if (cond.accuracy_score_gte != null && accuracyScore < cond.accuracy_score_gte) pass = false;
            if (cond.accuracy_score_lt != null && accuracyScore >= cond.accuracy_score_lt) pass = false;

            if (pass && action.band) confidence = action.band;
        }
    }

    return { verdict, compositeScore: Math.round(compositeScore), confidence };
}

module.exports = {
    evaluateCondition,
    evaluateRuleJson,
    evaluateDependencyRule,
    getConstraintBand,
    calculateQuestionScore,
    calculateVltVerdict,
    callLLM
};
