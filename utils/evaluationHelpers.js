/**
 * evaluateCondition — evaluates a single condition
 * Handles dot-notation, operator normalization, and "Label:score" format.
 */
function evaluateCondition(field, operator, value, dataMap) {
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
        evaluateCondition(c.field, c.operator, c.value, answersMap)
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
        evaluateCondition(c.field, c.op || c.operator, c.value, profileMap)
    );
    const anyPass = (ruleJson.any || []).length === 0
        ? true
        : (ruleJson.any || []).some(c =>
            evaluateCondition(c.field, c.op || c.operator, c.value, profileMap)
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
        if (optionScoreId !== null && Array.isArray(scoringMapJson)) {
            const rule = scoringMapJson.find(
                r => r.optionScore === optionScoreId
            );
            return rule ? rule.normalizedScore : 0;
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

const { GoogleGenerativeAI } = require('@google/generative-ai');
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const { aiSemaphore } = require('./concurrency.js');

/**
 * callLLM — calls Gemini or OpenAI based on promptConfig modelFamily
 */
async function callLLM({ modelFamily, systemPrompt, userPrompt, temperature = 0.3, maxTokens = 600 }) {
    await aiSemaphore.acquire();
    try {
        if (modelFamily === 'GEMINI') {
            const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const prompt = `${systemPrompt}\n\n${userPrompt}`;

            // ✅ Robust Retry logic for report sections (paid tier burst handling)
            let result = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    result = await model.generateContent(prompt);
                    break;
                } catch (err) {
                    const isRateLimit = err.message?.includes('429') || err.message?.includes('Resource exhausted');
                    if (isRateLimit && attempts < maxAttempts) {
                        console.warn(`[LLM Helper] Gemini 429. Retrying in 2s (Attempt ${attempts})...`);
                        await sleep(2000);
                        continue;
                    }
                    throw err;
                }
            }
            return result.response.text();
        }

        if (modelFamily === 'OPENAI') {
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const resp = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature,
                max_tokens: maxTokens
            });
            return resp.choices[0].message.content;
        }

        throw new Error(`callLLM: unknown modelFamily "${modelFamily}"`);
    } finally {
        aiSemaphore.release();
    }
}

module.exports = {
    evaluateCondition,
    evaluateRuleJson,
    evaluateDependencyRule,
    getConstraintBand,
    calculateQuestionScore,
    callLLM
};
