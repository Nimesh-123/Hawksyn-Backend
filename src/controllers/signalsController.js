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
                    signalsSummary: existing.artifactJson?.signals?.signals ? Object.entries(existing.artifactJson.signals.signals).slice(0, 4).reduce((acc, [k, v]) => ({ ...acc, [k]: v.value }), {}) : {},
                    analystNote: existing.artifactJson?.signals?.analystNote || null,
                    collectionDuration: existing.artifactJson?.collectionDuration || 'Unknown',
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

        // --- NEW: Fetch Dynamic Taxonomy (Task 8) ---
        const taxonomy = await db.ExternalSignalTaxonomy.find({ 
            $or: [{ caseId: run.caseId }, { caseId: 'ALL' }],
            isActive: true 
        });

        const prompt = buildSignalPrompt({ ...promptContext, taxonomy });

        let signals = null;
        let collectionStatus = 'SUCCESS';
        let validationError = null;
        let totalDuration = 0;

        try {
            const initialCall = await callOpenAI(prompt);
            let parsed = initialCall.data;
            let usage = initialCall.usage;
            totalDuration = parseFloat(initialCall.duration);

            const validation = validateSignals(parsed, taxonomy);

            if (!validation.valid) {
                const retryPrompt = `${prompt}\n\nCORRECTION REQUIRED: Previous response failed validation.\nReason: ${validation.reason}\n\nReturn ONLY valid JSON matching the taxonomy.`;
                const retryCall = await callOpenAI(retryPrompt);
                
                usage.promptTokens += retryCall.usage.promptTokens;
                usage.completionTokens += retryCall.usage.completionTokens;
                usage.totalTokens += retryCall.usage.totalTokens;
                totalDuration += parseFloat(retryCall.duration);

                const retryValidation = validateSignals(retryCall.data, taxonomy);

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

            if (signals) {
                signals.tokenUsage = usage;
                signals.collectionDuration = `${totalDuration.toFixed(2)}s`;
            }

        } catch (llmErr) {
            console.error('[Signals] AI call failed:', llmErr.message);
            collectionStatus = 'FAILED';
            validationError = llmErr.message;
            signals = {};
        }

        const coverage = buildCoverage(signals, taxonomy);
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
            collectionDuration: `${totalDuration.toFixed(2)}s`,
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

        // --- NEW: Persist to ExternalEvidenceDataPool (EEDP) with dynamic signals ---
        const eedpEntries = [];
        const sourceConfigs = await db.SourceRegistry.find({ isActive: true });

        if (signals && signals.signals) {
            for (const t of taxonomy) {
                const sig = signals.signals[t.signalId];
                if (!sig || sig.value === undefined || sig.value === 'UNKNOWN') continue;

                // 1. Deduplication (Task 11)
                const exists = await db.ExternalEvidenceDataPool.findOne({ runId, signalId: t.signalId });
                if (exists) continue;

                // 2. Dynamic Expiry (Task 13)
                const recencyDays = t.recencyDaysMax || 180;
                const expiresAt = new Date(Date.now() + recencyDays * 24 * 60 * 60 * 1000);

                // 3. Source Reliability Weighting (Task 12)
                // Default to a general AI source if no specific source mapped
                let sourceWeight = 0.7; // Default 70%
                let sourceId = 'AI_ADAPTER_OPENAI';

                // Try to find a matching source from taxonomy suggested source or registry
                const matchingSource = sourceConfigs.find(s => 
                    sig.rationale?.toLowerCase().includes(s.sourceName.toLowerCase()) || 
                    s.sourceName.toLowerCase().includes(t.signalCategory.toLowerCase())
                );

                if (matchingSource) {
                    sourceWeight = (matchingSource.minConfidenceWeight || 70) / 100;
                    sourceId = matchingSource.sourceId;
                }

                const aiConfidenceLevel = sig.confidence === 'HIGH' ? 1.0 : (sig.confidence === 'MEDIUM' ? 0.7 : 0.4);
                // Weighted Score = (AI Confidence * 0.4) + (Source Reliability * 0.6)
                const finalConfidence = (aiConfidenceLevel * 0.4) + (sourceWeight * 0.6);

                eedpEntries.push({
                    eedpId: `EEDP_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                    signalId: t.signalId,
                    sourceId,
                    caseId: run.caseId,
                    runId,
                    signalValue: String(sig.value),
                    confidenceScore: parseFloat(finalConfidence.toFixed(2)),
                    freshnessExpiresAt: expiresAt,
                    geoScope: t.geoScope || 'GLOBAL',
                    geoValue: profile?.location || 'GLOBAL',
                    sourceUrl: matchingSource?.sourceUrl || 'https://hawksyn.com/evidence',
                    citationText: sig.rationale || `Market signal for ${t.signalId} via ${sourceId}`,
                    aeuId: `AEU_${runId}`,
                    isValidated: collectionStatus === 'SUCCESS' && sourceWeight >= 0.8
                });
            }
        }

        if (eedpEntries.length > 0) {
            await db.ExternalEvidenceDataPool.insertMany(eedpEntries);
        }

        await db.Runs.updateOne({ runId }, { $set: { status: 'SIGNALS_COLLECTED' } });

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId,
                collectionStatus,
                dataQuality: signals?.dataQuality || 'INSUFFICIENT',
                coverage,
                signalsSummary: signals?.signals ? Object.entries(signals.signals).slice(0, 4).reduce((acc, [k, v]) => ({ ...acc, [k]: v.value }), {}) : {},
                analystNote: signals?.analystNote || null,
                collectionDuration: `${totalDuration.toFixed(2)}s`,
                message: 'External signals collected successfully.'
            }
        });

    } catch (error) {
        console.error('[Signals Controller Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
