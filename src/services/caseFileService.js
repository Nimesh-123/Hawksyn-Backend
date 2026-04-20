const { db } = require('../models/index.model.js');

/**
 * Loads all RAS artifacts and builds the AEU manifest.
 */
async function buildAeuManifest(runId) {
    const manifest = [];

    // Step 2: Profile
    let profileRas = await db.Ras.findOne({
        runId,
        artifactType: 'PROFILE_CONFIRMED',
        status: 'FINAL'
    });

    if (!profileRas) {
        const run = await db.Runs.findOne({ runId });
        const profileData = run?.cvSnapshot?.parsedData;
        if (profileData) {
            console.log(`[CaseFileService] Auto-repairing missing profile RAS for run ${runId}`);
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
        artifactType: 'PROFILE_CONFIRMED',
        rasId: profileRas?.rasId || null,
        stepNo: 2,
        evidenceIds: [],
        isAvailable: !!profileRas,
        missingReason: profileRas ? null : 'Step 2 not completed'
    });

    // Step 3: Objective Inputs
    const objectiveRas = await db.Ras.findOne({
        runId,
        artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
        status: 'FINAL'
    });
    manifest.push({
        artifactType: 'OBJECTIVE_INPUTS_CAPTURED',
        rasId: objectiveRas?.rasId || null,
        stepNo: 3,
        evidenceIds: [],
        isAvailable: !!objectiveRas,
        missingReason: objectiveRas ? null : 'Step 3 not completed'
    });

    // Step 4: Integrity Pack
    const integrityRas = await db.Ras.findOne({
        runId,
        artifactType: 'INTEGRITY_PACK',
        status: 'FINAL'
    });
    manifest.push({
        artifactType: 'INTEGRITY_PACK',
        rasId: integrityRas?.rasId || null,
        stepNo: 4,
        evidenceIds: [],
        isAvailable: !!integrityRas,
        missingReason: integrityRas ? null : 'Step 4 (Integrity Engine) not run'
    });

    // Step 5: External Signals
    const signalsRas = await db.Ras.findOne({
        runId,
        artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
        status: 'FINAL'
    });
    manifest.push({
        artifactType: 'EXTERNAL_SIGNALS_CAPTURED',
        rasId: signalsRas?.rasId || null,
        stepNo: 5,
        evidenceIds: [],
        isAvailable: !!signalsRas,
        missingReason: signalsRas ? null : 'Step 5 (External Signals) not run'
    });

    return { manifest, profileRas, objectiveRas, integrityRas, signalsRas };
}

/**
 * Builds coverage summary for required artifacts.
 */
function buildCoverageSummary(manifest) {
    const missing = manifest.filter(m => !m.isAvailable).map(m => m.artifactType);
    const available = manifest.filter(m => m.isAvailable).length;

    return {
        totalArtifactsRequired: 4,
        totalArtifactsFound: available,
        missingArtifacts: missing,
        isComplete: missing.length === 0,
        degradedArtifacts: []
    };
}

/**
 * Builds a summary of external signal data quality.
 */
function buildExternalSignalSummary(signalsRas) {
    if (!signalsRas) {
        return { collected: false, dataQuality: 'INSUFFICIENT', signalsAvailable: [] };
    }

    const signals = signalsRas.artifactJson?.signals || {};
    const available = Object.entries(signals)
        .filter(([key, val]) => val && typeof val === 'object' && (val.value !== undefined && val.value !== null && val.value !== 'UNKNOWN'))
        .map(([key]) => key);

    return {
        collected: true,
        dataQuality: signalsRas.artifactJson?.dataQuality || 'PARTIAL',
        signalsAvailable: available
    };
}

/**
 * Loads taxonomy versions from Evaluation Library Registry.
 */
async function loadTaxonomyVersions(run) {
    try {
        const elr = await db.EvaluationLibraryRegistry.findOne({
            caseId: run.caseId,
            intentId: run.intentId,
            isActive: true
        });

        return {
            playbookVersionId: run.playbookVersionId || 'PBV_000001',
            constraintSetId: elr?.constraintSetId || 'CT_AI_STAY_V1',
            contradictionSetId: elr?.contradictionSetId || 'CONTR_AI_STAY_V1',
            coverageSetId: elr?.coverageSetId || 'CRT_AI_STAY_V1',
            redFlagSetId: elr?.redFlagSetId || 'RFT_AI_STAY_V1',
            accuracyPolicyId: elr?.accuracyPolicyId || 'ASP_AI_V1',
            externalSignalTaxonomyVersion: 'v1'
        };
    } catch {
        return { playbookVersionId: 'PBV_000001' };
    }
}

module.exports = {
    buildAeuManifest,
    buildCoverageSummary,
    buildExternalSignalSummary,
    loadTaxonomyVersions
};
