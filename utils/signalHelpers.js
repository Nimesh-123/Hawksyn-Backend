const { generateJSON } = require('../src/services/aiProvider.js');

/**
 * 1. PROMPT HELPER — Generate dynamic market signal analysis prompt based on taxonomy
 */
function buildSignalPrompt({ role, industry, location, skills, orgSize, intentName, caseName, taxonomy = [] }) {
    const signalInstructions = taxonomy.map(t => {
        let options = "HIGH | MEDIUM | LOW";
        if (t.valueFormat === 'PERCENT') options = "0-100 number";
        else if (t.valueFormat === 'BOOLEAN') options = "TRUE | FALSE";
        else if (t.valueFormat === 'NUMERIC') options = "Number";
        
        return `  "${t.signalId}": {
    "name": "${t.signalName}",
    "category": "${t.signalCategory}",
    "value": "${options}",
    "rationale": "A detailed, evidence-based factual analysis (2-3 sentences) explaining this signal's impact for ${role} in ${industry}.",
    "sourceName": "Specific real-world data source (e.g. LinkedIn Hiring Index, MoSPI Labour Force Survey, Naukri Tech Jobs Index)",
    "sourceUrl": "Realistic URL to the source or its latest report",
    "citation": "A formal citation string for the evidence",
    "confidence": "HIGH | MEDIUM | LOW"
  }`;
    }).join(',\n');

    return `You are a professional career risk analyst with expertise in labour market intelligence.
Goal: Provide a fact-based assessment of current market conditions for the specific profile below.

STRICT PRECISION RULE:
- DO NOT provide generic sector advice.
- DO provide specific insights for the EXACT ROLE (${role}) AND SUB-INDUSTRY (${industry}).
- Base your assessment on real-world trends for this specific profile.

Profile:
- Current Role: ${role}
- Industry: ${industry}
- Location: ${location}
- Top Skills: ${skills}
- Organization Size: ${orgSize}
- Assessment Type: ${caseName}
- User Intent: ${intentName}

Return ONLY a JSON object. No markdown. No explanation.
{
  "signals": {
${signalInstructions}
  },
  "dataQuality": "COMPLETE | PARTIAL | INSUFFICIENT",
  "analystNote": "A comprehensive summary (2-3 sentences) of the overall market position for this specific ${role} profile."
}

Rules:
- value fields must match the format requested.
- rationale must be detailed and analytical.
- dataQuality: COMPLETE if specific to role/industry, PARTIAL if broad sector only.`;
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
 * 3. VALIDATION HELPER — Check if response matches expected taxonomy
 */
function validateSignals(parsed, taxonomy = []) {
    if (!parsed.signals) return { valid: false, reason: 'Missing "signals" top-level key' };
    
    for (const t of taxonomy) {
        const sig = parsed.signals[t.signalId];
        if (!sig) return { valid: false, reason: `Missing required signal: ${t.signalId} (${t.signalName})` };
        if (sig.value === undefined || sig.value === null) return { valid: false, reason: `Missing value for: ${t.signalId}` };
        if (!sig.rationale) return { valid: false, reason: `Missing rationale for: ${t.signalId}` };
        if (!sig.sourceName || !sig.sourceUrl) return { valid: false, reason: `Missing source metadata for: ${t.signalId}` };
    }

    return { valid: true };
}

/**
 * 4. COVERAGE HELPER — Map signals to evidence coverage anchors
 */
function buildCoverage(signalsData, taxonomy = []) {
    const signals = signalsData?.signals || {};
    
    return taxonomy.map(t => {
        const sig = signals[t.signalId];
        const isFound = sig && sig.value !== undefined && sig.value !== 'UNKNOWN' && sig.value !== null;
        
        return {
            signalId: t.signalId,
            anchor: t.signalName,
            sufficiency: isFound ? 'FOUND' : 'NOT_FOUND',
            evidence: sig?.rationale || null
        };
    });
}

module.exports = {
    buildSignalPrompt,
    callOpenAI,
    validateSignals,
    buildCoverage
};
