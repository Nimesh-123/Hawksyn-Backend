// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Doc Step 5: External Signal Collection
// File: controllers/signalsController.js
//
// Route : POST /api/v1/runs/:runId/signals/collect
// Trigger: AnalyzingScreen background (after Step 4 integrity/run)
// PPT   : Slide 40 — "Hawksyn will continue validation process"
//
// Purpose:
//   OpenAI ko role + industry context deke market signals collect karo.
//   Result RAS artifact 'EXTERNAL_SIGNALS_CAPTURED' mein store karo.
//   reportController.js ise padh ke SEC_003 fill karega.
// ═══════════════════════════════════════════════════════════════════

const { db }    = require('../models/index.model.js');
const OpenAI    = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────────
// HELPER 1 — buildSignalPrompt
// Profile + intent se structured OpenAI prompt banata hai.
// OpenAI ko sirf JSON return karne ki instruction hai — no markdown.
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// HELPER 2 — callOpenAI
// Clean OpenAI call — returns parsed JSON object or throws.
// ─────────────────────────────────────────────────────────────────
async function callOpenAI(prompt) {
    const response = await openai.chat.completions.create({
        model:       'gpt-4o',
        temperature: 0.2,
        max_tokens:  600,
        messages: [
            {
                role:    'system',
                content: 'You are a JSON-only responder. Return only valid JSON. No markdown. No explanation. No preamble. Your entire response must be parseable by JSON.parse().'
            },
            {
                role:    'user',
                content: prompt
            }
        ]
    });

    const raw = response.choices[0].message.content || '';

    // Strip markdown fences if OpenAI adds them anyway
    const clean = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────────────
// HELPER 3 — validateSignals
// Schema check — ensures all required fields present and typed correctly.
// ─────────────────────────────────────────────────────────────────
function validateSignals(parsed) {
    const required = [
        'marketDemandSignal',
        'aiDisplacementRisk',
        'industryHiringTrend',
        'automationOverlapScore'
    ];

    for (const key of required) {
        if (!parsed[key]) {
            return { valid: false, reason: `Missing top-level key: ${key}` };
        }
        if (!parsed[key].value) {
            return { valid: false, reason: `Missing value in: ${key}` };
        }
        if (!parsed[key].rationale) {
            return { valid: false, reason: `Missing rationale in: ${key}` };
        }
    }

    // automationOverlapScore.value must be a number
    if (typeof parsed.automationOverlapScore.value !== 'number') {
        return { valid: false, reason: 'automationOverlapScore.value must be a number' };
    }

    return { valid: true };
}

// ─────────────────────────────────────────────────────────────────
// HELPER 4 — buildCoverage
// Integrity engine ke coverage format se match karta hai.
// reportController.js ise requiredExternalAnchors ke against check karta hai.
// ─────────────────────────────────────────────────────────────────
function buildCoverage(signals) {
    const mds = signals?.marketDemandSignal;
    const adr = signals?.aiDisplacementRisk;
    const iht = signals?.industryHiringTrend;
    const aos = signals?.automationOverlapScore;

    const isFound = (sig) => sig && sig.value && sig.value !== 'UNKNOWN';

    return [
        {
            anchor:      'Market Demand Signal',
            sufficiency: isFound(mds) ? 'FOUND' : 'NOT_FOUND',
            evidence:    mds?.rationale || null
        },
        {
            anchor:      'AI Displacement Risk Signal',
            sufficiency: isFound(adr) ? 'FOUND' : 'NOT_FOUND',
            evidence:    adr?.rationale || null
        },
        {
            anchor:      'Industry Hiring Trend',
            sufficiency: isFound(iht) ? 'FOUND' : 'NOT_FOUND',
            evidence:    iht?.rationale || null
        },
        {
            anchor:      'Automation Overlap Score',
            sufficiency: isFound(aos) ? 'FOUND' : 'NOT_FOUND',
            evidence:    aos?.rationale || null
        }
    ];
}

// ─────────────────────────────────────────────────────────────────
// MAIN CONTROLLER — collectSignals
// POST /api/v1/runs/:runId/signals/collect
// ─────────────────────────────────────────────────────────────────
exports.collectSignals = async (req, res) => {
    try {
        const { runId } = req.params;

        // ── A. Load Run ──────────────────────────────────────────
        const run = await db.Runs.findOne({ runId });
        if (!run) {
            return res.status(404).json({
                success: false,
                message: `Run not found: ${runId}`
            });
        }

        // ── B. Idempotency check — already collected? ─────────────
        const existing = await db.Ras.findOne({
            runId,
            artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
            status:       'FINAL'
        });

        if (existing) {
            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId:            existing.rasId,
                    collectionStatus: 'ALREADY_COLLECTED',
                    dataQuality:      existing.artifactJson?.dataQuality || 'PARTIAL',
                    coverage:         existing.artifactJson?.coverage    || [],
                    signalsSummary: {
                        marketDemandSignal:  existing.artifactJson?.signals?.marketDemandSignal?.value  || 'UNKNOWN',
                        aiDisplacementRisk:  existing.artifactJson?.signals?.aiDisplacementRisk?.value  || 'UNKNOWN',
                        industryHiringTrend: existing.artifactJson?.signals?.industryHiringTrend?.value || 'UNKNOWN',
                        automationOverlap:   existing.artifactJson?.signals?.automationOverlapScore?.value ?? 'UNKNOWN'
                    },
                    message: 'Signals already collected for this run.'
                }
            });
        }

        // ── C. Load Profile (Step 2 RAS) ─────────────────────────
        const profileRas = await db.Ras.findOne({
            runId,
            artifactType: 'PROFILE_CONFIRMED',
            status:       'FINAL'
        });

        const profileData = profileRas?.artifactJson || {};
        const profile     = profileData.confirmedProfile
                         || profileData.profile
                         || profileData;

        // ── D. Load Intent + Case names ───────────────────────────
        const [intent, caseReg] = await Promise.all([
            db.IntentTaxonomy.findOne({ intentId: run.intentId }),
            db.CaseRegistry.findOne({ caseId: run.caseId })
        ]);

        const promptContext = {
            role:       profile?.currentRole       || profile?.role       || 'Professional',
            industry:   profile?.industry                                  || 'Technology',
            orgSize:    profile?.organizationSize  || profile?.orgSize    || 'Not specified',
            intentName: intent?.intentName                                 || 'Assess risk',
            caseName:   caseReg?.caseName                                 || 'Job Safety Assessment'
        };

        // ── E. Build prompt + call OpenAI ─────────────────────────
        const prompt = buildSignalPrompt(promptContext);

        let signals          = null;
        let collectionStatus = 'SUCCESS';
        let validationError  = null;

        try {
            const parsed     = await callOpenAI(prompt);
            const validation = validateSignals(parsed);

            if (!validation.valid) {
                // One retry with explicit correction instruction
                console.log(`[Signals] Validation failed (${validation.reason}) — retrying...`);

                const retryPrompt = `${prompt}

CORRECTION REQUIRED: Previous response failed validation.
Reason: ${validation.reason}

Return ONLY valid JSON. Fix the issue and try again.`;

                const retried          = await callOpenAI(retryPrompt);
                const retryValidation  = validateSignals(retried);

                if (!retryValidation.valid) {
                    // Use partial data, mark DEGRADED
                    signals          = retried || {};
                    collectionStatus = 'DEGRADED';
                    validationError  = retryValidation.reason;
                    console.warn(`[Signals] Retry also failed: ${retryValidation.reason}`);
                } else {
                    signals = retried;
                }

            } else {
                signals = parsed;
            }

        } catch (llmErr) {
            console.error('[Signals] OpenAI call failed:', llmErr.message);
            collectionStatus = 'FAILED';
            validationError  = llmErr.message;
            signals          = {};
        }

        // ── F. Build coverage array ───────────────────────────────
        const coverage = buildCoverage(signals);

        // ── G. Build + save RAS artifact ──────────────────────────
        const rasId = `RAS_SIG_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

        const artifactJson = {
            runId,
            caseId:           run.caseId,
            intentId:         run.intentId,
            signals,
            coverage,
            collectionStatus,
            validationError:  validationError || null,
            dataQuality:      signals?.dataQuality || 'INSUFFICIENT',
            profileUsed: {
                role:     promptContext.role,
                industry: promptContext.industry,
                orgSize:  promptContext.orgSize
            },
            collectedAt: new Date()
        };

        await db.Ras.create({
            rasId,
            runId,
            stepNo:          5,
            artifactType:    'EXTERNAL_SIGNALS_CAPTURED',
            artifactVersion: 1,
            artifactJson,
            status:          'FINAL'
        });

        // ── H. Update run status ──────────────────────────────────
        await db.Runs.updateOne(
            { runId },
            { $set: { status: 'SIGNALS_COLLECTED' } }
        );

        // ── I. Response ───────────────────────────────────────────
        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId,
                collectionStatus,
                dataQuality: signals?.dataQuality || 'INSUFFICIENT',
                coverage,
                signalsSummary: {
                    marketDemandSignal:  signals?.marketDemandSignal?.value  || 'UNKNOWN',
                    aiDisplacementRisk:  signals?.aiDisplacementRisk?.value  || 'UNKNOWN',
                    industryHiringTrend: signals?.industryHiringTrend?.value || 'UNKNOWN',
                    automationOverlap:   signals?.automationOverlapScore?.value ?? 'UNKNOWN'
                },
                analystNote: signals?.analystNote || null,
                message: collectionStatus === 'SUCCESS'
                    ? 'External signals collected successfully.'
                    : `Signals collected with status: ${collectionStatus}. SEC_003 may show partial data.`
            }
        });

    } catch (error) {
        console.error('[Signals Controller Error]', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
