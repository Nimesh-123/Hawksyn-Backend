const CaseRegistry = require('./CaseRegistry.model.js');
const IntentTaxonomy = require('../assurance/IntentTaxonomy.model.js');
const CaseIntentConfig = require('./CaseIntentConfig.model.js');
const Playbooks = require('../assurance/Playbooks.model.js');
const Runs = require('../assurance/Runs.model.js');
const { db } = require('../../models/index.model.js');
const { createAuditLog } = require('../../../utils/auditLogger.js');


/**
 * API 1 — GET /api/cases
 * Returns all active cases for home screen
 */
exports.getCases = async (req, res) => {
    try {
        let { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'asc' } = req.query;

        // Convert to numbers
        page = parseInt(page);
        limit = parseInt(limit);

        // Validation for sortBy to prevent injection/errors
        const allowedSortFields = ['minPrice', 'maxPrice', 'caseName', 'createdAt'];
        if (!allowedSortFields.includes(sortBy)) {
            sortBy = 'createdAt';
        }

        // Prepare sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const skip = (page - 1) * limit;

        // Common Logic: Users only see active, Admins see all for editing
        const filter = { isActive: true };
        if (req.user && req.user.role === 'admin') {
            delete filter.isActive; // Admin can see everything
        }

        const totalCount = await CaseRegistry.countDocuments(filter);
        const cases = await CaseRegistry.find(filter)
            .select('caseId caseName caseCategory caseDescription defaultCurrency minPrice maxPrice logoSvg isActive')
            .sort(sort)
            .skip(skip)
            .limit(limit);


        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            success: true,
            data: {
                cases: cases,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalCount: totalCount,
                    limit: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while fetching cases'
        });
    }
};

/**
 * API 2 — GET /api/cases/:caseId/intents
 * Returns valid intents for a selected case
 */
exports.getCaseIntents = async (req, res) => {
    try {
        const { caseId } = req.params;
        let { page = 1, limit = 10 } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        // Fetch all configs for this case (we will deduplicate manually for accuracy)
        const configs = await CaseIntentConfig.find({ caseId }).sort({ displayOrder: 1 });

        if (!configs || configs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No intents found for this case'
            });
        }

        const intentsList = [];
        const seenIntents = new Set();

        for (const config of configs) {
            // Skip if we've already added this intentId
            if (seenIntents.has(config.intentId)) continue;

            const intent = await IntentTaxonomy.findOne({ intentId: config.intentId });

            if (intent) {
                seenIntents.add(config.intentId);
                
                // Check if an active playbook exists
                let playbook = null;
                if (config.playbookVersionId) {
                    playbook = await Playbooks.findOne({
                        playbookVersionId: config.playbookVersionId,
                        isActive: true
                    });
                }
                if (!playbook) {
                    playbook = await Playbooks.findOne({
                        caseId,
                        intentId: config.intentId,
                        isActive: true
                    });
                }

                intentsList.push({
                    intentId: intent.intentId,
                    intentName: intent.intentName,
                    intentHorizonDays: intent.intentHorizonDays,
                    intentType: intent.intentType,
                    isDefault: config.isDefault,
                    isAvailable: config.isActive,
                    hasPlaybook: !!playbook,
                    availabilityLabel: config.isActive ? "Available" : "Coming Soon"
                });
            }
        }

        // Sort intents so those with an active playbook appear first
        intentsList.sort((a, b) => {
            if (a.hasPlaybook === b.hasPlaybook) return 0;
            return a.hasPlaybook ? -1 : 1;
        });

        // Apply manual pagination on the unique list
        const totalCount = intentsList.length;
        const paginatedIntents = intentsList.slice(skip, skip + limit);
        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            success: true,
            data: {
                intents: paginatedIntents,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalCount: totalCount,
                    limit: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while fetching intents'
        });
    }
};

/**
 * API 3 — GET /api/cases/:caseId/intents/:intentId/playbook
 * Load active playbook for this case + intent combination
 */
exports.getPlaybook = async (req, res) => {
    try {
        const { caseId, intentId } = req.params;

        const config = await CaseIntentConfig.findOne({
            caseId,
            intentId
        });

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'No active playbook for this case and intent'
            });
        }

        // Check if intent is available
        if (!config.isActive) {
            return res.status(403).json({
                success: false,
                message: "This intent is not yet available",
                availabilityLabel: "Coming Soon"
            });
        }

        let playbook = await Playbooks.findOne({
            playbookVersionId: config.playbookVersionId,
            isActive: true
        });

        // Fallback: Find by caseId and intentId directly if playbookVersionId mapping is missing
        if (!playbook) {
            playbook = await Playbooks.findOne({
                caseId,
                intentId,
                isActive: true
            });
        }

        if (!playbook) {
            return res.status(404).json({
                success: false,
                message: 'Playbook not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                playbookVersionId: playbook.playbookVersionId,
                playbookName: playbook.playbookName,
                documentMandatory: playbook.documentMandatory,
                allowedDocumentFormats: playbook.allowedDocumentFormats,
                adversarialMirrorEnabled: playbook.adversarialMirrorEnabled,
                allowedLlms: playbook.allowedLlms,
                mandatoryDocumentFields: playbook.mandatoryDocumentFields,
                layerGuardrails: playbook.layerGuardrails
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while fetching playbook'
        });
    }
};

