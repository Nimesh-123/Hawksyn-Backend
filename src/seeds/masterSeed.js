// ════════════════════════════════════════════════════════════
// HAWKSYN — MASTER SEED SCRIPT
// Seeds all config/master data for case: CASE_AI_JOB_RISK
// Intent: INT_STAY_12M_SAFE
//
// Run: npm run seed
// ════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
require('dotenv').config();

// ── Import all models ──
const CaseRegistry = require('../models/CaseRegistry');
const IntentTaxonomy = require('../models/IntentTaxonomy');
const CvFileRules = require('../models/CvFileRules');
const Playbooks = require('../models/Playbooks');
const CaseIntentConfig = require('../models/CaseIntentConfig');
const Questions = require('../models/Questions');
const InputSchemas = require('../models/InputSchemas');
const Constraints = require('../models/Constraints');
const ConstraintQuestionMapping = require('../models/ConstraintQuestionMapping');
const Contradictions = require('../models/Contradictions');
const CoverageRequirements = require('../models/CoverageRequirements');
const RedFlagTaxonomy = require('../models/RedFlagTaxonomy');
const AccuracyScoringPolicy = require('../models/AccuracyScoringPolicy');
const Warnings = require('../models/Warnings');
const EvaluationLibraryRegistry = require('../models/EvaluationLibraryRegistry');
const GuardrailRegistry = require('../models/GuardrailRegistry');
const DecisionAssuranceSections = require('../models/DecisionAssuranceSections');
const PromptConfigRegistry = require('../models/PromptConfigRegistry');

