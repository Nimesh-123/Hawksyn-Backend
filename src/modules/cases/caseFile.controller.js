const { db } = require('../../models/index.model.js');
const {
    buildAeuManifest,
    buildCoverageSummary,
    buildExternalSignalSummary,
    loadTaxonomyVersions
} = require('./services/caseFileService');
const s3Service = require('../../../utils/s3');

/**
 * API 1 — POST /api/v1/runs/:runId/case-file/build
 * Main entry point to build and lock the Case File for a specific run.
 */
exports.buildCaseFile = async (req, res) => {
    try {
        const { runId } = req.params;

        const run = await db.Runs.findOne({ runId });
        if (!run) return res.status(404).json({ success: false, message: `Run not found: ${runId}` });

        if (!run.integrityPack && run.status !== 'INTEGRITY_COMPLETE' && run.status !== 'SIGNALS_COLLECTED') {
            return res.status(400).json({
                success: false,
                message: 'Integrity Engine must complete before Case File can be built. Run Step 4 first.'
            });
        }

        const existing = await db.CaseFile.findOne({ runId, status: 'LOCKED' });
        if (existing) {
            return res.status(200).json({
                success: true,
                data: {
                    caseFileId: existing.caseFileId,
                    status: 'ALREADY_LOCKED',
                    coverageSummary: existing.coverageSummary,
                    isImmutable: true,
                    message: 'Case File already built and locked for this run.'
                }
            });
        }

        const { manifest, signalsRas } = await buildAeuManifest(runId);

        const coverageSummary = buildCoverageSummary(manifest);
        const externalSignalSummary = buildExternalSignalSummary(signalsRas);
        const taxonomyVersions = await loadTaxonomyVersions(run);

        const previousCaseFile = await db.CaseFile.findOne({
            userId: run.userId,
            caseId: run.caseId,
            intentId: run.intentId,
            status: 'LOCKED',
            runId: { $ne: runId }
        }).sort({ createdAt: -1 });

        const caseFileId = `CF_${runId}_${Date.now()}`;
        const caseFile = await db.CaseFile.create({
            caseFileId,
            runId,
            userId: run.userId,
            caseId: run.caseId,
            intentId: run.intentId,
            status: 'LOCKED',
            aeuManifest: manifest,
            taxonomyVersions,
            coverageSummary,
            externalSignalSummary,
            isImmutable: true,
            lockedAt: new Date(),
            isEligibleForComparison: true,
            previousCaseFileId: previousCaseFile?.caseFileId || null,
            updatedAt: new Date()
        });

        // --- NEW: Immutable S3 Snapshot (Sprint 7) ---
        try {
            await s3Service.uploadJsonSnapshot(caseFile.toObject(), 'snapshots', caseFileId);
        } catch (s3Err) {
            console.error('[CaseFile-S3] Snapshot Upload Failed:', s3Err.message);
            // Non-blocking: We still have it in DB
        }

        await db.Runs.updateOne({ runId }, { $set: { status: 'CASE_FILE_LOCKED' } });

        return res.status(200).json({
            success: true,
            data: {
                caseFileId,
                runId,
                status: 'LOCKED',
                isImmutable: true,
                lockedAt: caseFile.lockedAt,
                coverageSummary,
                externalSignalSummary,
                taxonomyVersions,
                aeuCount: manifest.filter(m => m.isAvailable).length,
                isComplete: coverageSummary.isComplete,
                missingArtifacts: coverageSummary.missingArtifacts,
                isEligibleForComparison: true,
                previousCaseFileId: previousCaseFile?.caseFileId || null,
                message: coverageSummary.isComplete
                    ? 'Case File built and locked successfully. All 4 artifacts present.'
                    : `Case File locked with missing artifacts: ${coverageSummary.missingArtifacts.join(', ')}.`
            }
        });

    } catch (error) {
        console.error('[CaseFile] Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 2 — GET /api/v1/runs/:runId/case-file
 * Retrieve locked case file for details.
 */
exports.getCaseFile = async (req, res) => {
    try {
        const { runId } = req.params;
        const caseFile = await db.CaseFile.findOne({ runId }).sort({ createdAt: -1 });

        if (!caseFile) {
            return res.status(404).json({ success: false, message: 'No Case File found for this run.' });
        }

        return res.status(200).json({ success: true, data: caseFile });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
