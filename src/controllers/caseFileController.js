const { db } = require('../models/index.model.js');

// ─────────────────────────────────────────────────────────────
// HELPER — buildAeuManifest
// Saare RAS artifacts load karo aur AEU manifest banao
// ─────────────────────────────────────────────────────────────
async function buildAeuManifest(runId) {
    const manifest = [];

    // Step 2: Profile
    let profileRas = await db.Ras.findOne({
        runId,
        artifactType: 'PROFILE_CONFIRMED',
        status: 'FINAL'
    });

    // ✅ AUTO-REPAIR: If RAS missing but data in Run exists (Doc Step 2 fallback)
    if (!profileRas) {
        const run = await db.Runs.findOne({ runId });
        const profileData = run?.cvSnapshot?.parsedData;
        if (profileData) {
            console.log(`[CaseFile] RAS_PROFILE missing for run ${runId} - auto-creating from cvSnapshot.`);
            const newRasId = `RAS_PROFILE_${runId}`;
            profileRas = await db.Ras.findOneAndUpdate(
                { rasId: newRasId },
                {
                    $set: {
                        runId,
                        stepNo: 2,
                        artifactType: 'PROFILE_CONFIRMED',
                        artifactVersion: 1,
                        artifactJson: profileData,
                        status: 'FINAL'
                    }
                },
                { upsert: true, new: true }
            );
        }
    }

    manifest.push({
        artifactType:  'PROFILE_CONFIRMED',
        rasId:         profileRas?.rasId         || null,
        stepNo:        2,
        evidenceIds:   [],
        isAvailable:   !!profileRas,
        missingReason: profileRas ? null : 'Step 2 not completed'
    });

    // Step 3: Objective Inputs
    const objectiveRas = await db.Ras.findOne({
        runId,
        artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
        status: 'FINAL'
    });
    manifest.push({
        artifactType:  'OBJECTIVE_INPUTS_CAPTURED',
        rasId:         objectiveRas?.rasId       || null,
        stepNo:        3,
        evidenceIds:   [],
        isAvailable:   !!objectiveRas,
        missingReason: objectiveRas ? null : 'Step 3 not completed'
    });

    // Step 4: Integrity Pack
    const integrityRas = await db.Ras.findOne({
        runId,
        artifactType: 'INTEGRITY_PACK',
        status: 'FINAL'
    });
    manifest.push({
        artifactType:  'INTEGRITY_PACK',
        rasId:         integrityRas?.rasId       || null,
        stepNo:        4,
        evidenceIds:   [],
        isAvailable:   !!integrityRas,
        missingReason: integrityRas ? null : 'Step 4 (Integrity Engine) not run'
    });

    // Step 5: External Signals
    const signalsRas = await db.Ras.findOne({
        runId,
        artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
        status: 'FINAL'
    });
    manifest.push({
        artifactType:  'EXTERNAL_SIGNALS_CAPTURED',
        rasId:         signalsRas?.rasId         || null,
        stepNo:        5,
        evidenceIds:   [],
        isAvailable:   !!signalsRas,
        missingReason: signalsRas ? null : 'Step 5 (External Signals) not run'
    });

    return { manifest, profileRas, objectiveRas, integrityRas, signalsRas };
}

// ─────────────────────────────────────────────────────────────
// HELPER — buildCoverageSummary
// ─────────────────────────────────────────────────────────────
function buildCoverageSummary(manifest) {
    const missing   = manifest.filter(m => !m.isAvailable).map(m => m.artifactType);
    const available = manifest.filter(m => m.isAvailable).length;

    return {
        totalArtifactsRequired: 4,
        totalArtifactsFound:    available,
        missingArtifacts:       missing,
        isComplete:             missing.length === 0,
        degradedArtifacts:      []
    };
}

// ─────────────────────────────────────────────────────────────
// HELPER — buildExternalSignalSummary
// ─────────────────────────────────────────────────────────────
function buildExternalSignalSummary(signalsRas) {
    if (!signalsRas) {
        return {
            collected:        false,
            dataQuality:      'INSUFFICIENT',
            signalsAvailable: []
        };
    }

    const signals  = signalsRas.artifactJson?.signals || {};
    const available = Object.entries(signals)
        .filter(([key, val]) =>
            val && typeof val === 'object' &&
            val.value && val.value !== 'UNKNOWN'
        )
        .map(([key]) => key);

    return {
        collected:        true,
        dataQuality:      signalsRas.artifactJson?.dataQuality || 'PARTIAL',
        signalsAvailable: available
    };
}

