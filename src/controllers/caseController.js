const CaseRegistry = require('../models/CaseRegistry.model');
const IntentTaxonomy = require('../models/IntentTaxonomy.model');
const CaseIntentConfig = require('../models/CaseIntentConfig.model');
const Playbooks = require('../models/Playbooks.model');

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

        const totalCount = await CaseRegistry.countDocuments({ isActive: true });
        const cases = await CaseRegistry.find({ isActive: true })
            .select('caseId caseName caseCategory caseDescription defaultCurrency minPrice maxPrice logoSvg')
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

        // Convert to numbers
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        // Fetch total count for this specific case
        const totalCount = await CaseIntentConfig.countDocuments({ caseId });

        // Fetch paginated configs
        const configs = await CaseIntentConfig.find({ caseId })
            .sort({ displayOrder: 1 })
            .skip(skip)
            .limit(limit);

        if (!configs || configs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No intents found for this case'
            });
        }

        const intentsList = [];
        for (const config of configs) {
            // Fetch intent details
            const intent = await IntentTaxonomy.findOne({
                intentId: config.intentId
            });

            if (intent) {
                intentsList.push({
                    intentId: intent.intentId,
                    intentName: intent.intentName,
                    intentHorizonDays: intent.intentHorizonDays,
                    intentType: intent.intentType,
                    isDefault: config.isDefault,
                    isAvailable: config.isActive,
                    availabilityLabel: config.isActive ? "Available" : "Coming Soon"
                });
            }
        }

        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            success: true,
            data: {
                intents: intentsList,
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

        const playbook = await Playbooks.findOne({
            playbookVersionId: config.playbookVersionId,
            isActive: true
        });

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
                cvMandatory: playbook.cvMandatory,
                allowedCvFormats: playbook.allowedCvFormats,
                adversarialMirrorEnabled: playbook.adversarialMirrorEnabled,
                allowedLlms: playbook.allowedLlms,
                mandatoryCvFields: playbook.mandatoryCvFields,
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
