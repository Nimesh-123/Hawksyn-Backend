const OpenAI = require('openai');

/**
 * 1. PROMPT HELPER — Generate market signal analysis prompt
 */
function buildSignalPrompt({ role, industry, orgSize, intentName, caseName }) {
    return `You are a professional career risk analyst with expertise in labour market intelligence.

Based on the following profile, provide a factual assessment of current market conditions.

Profile:
- Current Role: ${role}
- Industry: ${industry}
- Organization Size: ${orgSize}
- Assessment Type: ${caseName}
- User Intent: ${intentName}

Return ONLY a JSON object. No markdown. No explanation. No text before or after.
The entire response must be directly parseable by JSON.parse().

Required JSON structure:
{
  "marketDemandSignal": {
    "value": "HIGH | MEDIUM | LOW | DECLINING",
    "rationale": "One factual sentence about current demand for this role type.",
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "aiDisplacementRisk": {
    "value": "HIGH | MEDIUM | LOW",
    "rationale": "One factual sentence about AI impact risk for this role type.",
    "confidence": "HIGH | MEDIUM | LOW",
    "timelineMonths": 24
  },
  "industryHiringTrend": {
    "value": "GROWING | STABLE | CONTRACTING",
    "rationale": "One factual sentence about hiring in this industry.",
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "automationOverlapScore": {
    "value": 45,
    "rationale": "One factual sentence about automatable tasks in this role.",
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "dataQuality": "COMPLETE | PARTIAL | INSUFFICIENT",
  "analystNote": "One overall sentence summarising the market position for this profile."
}

Rules:
- value fields must use exactly the enum options listed.
- automationOverlapScore.value must be a number 0-100 (no quotes).
- aiDisplacementRisk.timelineMonths must be a number (no quotes).
- rationale must be exactly one sentence.
- dataQuality: COMPLETE if all 4 signals are well-supported, PARTIAL if some uncertainty, INSUFFICIENT if very limited data.
- Base your assessment on your training knowledge about this role and industry.`;
}

/**
 * 2. LLM HELPER — Call OpenAI and return cleaned JSON + usage
 */
async function callOpenAI(prompt) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const modelName = 'gpt-4o';
    
    const response = await openai.chat.completions.create({
        model: modelName,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
            {
                role: 'system',
                content: 'You are a JSON-only responder. Return only valid JSON. No markdown. No explanation. No preamble. Your entire response must be parseable by JSON.parse().'
            },
            {
                role: 'user',
                content: prompt
            }
        ]
    });

    const raw = response.choices[0].message.content || '';
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    return {
        data: JSON.parse(clean),
        usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0
        },
        model: modelName
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
