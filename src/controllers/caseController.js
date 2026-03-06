const CaseRegistry = require('../models/CaseRegistry');
const IntentTaxonomy = require('../models/IntentTaxonomy');
const CaseIntentConfig = require('../models/CaseIntentConfig');
const Playbooks = require('../models/Playbooks');

/**
 * API 1 — GET /api/cases
 * Returns all active cases for home screen
 */
exports.getCases = async (req, res) => {
    try {
        const cases = await CaseRegistry.find({ isActive: true })
            .select('caseId caseName caseCategory caseDescription defaultCurrency minPrice maxPrice')
            .sort({ displayOrder: 1, launchStage: 1 });

        return res.status(200).json({
            success: true,
            data: cases
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

        // Fetch ALL configs for this caseId (active and inactive)
        const configs = await CaseIntentConfig.find({
            caseId
        }).sort({ displayOrder: 1 });

        if (!configs || configs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No intents found for this case'
            });
        }

        const data = [];
        for (const config of configs) {
            // Fetch intent details
            const intent = await IntentTaxonomy.findOne({
                intentId: config.intentId
            });

            if (intent) {
                data.push({
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

        if (data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No intents found for this case'
            });
        }

        return res.status(200).json({
            success: true,
            data: data
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