// ─────────────────────────────────────────────────────────────
// HELPER — loadTaxonomyVersions
// ELR se taxonomy versions snapshot lo
// ─────────────────────────────────────────────────────────────
async function loadTaxonomyVersions(run) {
    try {
        const elr = await db.EvaluationLibraryRegistry.findOne({
            caseId:   run.caseId,
            intentId: run.intentId,
            isActive: true
        });

        return {
            playbookVersionId:  run.playbookVersionId || 'PBV_000001',
            constraintSetId:    elr?.constraintSetId   || 'CT_AI_STAY_V1',
            contradictionSetId: elr?.contradictionSetId|| 'CONTR_AI_STAY_V1',
            coverageSetId:      elr?.coverageSetId     || 'CRT_AI_STAY_V1',
            redFlagSetId:       elr?.redFlagSetId      || 'RFT_AI_STAY_V1',
            accuracyPolicyId:   elr?.accuracyPolicyId  || 'ASP_AI_V1',
            externalSignalTaxonomyVersion: 'v1'
        };
    } catch {
        return { playbookVersionId: 'PBV_000001' };
    }
}


// ═══════════════════════════════════════════════════════════
// MAIN — buildCaseFile
// POST /api/v1/runs/:runId/case-file/build
// Doc 6.1 → 6.5
// ═══════════════════════════════════════════════════════════
exports.buildCaseFile = async (req, res) => {
    try {
        const { runId } = req.params;

        // ── A. Load Run ──
        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({
            success: false,
            message: `Run not found: ${runId}`
        });

        // ── B. Check Step 4 complete (mandatory) ──
        if (!run.integrityPack && run.status !== 'INTEGRITY_COMPLETE' &&
            run.status !== 'SIGNALS_COLLECTED') {
            return res.status(400).json({
                success: false,
                message: 'Integrity Engine must complete before Case File can be built. Run Step 4 first.'
            });
        }

        // ── C. Idempotency — already locked? ──
        const existing = await db.CaseFile.findOne({ runId, status: 'LOCKED' });
        if (existing) {
            return res.status(200).json({
                success: true,
                data: {
                    caseFileId:      existing.caseFileId,
                    status:          'ALREADY_LOCKED',
                    coverageSummary: existing.coverageSummary,
                    isImmutable:     true,
                    message:         'Case File already built and locked for this run.'
                }
            });
        }

        // ── D. Build AEU Manifest (Doc 6.2) ──
        const { manifest, profileRas, objectiveRas, integrityRas, signalsRas }
            = await buildAeuManifest(runId);

        // ── E. Build summaries ──
        const coverageSummary        = buildCoverageSummary(manifest);
        const externalSignalSummary  = buildExternalSignalSummary(signalsRas);
        const taxonomyVersions       = await loadTaxonomyVersions(run);

        // ── F. Check if previous run exists (for comparison) ──
        const previousCaseFile = await db.CaseFile.findOne({
            userId:   run.userId,
            caseId:   run.caseId,
            intentId: run.intentId,
            status:   'LOCKED',
            runId:    { $ne: runId }
        }).sort({ createdAt: -1 });

        // ── G. Create + Lock Case File (Doc 6.1 → 6.5) ──
        const caseFileId = `CF_${runId}_${Date.now()}`;

        const caseFile = await db.CaseFile.create({
            caseFileId,
            runId,
            userId:   run.userId,
            caseId:   run.caseId,
            intentId: run.intentId,

            status:       'LOCKED',    // Doc 6.3: immediately lock
            aeuManifest:  manifest,
            taxonomyVersions,
            coverageSummary,
            externalSignalSummary,

            isImmutable:             true,    // Doc 6.3
            lockedAt:                new Date(),
            isEligibleForComparison: true,    // Doc: eligible_for_comparison
            previousCaseFileId:      previousCaseFile?.caseFileId || null,

            updatedAt: new Date()
        });

        // ── H. Update Run status ──
        await db.Runs.updateOne(
            { runId },
            { $set: { status: 'CASE_FILE_LOCKED' } }
        );

        return res.status(200).json({
            success: true,
            data: {
                caseFileId,
                runId,
                status:         'LOCKED',
                isImmutable:    true,
                lockedAt:       caseFile.lockedAt,
                coverageSummary,
                externalSignalSummary,
                taxonomyVersions,
                aeuCount:       manifest.filter(m => m.isAvailable).length,
                isComplete:     coverageSummary.isComplete,
                missingArtifacts: coverageSummary.missingArtifacts,
                isEligibleForComparison: true,
                previousCaseFileId: previousCaseFile?.caseFileId || null,
                message: coverageSummary.isComplete
                    ? 'Case File built and locked successfully. All 4 artifacts present.'
                    : `Case File locked with missing artifacts: ${coverageSummary.missingArtifacts.join(', ')}. Report generation will degrade affected sections.`
            }
        });

    } catch (error) {
        console.error('[CaseFile] buildCaseFile error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════
// GET — /api/v1/runs/:runId/case-file
// Case File detail fetch karo
// ═══════════════════════════════════════════════════════════
exports.getCaseFile = async (req, res) => {
    try {
        const { runId } = req.params;
        const caseFile = await db.CaseFile.findOne({ runId }).sort({ createdAt: -1 });

        if (!caseFile) return res.status(404).json({
            success: false,
            message: 'No Case File found for this run.'
        });

        return res.status(200).json({ success: true, data: caseFile });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