// API 6 — GET /api/v1/runs/:runId/snapshot
// Purpose: Detailed view for Admin when clicking a Kanban card.
exports.getRunSnapshot = async (req, res) => {
    try {
        const { runId } = req.params;
        const run = await Runs.findOne({ runId }).populate('userId', 'name email');

        if (!run) {
            return res.status(404).json({ success: false, message: "Run not found" });
        }

        // Fetch associated artifacts summary from RAS
        const artifacts = await db.Ras.find({ runId }).select('artifactType stepNo createdAt').lean();

        res.status(200).json({
            success: true,
            data: {
                runDetails: {
                    runId: run.runId,
                    status: run.status,
                    caseId: run.caseId,
                    intentId: run.intentId,
                    user: run.userId,
                    createdAt: run.createdAt,
                    updatedAt: run.updatedAt,
                    failureStep: run.failureStep,
                    failureReason: run.failureReason,
                    verdict: run.verdict
                },
                artifactManifest: artifacts.map(a => ({
                    type: a.artifactType,
                    step: a.stepNo,
                    timestamp: a.createdAt
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * API 4 — GET /api/v1/cases/pipeline/summary
 * Purpose: Kanban Dashboard logic. Groups all active runs into 4 logical stages.
 */
exports.getPipelineSummary = async (req, res) => {
    try {
        let { period, page = 1, limit = 10 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        let matchQuery = {};

        if (period && period !== 'all') {
            const now = new Date();
            let startDate = new Date();

            if (period === 'today') {
                startDate.setHours(0, 0, 0, 0);
            } else if (period === 'week') {
                startDate.setDate(now.getDate() - 7);
            } else if (period === 'month') {
                startDate.setMonth(now.getMonth() - 1);
            }

            matchQuery.updatedAt = { $gte: startDate };
        }

        const pipeline = await Runs.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    cases: {
                        $push: {
                            runId: "$runId",
                            caseId: "$caseId",
                            updatedAt: "$updatedAt",
                            createdAt: "$createdAt",
                            failureStep: "$failureStep",
                            failureReason: "$failureReason",
                            expertReviewedAt: "$expertReviewedAt"
                        }
                    }
                }
            }
        ]);

        // Map technical statuses to Logical Stages for the Admin UI
        const stages = {
            INTAKE: { count: 0, items: [], label: "In-Progress Intake" },
            ANALYSIS: { count: 0, items: [], label: "AI Analysis Active" },
            REVIEW: { count: 0, items: [], label: "Ready for Audit" },
            AUDIT: { count: 0, items: [], label: "Active Expert Audit" },
            FINALIZED: { count: 0, items: [], label: "Completed Reports" },
            FAILED: { count: 0, items: [], label: "Processing Failures" }
        };

        pipeline.forEach(p => {
            if (['CREATED', 'CV_UPLOADED', 'PROFILE_CONFIRMED'].includes(p._id)) {
                stages.INTAKE.count += p.count;
                stages.INTAKE.items.push(...p.cases);
            } else if (['QUESTIONS_CONFIRMED', 'SIGNALS_COLLECTED', 'EXTRACTING', 'CONTRA_CHECK', 'SIGNAL_PULL', 'SYNTHESIZING'].includes(p._id)) {
                stages.ANALYSIS.count += p.count;
                stages.ANALYSIS.items.push(...p.cases);
            } else if (p._id === 'INTEGRITY_COMPLETE') {
                stages.REVIEW.count += p.count;
                stages.REVIEW.items.push(...p.cases);
            } else if (p._id === 'EXPERT_ASSIGNED') {
                stages.AUDIT.count += p.count;
                stages.AUDIT.items.push(...p.cases);
            } else if (p._id === 'REPORT_COMPLETE') {
                // Split based on whether it's already reviewed
                p.cases.forEach(c => {
                    if (c.expertReviewedAt) {
                        stages.FINALIZED.count++;
                        stages.FINALIZED.items.push(c);
                    } else {
                        stages.REVIEW.count++;
                        stages.REVIEW.items.push(c);
                    }
                });
            } else if (p._id === 'PROCESSING_FAILED') {
                stages.FAILED.count += p.count;
                stages.FAILED.items.push(...p.cases);
            }
        });

        // Apply pagination and format response
        Object.keys(stages).forEach(key => {
            const totalCount = stages[key].count;
            stages[key].pagination = {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                limit: limit
            };
            stages[key].items = stages[key].items.slice(skip, skip + limit);
        });

        return res.status(200).json({ success: true, data: stages });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

