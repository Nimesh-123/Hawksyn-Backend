const { db } = require('../models/index.model.js');
const {
    buildSignalPrompt,
    callOpenAI,
    validateSignals,
    buildCoverage
} = require('../../utils/signalHelpers.js');

/**
 * API — POST /api/v1/runs/:runId/signals/collect
 */
exports.collectSignals = async (req, res) => {
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: `Run not found: ${runId}` });

        const existing = await db.Ras.findOne({
            runId,
            artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
            status: 'FINAL'
        });

        if (existing) {
            return res.status(200).json({
                success: true,
                data: {
                    runId,
                    rasId: existing.rasId,
                    collectionStatus: 'ALREADY_COLLECTED',
                    dataQuality: existing.artifactJson?.dataQuality || 'PARTIAL',
                    coverage: existing.artifactJson?.coverage || [],
                    signalsSummary: {
                        marketDemandSignal: existing.artifactJson?.signals?.marketDemandSignal?.value || 'UNKNOWN',
                        aiDisplacementRisk: existing.artifactJson?.signals?.aiDisplacementRisk?.value || 'UNKNOWN',
                        industryHiringTrend: existing.artifactJson?.signals?.industryHiringTrend?.value || 'UNKNOWN',
                        automationOverlap: existing.artifactJson?.signals?.automationOverlapScore?.value ?? 'UNKNOWN'
                    },
                    message: 'Signals already collected for this run.'
                }
            });
        }

        const profileRas = await db.Ras.findOne({
            runId,
            artifactType: 'PROFILE_CONFIRMED',
            status: 'FINAL'
        });

        const profileData = profileRas?.artifactJson || {};
        const profile = profileData.confirmedProfile || profileData.profile || profileData;

        const [intent, caseReg] = await Promise.all([
            db.IntentTaxonomy.findOne({ intentId: run.intentId }),
            db.CaseRegistry.findOne({ caseId: run.caseId })
        ]);

        const promptContext = {
            role: profile?.currentRole || profile?.role || 'Professional',
            industry: profile?.industry || 'Technology',
            orgSize: profile?.organizationSize || profile?.orgSize || 'Not specified',
            intentName: intent?.intentName || 'Assess risk',
            caseName: caseReg?.caseName || 'Job Safety Assessment'
        };

        const prompt = buildSignalPrompt(promptContext);

        let signals = null;
        let collectionStatus = 'SUCCESS';
        let validationError = null;

        try {
            const initialCall = await callOpenAI(prompt);
            let parsed = initialCall.data;
            let usage = initialCall.usage;

            const validation = validateSignals(parsed);

            if (!validation.valid) {
                const retryPrompt = `${prompt}\n\nCORRECTION REQUIRED: Previous response failed validation.\nReason: ${validation.reason}\n\nReturn ONLY valid JSON.`;
                const retryCall = await callOpenAI(retryPrompt);
                
                // Add tokens for both attempts
                usage.promptTokens += retryCall.usage.promptTokens;
                usage.completionTokens += retryCall.usage.completionTokens;
                usage.totalTokens += retryCall.usage.totalTokens;

                const retryValidation = validateSignals(retryCall.data);

                if (!retryValidation.valid) {
                    signals = retryCall.data || {};
                    collectionStatus = 'DEGRADED';
                    validationError = retryValidation.reason;
                } else {
                    signals = retryCall.data;
                }
            } else {
                signals = parsed;
            }

            // Save tokens for artifact metadata (Budget tracking)
            if (signals) {
                signals.tokenUsage = usage;
            }

        } catch (llmErr) {
            console.error('[Signals] OpenAI call failed:', llmErr.message);
            collectionStatus = 'FAILED';
            validationError = llmErr.message;
            signals = {};
        }

        const coverage = buildCoverage(signals);
        const rasId = `RAS_SIG_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

        const artifactJson = {
            runId,
            caseId: run.caseId,
            intentId: run.intentId,
            signals,
            coverage,
            collectionStatus,
            validationError: validationError || null,
            dataQuality: signals?.dataQuality || 'INSUFFICIENT',
            profileUsed: {
                role: promptContext.role,
                industry: promptContext.industry,
                orgSize: promptContext.orgSize
            },
            collectedAt: new Date()
        };

        await db.Ras.create({
            rasId,
            runId,
            stepNo: 5,
            artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
            artifactVersion: 1,
            artifactJson,
            status: 'FINAL'
        });

        await db.Runs.updateOne({ runId }, { $set: { status: 'SIGNALS_COLLECTED' } });

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId,
                collectionStatus,
                dataQuality: signals?.dataQuality || 'INSUFFICIENT',
                coverage,
                signalsSummary: {
                    marketDemandSignal: signals?.marketDemandSignal?.value || 'UNKNOWN',
                    aiDisplacementRisk: signals?.aiDisplacementRisk?.value || 'UNKNOWN',
                    industryHiringTrend: signals?.industryHiringTrend?.value || 'UNKNOWN',
                    automationOverlap: signals?.automationOverlapScore?.value ?? 'UNKNOWN'
                },
                analystNote: signals?.analystNote || null,
                message: 'External signals collected successfully.'
            }
        });

    } catch (error) {
        console.error('[Signals Controller Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