// ════════════════════════════════════════════════════════════
// STEP 1 — case_registry
// ════════════════════════════════════════════════════════════
async function seedCaseRegistry() {
    await CaseRegistry.deleteMany({});
    await CaseRegistry.insertMany([
        {
            caseId: 'CASE_AI_JOB_RISK',
            caseName: 'Is my job secure from AI?',
            caseCategory: 'AUDIT',
            caseDescription: 'Validates whether your current role is at risk from AI disruption and what your options are.',
            launchStage: 'MVP',
            defaultCurrency: 'INR',
            minPrice: 999,
            maxPrice: 2999,
            cvRequiredDefault: true,
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 2 — intent_taxonomy
// ════════════════════════════════════════════════════════════
async function seedIntentTaxonomy() {
    await IntentTaxonomy.deleteMany({});
    await IntentTaxonomy.insertMany([
        {
            intentId: 'INT_STAY_12M_SAFE',
            intentName: 'Stay in my current role safely for next 12 months',
            intentDescription: 'Validate whether staying in the current role for 12 months is a viable and low-risk decision.',
            intentHorizonDays: 365,
            intentType: 'STABILITY',
            primaryOutcome: 'DECISION_SAFETY',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: true
        },
        {
            intentId: 'INT_SWITCH_ROLE_SAFE',
            intentName: 'Switch to a safer role in next 6 months',
            intentDescription: 'Validate whether switching roles is the right move given current AI risk signals.',
            intentHorizonDays: 180,
            intentType: 'SWITCH',
            primaryOutcome: 'TRANSITION_PLAN',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: false // Not live yet
        },
        {
            intentId: 'INT_UPSKILL_AI_PROOF',
            intentName: 'Upskill to AI-proof myself in next 3 months',
            intentHorizonDays: 90,
            intentType: 'UPSKILL',
            primaryOutcome: 'SKILL_GAP_PLAN',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: false
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 3 — cv_file_rules
// ════════════════════════════════════════════════════════════
async function seedCvFileRules() {
    await CvFileRules.deleteMany({});
    await CvFileRules.insertMany([
        {
            cvPolicyId: 'CVPOLICY_V1_STD',
            policyName: 'Standard CV Policy v1',
            policyVersion: 'v1.0',
            allowedFormats: 'PDF,DOCX',
            rejectPasswordProtected: true,
            rejectScannedOrImage: true,
            parserEngine: 'TEXT_EXTRACT_V1',
            normalisationLlm: 'GEMINI',
            promptTemplateId: 'PCR_CV_EXTRACT_V1',
            outputSchemaId: 'AEU_SCHEMA_V1',
            fieldMappingProfileId: 'FMP_STD_V1',
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 4 — playbooks
// ════════════════════════════════════════════════════════════
async function seedPlaybooks() {
    await Playbooks.deleteMany({});
    await Playbooks.insertMany([
        {
            playbookId: 'PB_AI_JOB_STABILITY',
            playbookVersionId: 'PBV_000001',
            playbookName: 'AI Job Risk — Stay Safe 12 Months',
            version: 'v1.0',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            cvPolicyId: 'CVPOLICY_V1_STD',
            cvMandatory: true,
            allowedCvFormats: 'PDF,DOCX',
            adversarialMirrorEnabled: false,
            allowedLlms: ['GEMINI', 'OPENAI'],
            normalisationLlm: 'GEMINI',
            mandatoryCvFields: [
                'current_role',
                'experience_years',
                'skills',
                'current_company',
                'domain'
            ],
            objectiveInputSchemaId: 'MOI_AI_STAY_V1',
            outputContracts: ['INTEGRITY_PACK', 'VERDICT', 'FINANCIAL_RESILIENCE', 'MARKET_SIGNALS'],
            layerGuardrails: {
                L2: 'no_hallucination',
                L3: 'citation_required',
                L4: 'certainty_cap_by_accuracy_band'
            },
            configJson: {
                verdictOptions: ['PROCEED', 'PAUSE', 'ABORT'],
                minAccuracyForProceed: 70,
                maxRedFlagsForProceed: 0
            },
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 5 — case_intent_config
// ════════════════════════════════════════════════════════════
async function seedCaseIntentConfig() {
    await CaseIntentConfig.deleteMany({});
    await CaseIntentConfig.insertMany([
        {
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            isDefault: true,
            displayOrder: 1,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            isActive: true,
            notes: 'Primary intent for MVP launch'
        },
        {
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_SWITCH_ROLE_SAFE',
            playbookVersionId: 'PBV_000002',
            isDefault: false,
            displayOrder: 2,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            isActive: false,   // Not yet live
            notes: 'Switch role intent — Phase 2'
        },
        {
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_UPSKILL_AI_PROOF',
            playbookVersionId: 'PBV_000003',
            isDefault: false,
            displayOrder: 3,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            isActive: false,   // Not yet live
            notes: 'Upskill intent — Phase 3'
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 6 — questions (with scoring rules embedded)
// ════════════════════════════════════════════════════════════
async function seedQuestions() {
    await Questions.deleteMany({});
    await Questions.insertMany([

        // Q1 — AI Role Exposure
        {
            questionId: 'Q_AI_ROLE_EXPOSURE_V1',
            questionText: 'How much of your daily work can be automated by AI tools today?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Less than 20%', score: 1 },
                { opt: '20–50%', score: 2 },
                { opt: '50–80%', score: 3 },
                { opt: 'More than 80%', score: 4 }
            ],
            scoreMode: 'DIRECT',
            defaultWeight: 0.30,
            caseScope: 'CASE_AI_JOB_RISK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            // Scoring rules embedded
            scoringRuleId: 'SR_AI_ROLE_EXPOSURE_V1',
            scoringType: 'MCQ_MAP',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'LOWER_IS_BETTER',
            curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 90 },
                { optionScore: 2, normalizedScore: 60 },
                { optionScore: 3, normalizedScore: 25 },
                { optionScore: 4, normalizedScore: 5 }
            ]
        },

        // Q2 — Financial Runway
        {
            questionId: 'Q_FINANCIAL_RUNWAY_V1',
            questionText: 'How many months of living expenses can you cover without income?',
            questionType: 'NUMERIC',
            scoreMode: 'DIRECT',
            defaultWeight: 0.25,
            validationJson: { min: 0, max: 60, unit: 'months' },
            caseScope: 'CASE_AI_JOB_RISK',
            intentScope: 'INT_STAY_12M_SAFE',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_FINANCIAL_RUNWAY_V1',
            scoringType: 'NUMERIC_RANGE',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'HIGHER_IS_BETTER',
            numericMin: 0,
            numericMax: 36,
            outOfRangePolicy: 'CLAMP',
            roundingRule: 'ROUND'
            // Score = (months / 36) * 100, capped at 100
        },

        // Q3 — Role Uniqueness
        {
            questionId: 'Q_ROLE_UNIQUENESS_V1',
            questionText: 'How unique is your role in your current company?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Easily replaceable — many people do this', score: 1 },
                { opt: 'Somewhat unique — few people do this', score: 2 },
                { opt: 'Very unique — I am the only one', score: 3 }
            ],
            scoreMode: 'DIRECT',
            defaultWeight: 0.20,
            caseScope: 'CASE_AI_JOB_RISK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_ROLE_UNIQUENESS_V1',
            scoringType: 'MCQ_MAP',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'HIGHER_IS_BETTER',
            curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 20 },
                { optionScore: 2, normalizedScore: 55 },
                { optionScore: 3, normalizedScore: 90 }
            ]
        },

        // Q4 — Company AI Policy
        {
            questionId: 'Q_COMPANY_AI_POLICY_V1',
            questionText: 'What is your company\'s current stance on AI adoption?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'No AI adoption — not on roadmap', score: 1 },
                { opt: 'Exploring AI — pilots happening', score: 2 },
                { opt: 'Actively using AI in delivery', score: 3 },
                { opt: 'AI-first — restructuring roles around AI', score: 4 }
            ],
            scoreMode: 'DIRECT',
            defaultWeight: 0.25,
            caseScope: 'CASE_AI_JOB_RISK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_COMPANY_AI_POLICY_V1',
            scoringType: 'MCQ_MAP',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'LOWER_IS_BETTER',
            curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 90 },
                { optionScore: 2, normalizedScore: 65 },
                { optionScore: 3, normalizedScore: 30 },
                { optionScore: 4, normalizedScore: 5 }
            ]
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 7 — input_schemas (MOI)
// ════════════════════════════════════════════════════════════
async function seedInputSchemas() {
    await InputSchemas.deleteMany({});
    await InputSchemas.insertMany([
        {
            moiId: 'MOI_AI_STAY_V1',
            moiName: 'AI Job Risk — Stay Safe — Mandatory Inputs v1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            version: 'v1.0',
            description: 'Mandatory objective questions for the AI job risk stay-safe validation.',
            questions: [
                {
                    questionId: 'Q_AI_ROLE_EXPOSURE_V1',
                    isMandatory: true,
                    displayOrder: 1,
                    accuracyImpactFlag: 'CRITICAL'
                },
                {
                    questionId: 'Q_FINANCIAL_RUNWAY_V1',
                    isMandatory: true,
                    displayOrder: 2,
                    accuracyImpactFlag: 'CRITICAL'
                },
                {
                    questionId: 'Q_ROLE_UNIQUENESS_V1',
                    isMandatory: true,
                    displayOrder: 3,
                    accuracyImpactFlag: 'HIGH'
                },
                {
                    questionId: 'Q_COMPANY_AI_POLICY_V1',
                    isMandatory: true,
                    displayOrder: 4,
                    accuracyImpactFlag: 'HIGH'
                }
            ],
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 8 — constraints (with thresholds embedded)
// ════════════════════════════════════════════════════════════
async function seedConstraints() {
    await Constraints.deleteMany({});
    await Constraints.insertMany([

        // C1 — Role Automation Exposure
        {
            constraintId: 'CONS_AI_001',
            constraintSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Role Automation Exposure',
            constraintDescription: 'Measures how much of the user role can be automated by AI tools.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 1,
            thresholds: [
                { bandName: 'STRONG', minScore: 80, maxScore: 100, bandPriority: 1, bandColorCode: '#2E7D32', isTerminalFailure: false },
                { bandName: 'MODERATE', minScore: 60, maxScore: 79, bandPriority: 2, bandColorCode: '#F57F17', isTerminalFailure: false },
                { bandName: 'FRAGILE', minScore: 40, maxScore: 59, bandPriority: 3, bandColorCode: '#E65100', isTerminalFailure: false },
                { bandName: 'CRITICAL', minScore: 0, maxScore: 39, bandPriority: 4, bandColorCode: '#C62828', isTerminalFailure: true }
            ],
            isActive: true
        },

        // C2 — Financial Resilience
        {
            constraintId: 'CONS_AI_002',
            constraintSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Financial Resilience',
            constraintDescription: 'Measures financial runway — ability to sustain without income.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 2,
            thresholds: [
                { bandName: 'STRONG', minScore: 80, maxScore: 100, bandPriority: 1, bandColorCode: '#2E7D32', isTerminalFailure: false },
                { bandName: 'MODERATE', minScore: 60, maxScore: 79, bandPriority: 2, bandColorCode: '#F57F17', isTerminalFailure: false },
                { bandName: 'FRAGILE', minScore: 40, maxScore: 59, bandPriority: 3, bandColorCode: '#E65100', isTerminalFailure: false },
                { bandName: 'CRITICAL', minScore: 0, maxScore: 39, bandPriority: 4, bandColorCode: '#C62828', isTerminalFailure: true }
            ],
            isActive: true
        },

        // C3 — Role Uniqueness
        {
            constraintId: 'CONS_AI_003',
            constraintSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Role Uniqueness & Replaceability',
            constraintDescription: 'Measures how replaceable the user is in their current role.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 3,
            thresholds: [
                { bandName: 'STRONG', minScore: 80, maxScore: 100, bandPriority: 1, bandColorCode: '#2E7D32', isTerminalFailure: false },
                { bandName: 'MODERATE', minScore: 60, maxScore: 79, bandPriority: 2, bandColorCode: '#F57F17', isTerminalFailure: false },
                { bandName: 'FRAGILE', minScore: 40, maxScore: 59, bandPriority: 3, bandColorCode: '#E65100', isTerminalFailure: false },
                { bandName: 'CRITICAL', minScore: 0, maxScore: 39, bandPriority: 4, bandColorCode: '#C62828', isTerminalFailure: true }
            ],
            isActive: true
        },

        // C4 — Company AI Risk
        {
            constraintId: 'CONS_AI_004',
            constraintSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Company AI Displacement Risk',
            constraintDescription: 'Measures how aggressively the company is adopting AI in delivery.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 4,
            thresholds: [
                { bandName: 'STRONG', minScore: 80, maxScore: 100, bandPriority: 1, bandColorCode: '#2E7D32', isTerminalFailure: false },
                { bandName: 'MODERATE', minScore: 60, maxScore: 79, bandPriority: 2, bandColorCode: '#F57F17', isTerminalFailure: false },
                { bandName: 'FRAGILE', minScore: 40, maxScore: 59, bandPriority: 3, bandColorCode: '#E65100', isTerminalFailure: false },
                { bandName: 'CRITICAL', minScore: 0, maxScore: 39, bandPriority: 4, bandColorCode: '#C62828', isTerminalFailure: true }
            ],
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 9 — constraint_question_mapping
// ════════════════════════════════════════════════════════════
async function seedConstraintQuestionMapping() {
    await ConstraintQuestionMapping.deleteMany({});
    await ConstraintQuestionMapping.insertMany([

        // CONS_AI_001 — Role Automation Exposure
        { cqmtId: 'CQMT_0001', constraintId: 'CONS_AI_001', questionId: 'Q_AI_ROLE_EXPOSURE_V1', scoringRuleId: 'SR_AI_ROLE_EXPOSURE_V1', contributionWeight: 0.60, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_0002', constraintId: 'CONS_AI_001', questionId: 'Q_FINANCIAL_RUNWAY_V1', scoringRuleId: 'SR_FINANCIAL_RUNWAY_V1', contributionWeight: 0.40, isRequiredForConstraint: false, normalizationMethod: 'NORMALIZED_100', isActive: true },

        // CONS_AI_002 — Financial Resilience
        { cqmtId: 'CQMT_0003', constraintId: 'CONS_AI_002', questionId: 'Q_FINANCIAL_RUNWAY_V1', scoringRuleId: 'SR_FINANCIAL_RUNWAY_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },

        // CONS_AI_003 — Role Uniqueness
        { cqmtId: 'CQMT_0004', constraintId: 'CONS_AI_003', questionId: 'Q_ROLE_UNIQUENESS_V1', scoringRuleId: 'SR_ROLE_UNIQUENESS_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },

        // CONS_AI_004 — Company AI Risk
        { cqmtId: 'CQMT_0005', constraintId: 'CONS_AI_004', questionId: 'Q_COMPANY_AI_POLICY_V1', scoringRuleId: 'SR_COMPANY_AI_POLICY_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 10 — contradictions
// ════════════════════════════════════════════════════════════
async function seedContradictions() {
    await Contradictions.deleteMany({});
    await Contradictions.insertMany([

        // CONTR_AI_001
        {
            contradictionId: 'CONTR_AI_001',
            contradictionSetId: 'CONTR_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            contradictionName: 'Active AI Adoption + Low Financial Runway',
            contradictionDescription: 'Company is actively deploying AI but user has very low financial buffer.',
            contradictionType: 'INPUT_VS_INPUT',
            involvedEntitiesJson: {
                questionIds: ['Q_COMPANY_AI_POLICY_V1', 'Q_FINANCIAL_RUNWAY_V1']
            },
            ruleJson: {
                operator: 'AND',
                conditions: [
                    { field: 'Q_COMPANY_AI_POLICY_V1', operator: 'IN', value: ['ACTIVE_AI', 'AI_FIRST'] },
                    { field: 'Q_FINANCIAL_RUNWAY_V1', operator: 'LT', value: 6 }
                ]
            },
            evaluationMode: 'STRICT',
            onMissingData: 'NOT_EVALUATED',
            severityBand: 'HIGH',
            accuracyPenaltyPoints: 15,
            isBlocking: false,
            maxTriggerCount: 1,
            isActive: true
        },

        // CONTR_AI_002
        {
            contradictionId: 'CONTR_AI_002',
            contradictionSetId: 'CONTR_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            contradictionName: 'Claims Low AI Exposure But Company Is AI-First',
            contradictionDescription: 'User claims very low AI automation exposure but company is AI-first.',
            contradictionType: 'INPUT_VS_INPUT',
            involvedEntitiesJson: {
                questionIds: ['Q_AI_ROLE_EXPOSURE_V1', 'Q_COMPANY_AI_POLICY_V1']
            },
            ruleJson: {
                operator: 'AND',
                conditions: [
                    { field: 'Q_AI_ROLE_EXPOSURE_V1', operator: 'EQ', value: 'LESS_THAN_20' },
                    { field: 'Q_COMPANY_AI_POLICY_V1', operator: 'EQ', value: 'AI_FIRST' }
                ]
            },
            evaluationMode: 'STRICT',
            onMissingData: 'NOT_EVALUATED',
            severityBand: 'MEDIUM',
            accuracyPenaltyPoints: 10,
            isBlocking: false,
            maxTriggerCount: 1,
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 11 — coverage_requirements
// ════════════════════════════════════════════════════════════
async function seedCoverageRequirements() {
    await CoverageRequirements.deleteMany({});
    await CoverageRequirements.insertMany([

        {
            crtId: 'CRT_0001',
            coverageSetId: 'CRT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            anchorName: 'Financial Resilience',
            requiredSourcesJson: { questionIds: ['Q_FINANCIAL_RUNWAY_V1'] },
            minimumEvidenceCount: 1,
            allowsPartial: false,
            missingPenaltyPoints: 10,
            partialPenaltyPoints: 5,
            reasoningBlockFlag: true,
            gapType: 'MISSING',
            stackingMode: 'CAP',
            stackingCapPoints: 10,
            displayOrder: 1,
            isActive: true
        },

        {
            crtId: 'CRT_0002',
            coverageSetId: 'CRT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            anchorName: 'Market Demand Signal',
            requiredSourcesJson: { externalSignalIds: ['EST_LM_001'] },
            minimumEvidenceCount: 1,
            allowsPartial: true,
            missingPenaltyPoints: 10,
            partialPenaltyPoints: 5,
            reasoningBlockFlag: false,
            gapType: 'MISSING',
            stackingMode: 'CAP',
            stackingCapPoints: 10,
            displayOrder: 2,
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 12 — red_flag_taxonomy
// ════════════════════════════════════════════════════════════
async function seedRedFlagTaxonomy() {
    await RedFlagTaxonomy.deleteMany({});
    await RedFlagTaxonomy.insertMany([

        {
            redFlagId: 'RF_0001',
            redFlagSetId: 'RFT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            redFlagName: 'Financial Vulnerability',
            triggerSource: 'CONSTRAINT',
            triggerReferenceId: 'CONS_AI_002',
            severityBand: 'HIGH',
            penaltyPoints: 20,
            uniquenessMode: 'UNIQUE',
            remediationCode: 'REM_FIN_PLAN',
            escalationRequired: false,
            displayOrder: 1,
            isActive: true
        },

        {
            redFlagId: 'RF_0002',
            redFlagSetId: 'RFT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            redFlagName: 'Company AI Displacement Risk',
            triggerSource: 'CONSTRAINT',
            triggerReferenceId: 'CONS_AI_004',
            severityBand: 'CRITICAL',
            penaltyPoints: 25,
            uniquenessMode: 'UNIQUE',
            remediationCode: 'REM_SKILL_UPSKILL',
            escalationRequired: true,
            displayOrder: 2,
            isActive: true
        },

        {
            redFlagId: 'RF_0003',
            redFlagSetId: 'RFT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            redFlagName: 'Active AI + Low Runway Contradiction',
            triggerSource: 'CONTRADICTION',
            triggerReferenceId: 'CONTR_AI_001',
            severityBand: 'HIGH',
            penaltyPoints: 0, // Penalty already in contradiction
            uniquenessMode: 'UNIQUE',
            escalationRequired: false,
            displayOrder: 3,
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 13 — accuracy_scoring_policy
// ════════════════════════════════════════════════════════════
async function seedAccuracyScoringPolicy() {
    await AccuracyScoringPolicy.deleteMany({});
    await AccuracyScoringPolicy.insertMany([
        {
            accuracyPolicyId: 'ASP_AI_V1',
            policyName: 'AI Job Risk Accuracy Policy v1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            baseScore: 100,
            aggregationMode: 'ADDITIVE',
            maxTotalPenalty: 75,
            floorScore: 25,
            escalationThresholdScore: 40,
            bandRulesJson: {
                HIGH: { min: 80, max: 100 },
                MEDIUM: { min: 60, max: 79 },
                LOW: { min: 40, max: 59 },
                VERY_LOW: { min: 0, max: 39 }
            },
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 14 — warnings
// ════════════════════════════════════════════════════════════
async function seedWarnings() {
    await Warnings.deleteMany({});
    await Warnings.insertMany([

        {
            warningId: 'WARN_FIN_RUNWAY_LOW',
            warningMappingId: 'WMT_AI_V1',
            redFlagId: 'RF_0001',
            triggerMode: 'ALWAYS',
            displayPriority: 1,
            warningTitle: 'Financial Cushion Is Weak',
            warningMessage: 'You have less than 6 months of financial runway. This is critically low in a period of AI-driven workforce change. If your role is disrupted, you will have very limited time to transition.',
            severityBand: 'HIGH',
            advisoryType: 'ACTION_REQUIRED',
            ctaText: 'Build a 6-month emergency fund before making any career decisions.',
            humanValidationRecommended: false,
            displayType: 'TOP_BANNER',
            isActive: true
        },

        {
            warningId: 'WARN_AI_DISPLACEMENT_HIGH',
            warningMappingId: 'WMT_AI_V1',
            redFlagId: 'RF_0002',
            triggerMode: 'ALWAYS',
            displayPriority: 2,
            warningTitle: 'Your Company Is Actively Deploying AI',
            warningMessage: 'Companies in active AI deployment phases typically reorganize roles and responsibilities within 6 to 12 months. This creates structural risk for roles with high automation overlap.',
            severityBand: 'CRITICAL',
            advisoryType: 'ACTION_REQUIRED',
            ctaText: 'Map which of your tasks are being automated and identify which skills make you irreplaceable.',
            humanValidationRecommended: true,
            displayType: 'REPORT_SECTION',
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 15 — evaluation_library_registry (LAST — links everything)
// ════════════════════════════════════════════════════════════
async function seedEvaluationLibraryRegistry() {
    await EvaluationLibraryRegistry.deleteMany({});
    await EvaluationLibraryRegistry.insertMany([
        {
            elrId: 'ELR_0001',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            constraintSetId: 'CT_AI_STAY_V1',
            contradictionSetId: 'CONTR_AI_STAY_V1',
            coverageSetId: 'CRT_AI_STAY_V1',
            redFlagSetId: 'RFT_AI_STAY_V1',
            accuracyPolicyId: 'ASP_AI_V1',
            warningMappingId: 'WMT_AI_V1',
            version: 'v1.0',
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 16 — guardrail_registry
// ════════════════════════════════════════════════════════════
async function seedGuardrailRegistry() {
    await GuardrailRegistry.deleteMany({});
    await GuardrailRegistry.insertMany([

        {
            grRuleId: 'GR_0001',
            ruleName: 'No hallucination — only AEU evidence allowed',
            ruleScope: 'GLOBAL',
            applicableCasesJson: ['ALL'],
            applicableIntentsJson: ['ALL'],
            guardrailType: 'NO_INFERENCE',
            ruleStatement: 'You must only use data provided in the evidence packet. Do not introduce any fact, number, or claim not present in the AEUs.',
            enforcementMode: 'HARD_BLOCK',
            isActive: true
        },

        {
            grRuleId: 'GR_0002',
            ruleName: 'Citation required for all external claims',
            ruleScope: 'GLOBAL',
            applicableCasesJson: ['ALL'],
            applicableIntentsJson: ['ALL'],
            guardrailType: 'CITATION_REQUIRED',
            ruleStatement: 'Every claim derived from external signals must include the source reference ID from the evidence packet.',
            enforcementMode: 'HARD_BLOCK',
            isActive: true
        },

        {
            grRuleId: 'GR_0003',
            ruleName: 'Certainty cap by accuracy band',
            ruleScope: 'GLOBAL',
            applicableCasesJson: ['ALL'],
            applicableIntentsJson: ['ALL'],
            guardrailType: 'RECENCY_LIMIT',
            ruleStatement: 'Language certainty must not exceed the cap defined by the accuracy band: HIGH=85%, MEDIUM=70%, LOW=55%, VERY_LOW=40%.',
            enforcementMode: 'SOFT_WARN',
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 17 — decision_assurance_sections
// ════════════════════════════════════════════════════════════
async function seedDecisionAssuranceSections() {
    await DecisionAssuranceSections.deleteMany({});
    await DecisionAssuranceSections.insertMany([

        {
            sectionId: 'SEC_001',
            sectionName: 'Profile Risk Summary',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            sectionOrder: 1,
            sectionType: 'ANALYSIS',
            allowedAeuTypesJson: ['identity', 'work', 'composition', 'inferred'],
            certaintyCapPercent: 85,
            minAccuracyRequired: 0,
            fallbackPolicy: 'DEGRADE',
            isActive: true
        },

        {
            sectionId: 'SEC_002',
            sectionName: 'Financial Resilience Assessment',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            sectionOrder: 2,
            sectionType: 'RISK_SYNTHESIS',
            requiredInternalAnchorsJson: ['Financial Resilience'],
            allowedAeuTypesJson: ['inferred', 'work'],
            certaintyCapPercent: 85,
            minAccuracyRequired: 0,
            fallbackPolicy: 'DEGRADE',
            isActive: true
        },

        {
            sectionId: 'SEC_003',
            sectionName: 'Market Signals',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            sectionOrder: 3,
            sectionType: 'ANALYSIS',
            requiredExternalAnchorsJson: ['Market Demand Signal'],
            allowedAeuTypesJson: ['external'],
            certaintyCapPercent: 70,
            minAccuracyRequired: 0,
            fallbackPolicy: 'DEGRADE',
            isActive: true
        },

        {
            sectionId: 'SEC_004',
            sectionName: 'Verdict',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            sectionOrder: 4,
            sectionType: 'VERDICT',
            allowedAeuTypesJson: ['identity', 'work', 'inferred', 'external'],
            certaintyCapPercent: 85,
            minAccuracyRequired: 0,
            fallbackPolicy: 'ESCALATE',
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 18 — prompt_config_registry
// ════════════════════════════════════════════════════════════
async function seedPromptConfigRegistry() {
    await PromptConfigRegistry.deleteMany({});
    await PromptConfigRegistry.insertMany([

        {
            promptId: 'PCR_SEC001_V1',
            sectionId: 'SEC_001',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            promptVersion: 1,
            modelFamily: 'OPENAI',
            temperature: 0.3,
            maxTokens: 600,
            systemPrompt: 'You are a structured risk analyst for Hawksyn. Write only what evidence supports. Do not introduce external facts. Do not use words like "definitely" or "certainly".',
            userPrompt: 'Write a Profile Risk Summary for this user. Use only the evidence provided. Current Role: {{CURRENT_ROLE}}. Experience: {{EXPERIENCE_YEARS}} years. Skills: {{SKILLS}}. AI Exposure: {{AI_EXPOSURE}}. Accuracy Band: {{ACCURACY_BAND}}.',
            evidencePlaceholdersJson: {
                CURRENT_ROLE: 'AEU_IDENTITY_002',
                EXPERIENCE_YEARS: 'AEU_WORK_001',
                SKILLS: 'AEU_COMP_*',
                AI_EXPOSURE: 'AEU_INPUT_001',
                ACCURACY_BAND: 'AEU_INT_001'
            },
            certaintyCapPercent: 85,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            isActive: true
        },

        {
            promptId: 'PCR_SEC004_V1',
            sectionId: 'SEC_004',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            promptVersion: 1,
            modelFamily: 'OPENAI',
            temperature: 0.2,
            maxTokens: 400,
            systemPrompt: 'You are the verdict engine for Hawksyn. Deliver PROCEED, PAUSE, or ABORT verdict. Do not hedge beyond the accuracy band ceiling. Base verdict solely on provided integrity data.',
            userPrompt: 'Deliver verdict for this run. Accuracy Score: {{ACCURACY_SCORE}}. Accuracy Band: {{ACCURACY_BAND}}. Red Flags: {{RED_FLAGS}}. Contradictions: {{CONTRADICTIONS}}. Verdict options: PROCEED / PAUSE / ABORT.',
            evidencePlaceholdersJson: {
                ACCURACY_SCORE: 'AEU_INT_001',
                ACCURACY_BAND: 'AEU_INT_002',
                RED_FLAGS: 'AEU_INT_003',
                CONTRADICTIONS: 'AEU_INT_004'
            },
            certaintyCapPercent: 85,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            isActive: true
        },

        // CV Extraction prompt
        {
            promptId: 'PCR_CV_EXTRACT_V1',
            sectionId: 'CV_NORMALISATION',
            caseId: 'ALL',
            intentId: 'ALL',
            playbookVersionId: 'PBV_000001',
            promptVersion: 1,
            modelFamily: 'GEMINI',
            temperature: 0.1,
            maxTokens: 4000,
            systemPrompt: 'You are a CV extraction engine. Extract and structure only. Do not analyze or judge. Return only valid JSON.',
            userPrompt: '{{CV_TEXT}}',
            evidencePlaceholdersJson: { CV_TEXT: 'raw_cv_text' },
            certaintyCapPercent: 100,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            isActive: true
        }

    ]);
}

// ════════════════════════════════════════════════════════════
// MASTER RUNNER
// ════════════════════════════════════════════════════════════
async function runSeed() {
    try {
        console.log('\n🌱 Hawksyn Master Seed Starting...\n');

        await mongoose.connect(process.env.DB_URI);
        console.log('✅ MongoDB connected\n');

        const steps = [
            { name: 'case_registry', fn: seedCaseRegistry },
            { name: 'intent_taxonomy', fn: seedIntentTaxonomy },
            { name: 'cv_file_rules', fn: seedCvFileRules },
            { name: 'playbooks', fn: seedPlaybooks },
            { name: 'case_intent_config', fn: seedCaseIntentConfig },
            { name: 'questions', fn: seedQuestions },
            { name: 'input_schemas', fn: seedInputSchemas },
            { name: 'constraints', fn: seedConstraints },
            { name: 'constraint_question_mapping', fn: seedConstraintQuestionMapping },
            { name: 'contradictions', fn: seedContradictions },
            { name: 'coverage_requirements', fn: seedCoverageRequirements },
            { name: 'red_flag_taxonomy', fn: seedRedFlagTaxonomy },
            { name: 'accuracy_scoring_policy', fn: seedAccuracyScoringPolicy },
            { name: 'warnings', fn: seedWarnings },
            { name: 'evaluation_library_registry', fn: seedEvaluationLibraryRegistry },
            { name: 'guardrail_registry', fn: seedGuardrailRegistry },
            { name: 'decision_assurance_sections', fn: seedDecisionAssuranceSections },
            { name: 'prompt_config_registry', fn: seedPromptConfigRegistry },
        ];

        for (const step of steps) {
            try {
                await step.fn();
                console.log(`✅ ${step.name}`);
            } catch (err) {
                console.error(`❌ FAILED: ${step.name}`);
                console.error(`   Error: ${err.message}`);
                console.error('\n🛑 Seed stopped due to error. Fix above and re-run.\n');
                process.exit(1);
            }
        }

        console.log('\n🎯 All seed data inserted successfully!');
        console.log('   Case:   CASE_AI_JOB_RISK');
        console.log('   Intent: INT_STAY_12M_SAFE');
        console.log('   Ready to test the full flow.\n');

    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB disconnected\n');
    }
}

runSeed();