const { generateJSON } = require('../src/services/aiProvider.js');

/**
 * 1. PROMPT HELPER — Generate market signal analysis prompt
 */
function buildSignalPrompt({ role, industry, orgSize, intentName, caseName }) {
    return `You are a professional career risk analyst with expertise in labour market intelligence.
Goal: Provide a fact-based assessment of current market conditions.

STRICT PRECISION RULE:
- DO NOT provide generic sector advice (e.g. "Technology is growing").
- DO provide specific insights for the EXACT ROLE (${role}) AND SUB-INDUSTRY (${industry}).
- If you have limited data on the niche, perform cross-industry reasoning but label the dataQuality as "PARTIAL".

Profile:
- Current Role: ${role}
- Industry: ${industry}
- Organization Size: ${orgSize}
- Assessment Type: ${caseName}
- User Intent: ${intentName}

Return ONLY a JSON object. No markdown. No explanation.
{
  "marketDemandSignal": {
    "value": "HIGH | MEDIUM | LOW | DECLINING",
    "rationale": "One specific factual sentence about demand for ${role} in ${industry}.",
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "aiDisplacementRisk": {
    "value": "HIGH | MEDIUM | LOW",
    "rationale": "One specific factual sentence about AI impact risk for ${role}.",
    "confidence": "HIGH | MEDIUM | LOW",
    "timelineMonths": 24
  },
  "industryHiringTrend": {
    "value": "GROWING | STABLE | CONTRACTING",
    "rationale": "One factual sentence about hiring specifically in ${industry}.",
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "automationOverlapScore": {
    "value": 45,
    "rationale": "One specific factual sentence about automatable tasks in ${role}.",
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "dataQuality": "COMPLETE | PARTIAL | INSUFFICIENT",
  "analystNote": "One overall sentence summarising the market position for this specific ${role} profile."
}

Rules:
- value fields must use exactly the enum options listed.
- automationOverlapScore.value must be a number 0-100 (no quotes).
- aiDisplacementRisk.timelineMonths must be a number (no quotes).
- rationale must be exactly one sentence.
- dataQuality: COMPLETE if specific to role/industry, PARTIAL if broad sector only.
- Base your assessment on real-world trends for this specific profile.`;
}

/**
 * 2. LLM HELPER — Call AI Provider and return cleaned JSON + usage
 */
async function callOpenAI(prompt) {
    const { data, usage, provider, duration } = await generateJSON(prompt);
    
    return {
        data,
        usage,
        model: provider,
        duration
    };
}

/**
 * 3. VALIDATION HELPER — Check if response matches expected schema
 */
function validateSignals(parsed) {
    const required = [
        'marketDemandSignal',
        'aiDisplacementRisk',
        'industryHiringTrend',
        'automationOverlapScore'
    ];

    for (const key of required) {
        if (!parsed[key]) return { valid: false, reason: `Missing top-level key: ${key}` };
        if (!parsed[key].value) return { valid: false, reason: `Missing value in: ${key}` };
        if (!parsed[key].rationale) return { valid: false, reason: `Missing rationale in: ${key}` };
    }

    if (typeof parsed.automationOverlapScore.value !== 'number') {
        return { valid: false, reason: 'automationOverlapScore.value must be a number' };
    }

    return { valid: true };
}

/**
 * 4. COVERAGE HELPER — Map signals to evidence coverage anchors
 */
function buildCoverage(signals) {
    const mds = signals?.marketDemandSignal;
    const adr = signals?.aiDisplacementRisk;
    const iht = signals?.industryHiringTrend;
    const aos = signals?.automationOverlapScore;

    const isFound = (sig) => sig && sig.value && sig.value !== 'UNKNOWN';

    return [
        {
            anchor: 'Market Demand Signal',
            sufficiency: isFound(mds) ? 'FOUND' : 'NOT_FOUND',
            evidence: mds?.rationale || null
        },
        {
            anchor: 'AI Displacement Risk Signal',
            sufficiency: isFound(adr) ? 'FOUND' : 'NOT_FOUND',
            evidence: adr?.rationale || null
        },
        {
            anchor: 'Industry Hiring Trend',
            sufficiency: isFound(iht) ? 'FOUND' : 'NOT_FOUND',
            evidence: iht?.rationale || null
        },
        {
            anchor: 'Automation Overlap Score',
            sufficiency: isFound(aos) ? 'FOUND' : 'NOT_FOUND',
            evidence: aos?.rationale || null
        }
    ];
}

module.exports = {
    buildSignalPrompt,
    callOpenAI,
    validateSignals,
    buildCoverage
};
