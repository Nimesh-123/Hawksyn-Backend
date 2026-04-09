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

        // --- REFACTORED: EEDP-First Signal Ingestion & Derivation ---
        const eedpEntries = [];
        const finalSignalsMap = {};
        const sourceConfigs = await db.SourceRegistry.find({ isActive: true });

        if (signals && signals.signals) {
            for (const t of taxonomy) {
                const rawSig = signals.signals[t.signalId];
                if (!rawSig || rawSig.value === undefined || rawSig.value === 'UNKNOWN') continue;

                // 1. Mandatory EEDP Component Creation (AEU)
                const raw_value = rawSig.raw_value || rawSig.value; // Prefer raw numeric evidence
                const confidence_score = rawSig.confidence === 'HIGH' ? 90 : (rawSig.confidence === 'MEDIUM' ? 75 : 55);

                const aeuId = `AEU_${runId}_${t.signalId}`;
                const eedpId = `EEDP_${Date.now()}_${t.signalId}`;

                const recencyDays = t.recencyDaysMax || 180;
                const expiresAt = new Date(Date.now() + recencyDays * 24 * 60 * 60 * 1000);

                const eedpEntry = {
                    eedpId, signalId: t.signalId, runId, caseId: run.caseId,
                    sourceId: rawSig.sourceName || 'AI_MARKET_MONITOR',
                    sourceUrl: rawSig.sourceUrl || 'https://hawksyn.com/evidence',
                    citationText: rawSig.citation || rawSig.rationale || `Market evidence for ${t.signalId}`,
                    signalValue: String(raw_value), // Store raw value as evidence
                    confidenceScore: confidence_score,
                    aeuId,
                    geoScope: t.geoScope || 'GLOBAL',
                    geoValue: profile?.location || 'GLOBAL',
                    freshnessExpiresAt: expiresAt,
                    isValidated: true,
                    fetchedAt: new Date()
                };
                eedpEntries.push(eedpEntry);

                // 2. Deterministic Derivation Logic (Standardized Scales)
                let derived_value = 50; 
                let derivation_logic = 'Identity mapping';
                const clean_raw = String(raw_value).toUpperCase().replace('%', '').trim();

                const isCategorical = ['HIGH', 'MEDIUM', 'LOW'].includes(clean_raw);
                const isNumeric = !isNaN(parseFloat(clean_raw));

                if (t.signalId === 'EST_IND_002') {
                    const changePerc = parseFloat(clean_raw);
                    if (changePerc <= -20) derived_value = 15;
                    else if (changePerc <= -5) derived_value = 45;
                    else if (changePerc < 10) derived_value = 65;
                    else derived_value = 85;
                    derivation_logic = `hiring_change_percent (${changePerc}%) → score`;
                } else if (isCategorical) {
                    const scale = { 'HIGH': 85, 'MEDIUM': 55, 'LOW': 25 };
                    derived_value = scale[clean_raw];
                    // If it's a risk signal (e.g. Displacement Risk), HIGH value = LOW stability score
                    if (t.valueDirection === 'RISK' || t.signalId === 'EST_LM_001') {
                        derived_value = 100 - derived_value;
                    }
                    derivation_logic = `categorical_scale (${clean_raw}) mapping`;
                } else if (isNumeric) {
                    derived_value = parseFloat(clean_raw);
                    // Handle Inversion for risk percentages
                    if (t.valueFormat === 'PERCENT' && (t.valueDirection === 'RISK' || t.signalId.includes('RISK'))) {
                        derived_value = 100 - derived_value;
                        derivation_logic = 'Percentage inversion (risk-to-stability)';
                    } else {
                        derivation_logic = 'Direct numeric mapping';
                    }
                }

                // 3. Store Final Traceable Signal
                finalSignalsMap[t.signalId] = {
                    value: Math.round(derived_value),
                    raw_value: raw_value,
                    source_url: eedpEntry.sourceUrl,
                    citation_text: eedpEntry.citationText,
                    confidence_score: eedpEntry.confidenceScore,
                    derivation_logic
                };
            }
        }

        // Persist all Evidence and Results
        if (eedpEntries.length > 0) {
            await db.ExternalEvidenceDataPool.insertMany(eedpEntries);
        }

        // Update signals in artifactJson to include derived and traceable data
        artifactJson.signals.signals = finalSignalsMap;
        artifactJson.dataQuality = eedpEntries.length >= 3 ? 'HIGH' : 'PARTIAL';

        await db.Runs.updateOne({ runId }, { $set: { status: 'SIGNALS_COLLECTED' } });

        const totalDurationLabel = `${totalDuration.toFixed(2)}s`;

        return res.status(200).json({
            success: true,
            data: {
                runId,
                rasId,
                collectionStatus,
                dataQuality: artifactJson.dataQuality,
                coverage,
                signalsSummary: Object.entries(finalSignalsMap).reduce((acc, [k, v]) => ({ ...acc, [k]: v.value }), {}),
                analystNote: signals?.analystNote || null,
                collectionDuration: totalDurationLabel,
                message: 'External signals collected successfully.'
            }
        });

    } catch (error) {
        console.error('[Signals Controller Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
