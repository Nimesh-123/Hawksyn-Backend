const { db } = require('../../models/index.model.js');
const {
    buildSignalPrompt,
    callUnifiedAI,
    validateSignals,
    buildCoverage
} = require('./helpers/signalHelpers.js');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { calculateAICost } = require('../admin/helpers/aiCostHelper.js');

exports.collectSignals = async (req, res) => {
    try {
        const { runId } = req.params;

        let isDisconnected = false;
        const handleDisconnect = () => { isDisconnected = true; };
        req.on('close', handleDisconnect);
        req.on('aborted', handleDisconnect);
        req.socket.on('close', handleDisconnect);

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

        // 2. Load Assessment Details & Environment
        const [caseReg, intent] = await Promise.all([
            db.CaseRegistry.findOne({ caseId: run.caseId }),
            db.IntentTaxonomy.findOne({ intentId: run.intentId })
        ]);

        // RELENTLESS PROFILE FALLBACK: 
        // 1. Current Run Artifact
        let profile = profileRas?.artifactJson?.confirmedProfile || profileRas?.artifactJson?.profile || profileRas?.artifactJson;
        
        // 2. Run Snapshot (Crucial for Re-runs)
        if (!profile && run.cvSnapshot?.parsedData) {
            console.log(`[DEBUG-SIGNALS] Profile missing in artifacts, using cvSnapshot for run ${runId}`);
            profile = run.cvSnapshot.parsedData;
        }

        // 3. Global User Profile (Emergency backup)
        if (!profile) {
            console.log(`[DEBUG-SIGNALS] No profile for run ${runId}, falling back to latest user profile...`);
            const globalProfile = await db.UserProfile.findOne({ userId: run.userId }).sort({ updatedAt: -1 });
            profile = globalProfile?.confirmedProfile || globalProfile?.personalInfo || globalProfile;
        }

        const promptContext = {
            role: profile?.currentRoleTitle || profile?.personalInfo?.currentRoleTitle || profile?.identity?.currentRoleTitle || profile?.currentRole || profile?.role || 'Professional',
            industry: profile?.industry || profile?.personalInfo?.industry || profile?.domain || 'Technology',
            location: profile?.location || profile?.personalInfo?.location || 'Global',
            skills: Array.isArray(profile?.skills) ? profile.skills.join(', ') : (profile?.topSkills || (profile?.skills ? String(profile.skills) : 'Not specified')),
            orgSize: profile?.organizationSize || profile?.orgSize || 'Not specified',
            intentName: intent?.intentName || 'Assess risk',
            caseName: caseReg?.caseName || 'Job Safety Assessment'
        };

        // 3. Load Taxonomy & Sources
        let taxonomy = await db.ExternalSignalTaxonomy.find({ 
            $or: [{ caseId: run.caseId }, { caseId: 'ALL' }],
            isActive: true 
        });

        // SAFETY: If DB taxonomy is empty, use a baseline set to avoid empty responses
        if (!taxonomy || taxonomy.length === 0) {
            console.warn(`[DEBUG-SIGNALS] Taxonomy empty in DB. Using baseline signals for ${run.caseId}`);
            taxonomy = [
                { signalId: 'EST_AUTO_RISK', signalName: 'Automation Risk', valueFormat: 'PERCENT', description: 'Risk of role displacement by AI in 12 months' },
                { signalId: 'EST_TALENT_DEMAND', signalName: 'Market Demand', valueFormat: 'PERCENT', description: 'Growth or decline in hiring for this specific role' },
                { signalId: 'EST_SKILL_WINDOW', signalName: 'Skill Adaptation Window', valueFormat: 'PERCENT', description: 'Time remaining before current skills become obsolete' }
            ];
        }

        const prompt = buildSignalPrompt({ ...promptContext, taxonomy });

        const cacheThreshold = new Date();
        cacheThreshold.setDate(cacheThreshold.getDate() - 7); // 7-day cache window

        // 3. Signal Deduplication Check (No re-ingestion if fresh)
        const cachedSignals = await db.ExternalEvidenceDataPool.find({
            geoValue: promptContext.location,
            industry: promptContext.industry,
            role: promptContext.role, // Precise role match
            fetchedAt: { $gt: cacheThreshold }
        });

        let signals = { signals: {} };
        let collectionStatus = 'SUCCESS';
        let validationError = null;
        let totalDuration = 0;

        // Determine which signals are missing from cache
        const missingSignalIds = taxonomy
            .filter(t => !cachedSignals.find(cs => cs.signalId === t.signalId))
            .map(t => t.signalId);

        if (missingSignalIds.length === 0 && cachedSignals.length >= taxonomy.length) {
            console.log(`[Signals] Cache hit! Reusing ${cachedSignals.length} fresh signals for ${promptContext.role}`);
            cachedSignals.forEach(cs => {
                signals.signals[cs.signalId] = {
                    value: cs.signalValue,
                    raw_value: cs.signalValue,
                    sourceName: cs.sourceId,
                    sourceUrl: cs.sourceUrl,
                    citationText: cs.citationText,
                    confidence: cs.confidenceScore >= 80 ? 'HIGH' : 'MEDIUM'
                };
            });
            collectionStatus = 'CACHED';
        } else {
            console.log(`[Signals] Cache miss for ${missingSignalIds.length} signals. Calling Unified AI Research (Primary: Claude)...`);
            try {
                const initialCall = await callUnifiedAI(prompt);
                let parsed = initialCall.data;
                let usage = initialCall.usage;
                totalDuration = parseFloat(initialCall.duration);

                const validation = validateSignals(parsed, taxonomy);

                if (!validation.valid) {
                    const retryPrompt = `${prompt}\n\nCORRECTION REQUIRED: Previous response failed validation.\nReason: ${validation.reason}\n\nReturn ONLY valid JSON matching the taxonomy.`;
                    const retryCall = await callUnifiedAI(retryPrompt);
                    
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
                if (!rawSig || rawSig.value === undefined || rawSig.value === 'UNKNOWN') {
                    continue;
                }

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
                    role: promptContext.role,
                    industry: promptContext.industry,
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

        // Audit Log
        await createAuditLog(req, 'EXTERNAL_SIGNALS_FETCHED', run.userId, { 
            runId, 
            status: collectionStatus,
            signalsCount: Object.keys(finalSignalsMap).length,
            duration: totalDurationLabel 
        });

        if (isDisconnected) {
            console.log(`[Signals] Client disconnected during signal collection. Automatically continuing pipeline (Integrity, CaseFile, Report) in background for ${runId}...`);
            const caseFileController = require('../cases/caseFile.controller.js');
            const reportController = require('../assurance/report.controller.js');
            
            const mockReq = { 
                params: { runId }, 
                user: req.user, 
                isBackgroundProcess: true,
                headers: req.headers || {},
                ip: req.ip || '127.0.0.1',
                on: () => {}, 
                socket: { on: () => {} } 
            };
            const mockRes = { 
                status: () => mockRes, 
                json: (data) => {
                    // Silently handle component finishes in background
                }, 
                send: () => {} 
            };

            setImmediate(async () => {
                try {
                    const integrityPack = await db.Ras.findOne({ runId, artifactType: 'INTEGRITY_PACK', status: 'FINAL' });
                    if (!integrityPack) {
                        console.log(`[Signals-Background] Integrity Audit missing. Running Integrity Engine automatically for ${runId}...`);
                        const integrityController = require('../assurance/integrity.controller.js');
                        await integrityController.runIntegrityEngine(mockReq, mockRes);
                    }

                    await caseFileController.buildCaseFile(mockReq, mockRes);
                    await reportController.generateReport(mockReq, mockRes);
                } catch (bgErr) {
                    console.error(`[Signals-Background] Pipeline failed for ${runId}:`, bgErr.message);
                }
            });
            return;
        }

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
                tokenUsage: signals?.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                cost: signals?.tokenUsage ? calculateAICost('Gemini', signals.tokenUsage) : 0,
                message: 'External signals collected successfully.'
            }
        });

    } catch (error) {
        console.error('[Signals Controller Error]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
