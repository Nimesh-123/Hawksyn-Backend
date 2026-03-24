// ════════════════════════════════════════════════════════════
// HAWKSYN — MASTER SEED SCRIPT (FINAL — Excel Aligned)
// Seeds all config/master data for case: CASE_AI_JOB_RISK
// Intent: INT_STAY_12M_SAFE
//
// Run: npm run seed
// ════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
require('dotenv').config();

// ── Import all models ──
const CaseRegistry = require('../models/CaseRegistry.model');
const IntentTaxonomy = require('../models/IntentTaxonomy.model');
const DocumentFileRules = require('../models/DocumentFileRules.model');
const Playbooks = require('../models/Playbooks.model');
const CaseIntentConfig = require('../models/CaseIntentConfig.model');
const Questions = require('../models/Questions.model');
const Constraints = require('../models/Constraints.model');
const ConstraintQuestionMapping = require('../models/ConstraintQuestionMapping.model');
const Contradictions = require('../models/Contradictions.model');
const CoverageRequirements = require('../models/CoverageRequirements.model');
const RedFlagTaxonomy = require('../models/RedFlagTaxonomy.model');
const AccuracyScoringPolicy = require('../models/AccuracyScoringPolicy.model');
const Warnings = require('../models/Warnings.model');
const EvaluationLibraryRegistry = require('../models/EvaluationLibraryRegistry.model');
const GuardrailRegistry = require('../models/GuardrailRegistry.model');
const DecisionAssuranceSections = require('../models/DecisionAssuranceSections.model');
const PromptConfigRegistry = require('../models/PromptConfigRegistry.model');
const DependencyRules = require('../models/DependencyRules.model');
const ExternalSignalTaxonomy = require('../models/ExternalSignalTaxonomy.model');
const SourceRegistry = require('../models/SourceRegistry.model');
const DataPatternKeyTaxonomy = require('../models/DataPatternKeyTaxonomy.model');
const RiskAuditorRegistry = require('../models/RiskAuditorRegistry.model');
const MandatoryObjectiveInput = require('../models/MandatoryObjectiveInput.model');
const MoiQuestionMapping = require('../models/MoiQuestionMapping.model');
const MarketPulse = require('../models/MarketPulse.model');
const UserCredits = require('../models/UserCredits.model');

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
            documentRequired: true,
            isActive: true,
            logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 5 L88 20 L88 52 C88 72 70 88 50 95 C30 88 12 72 12 52 L12 20 Z" fill="#1E1E2E" stroke="#FFA500" stroke-width="2.5"/><line x1="30" y1="40" x2="50" y2="40" stroke="#FFA500" stroke-width="1.5" opacity="0.7"/><line x1="50" y1="40" x2="70" y2="40" stroke="#FFA500" stroke-width="1.5" opacity="0.7"/><line x1="35" y1="55" x2="50" y2="55" stroke="#FFA500" stroke-width="1.5" opacity="0.7"/><line x1="50" y1="55" x2="65" y2="55" stroke="#FFA500" stroke-width="1.5" opacity="0.7"/><line x1="50" y1="40" x2="50" y2="55" stroke="#FFA500" stroke-width="1.5" opacity="0.7"/><line x1="35" y1="40" x2="35" y2="55" stroke="#FFA500" stroke-width="1.2" opacity="0.5"/><line x1="65" y1="40" x2="65" y2="55" stroke="#FFA500" stroke-width="1.2" opacity="0.5"/><circle cx="30" cy="40" r="3" fill="#FFA500"/><circle cx="50" cy="40" r="3.5" fill="#FFA500"/><circle cx="70" cy="40" r="3" fill="#FFA500"/><circle cx="35" cy="55" r="3" fill="#FFA500" opacity="0.8"/><circle cx="50" cy="55" r="3.5" fill="#FFA500"/><circle cx="65" cy="55" r="3" fill="#FFA500" opacity="0.8"/><circle cx="50" cy="47" r="5" fill="none" stroke="#FFA500" stroke-width="1.5" opacity="0.6"/><circle cx="50" cy="47" r="2.5" fill="#FFA500"/><circle cx="50" cy="70" r="5" fill="#FFA500" opacity="0.9"/><path d="M42 82 Q50 76 58 82" fill="none" stroke="#FFA500" stroke-width="2" stroke-linecap="round" opacity="0.9"/></svg>`
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
            intentName: 'Stay safe for 12 months in current role',
            intentDescription: 'Analyze whether your current role is safe from AI disruption for the next 12 months.',
            intentHorizonDays: 365, intentType: 'STABILITY', primaryOutcome: 'DECISION_SAFETY', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: true
        },
        {
            intentId: 'INT_UPSKILL_AI_PROOF',
            intentName: 'Upskill to AI-proof current role',
            intentDescription: 'Identify which skills you need to learn to remain relevant in your current company.',
            intentHorizonDays: 180, intentType: 'UPSKILL', primaryOutcome: 'UPSKILL_PLAN', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: true
        },
        {
            intentId: 'INT_CAREER_PIVOT_AI',
            intentName: 'Career Pivot due to AI Disruption',
            intentDescription: 'Find better and more resilient career paths in the era of AI.',
            intentHorizonDays: 365, intentType: 'SWITCH', primaryOutcome: 'TRANSITION_PLAN', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 3 — document_file_rules
// ════════════════════════════════════════════════════════════
async function seedDocumentFileRules() {
    await DocumentFileRules.deleteMany({});
    await DocumentFileRules.insertMany([
        {
            documentPolicyId: 'DOCPOLICY_V1_STD',
            policyName: 'Standard Document Policy v1',
            policyVersion: 'v1.0',
            allowedFormats: 'PDF|DOCX',
            rejectPasswordProtected: true,
            rejectScannedOrImage: true,
            parserEngine: 'TEXT_EXTRACT_V1',
            normalisationLlm: 'GEMINI',
            promptTemplateId: 'PCR_CV_EXTRACT_V1',
            outputSchemaId: 'AEU_SCHEMA_V1',
            fieldMappingProfileId: 'FMP_STD_V1',
            isActive: true,
            notes: 'Standard policy for MVP'
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
            documentPolicyId: 'DOCPOLICY_V1_STD',
            documentMandatory: true,
            allowedDocumentFormats: 'PDF|DOCX',
            adversarialMirrorEnabled: false,
            allowedLlms: 'GEMINI|OPENAI',
            normalisationLlm: 'GEMINI',
            mandatoryDocumentFields: 'current_role|experience_years|skills|current_company|domain',
            objectiveInputSchemaId: 'MOI_AI_STAY_V1',
            outputContracts: 'INTEGRITY_PACK|VERDICT|FINANCIAL_RESILIENCE|MARKET_SIGNALS',
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
            isActive: true,
            notes: 'MVP playbook v1'
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
            caseId: 'CASE_AI_JOB_RISK', intentId: 'INT_STAY_12M_SAFE', playbookVersionId: 'PBV_000001',
            isDefault: true, displayOrder: 1, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, notes: 'Primary intent'
        },
        {
            caseId: 'CASE_AI_JOB_RISK', intentId: 'INT_UPSKILL_AI_PROOF', playbookVersionId: 'PBV_000001',
            isDefault: false, displayOrder: 2, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false, notes: 'Coming soon'
        },
        {
            caseId: 'CASE_AI_JOB_RISK', intentId: 'INT_CAREER_PIVOT_AI', playbookVersionId: 'PBV_000001',
            isDefault: false, displayOrder: 3, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false, notes: 'Coming soon'
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 6 — questions
// ════════════════════════════════════════════════════════════
async function seedQuestions() {
    await Questions.deleteMany({});
    await Questions.insertMany([
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
            ],
            validationJson: null,
            stepApplicability: null,
            profileGateJson: null,
            triggerRuleJson: null,
            outputTagsJson: null
        },
        {
            questionId: 'Q_FINANCIAL_RUNWAY_V1',
            questionText: 'How many months of living expenses can you cover without income?',
            questionType: 'NUMERIC',
            scoreMode: 'DIRECT',
            defaultWeight: 0.25,
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
            numericMax: 60,
            outOfRangePolicy: 'CLAMP',
            roundingRule: 'ROUND',
            validationJson: { min: 0, max: 60, unit: 'months' },
            scoringMapJson: [
                { minVal: 0, maxVal: 3, normalizedScore: 5 },   // CRITICAL — less than 3 months
                { minVal: 4, maxVal: 6, normalizedScore: 25 },   // FRAGILE  — 4 to 6 months
                { minVal: 7, maxVal: 12, normalizedScore: 55 },   // MODERATE — 7 to 12 months
                { minVal: 13, maxVal: 24, normalizedScore: 80 },   // STRONG   — 13 to 24 months
                { minVal: 25, maxVal: 60, normalizedScore: 100 }   // VERY STRONG — 25+ months
            ],
            stepApplicability: null,
            profileGateJson: null,
            triggerRuleJson: null,
            outputTagsJson: null
        },
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
            ],
            validationJson: null,
            stepApplicability: null,
            profileGateJson: null,
            triggerRuleJson: null,
            outputTagsJson: null
        },
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
            ],
            validationJson: null,
            stepApplicability: null,
            profileGateJson: null,
            triggerRuleJson: null,
            outputTagsJson: null
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 7 — mandatory_objective_inputs
// ════════════════════════════════════════════════════════════
async function seedMandatoryObjectiveInputs() {
    await MandatoryObjectiveInput.deleteMany({});
    await MandatoryObjectiveInput.insertMany([
        {
            moiId: 'MOI_AI_STAY_V1',
            moiName: 'AI Job Risk – Stay – Mandatory Inputs',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            version: 'v1.0',
            description: 'Mandatory inputs for role safety validation',
            isActive: true
        },
        {
            moiId: 'MOI_MBA_V1',
            moiName: 'MBA Decision – Mandatory Inputs',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            playbookVersionId: 'PBV_000004',
            version: 'v1.0',
            description: 'Inputs required for MBA decision validation',
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 7b — moi_question_mapping
// ════════════════════════════════════════════════════════════
async function seedMoiQuestionMapping() {
    await MoiQuestionMapping.deleteMany({});
    await MoiQuestionMapping.insertMany([
        {
            moiqmId: 'MOIQM_000001',
            moiId: 'MOI_AI_STAY_V1',
            questionId: 'Q_AI_ROLE_EXPOSURE_V1',
            isMandatory: true,
            weightOverride: null,
            accuracyImpactFlag: 'HIGH',
            displayOrder: 1,
            dependencyRuleId: null,
            isActive: true
        },
        {
            moiqmId: 'MOIQM_000002',
            moiId: 'MOI_AI_STAY_V1',
            questionId: 'Q_FINANCIAL_RUNWAY_V1',
            isMandatory: true,
            weightOverride: null,
            accuracyImpactFlag: 'HIGH',
            displayOrder: 2,
            dependencyRuleId: null,
            isActive: true
        },
        {
            moiqmId: 'MOIQM_000003',
            moiId: 'MOI_AI_STAY_V1',
            questionId: 'Q_ROLE_UNIQUENESS_V1',
            isMandatory: true,
            weightOverride: null,
            accuracyImpactFlag: 'MEDIUM',
            displayOrder: 3,
            dependencyRuleId: null,
            isActive: true
        },
        {
            moiqmId: 'MOIQM_000004',
            moiId: 'MOI_AI_STAY_V1',
            questionId: 'Q_COMPANY_AI_POLICY_V1',
            isMandatory: true,
            weightOverride: null,
            accuracyImpactFlag: 'HIGH',
            displayOrder: 4,
            dependencyRuleId: null,
            isActive: true
        },
        {
            moiqmId: 'MOIQM_000005',
            moiId: 'MOI_MBA_V1',
            questionId: 'Q_FINANCIAL_RUNWAY_V1',
            isMandatory: true,
            weightOverride: 1.7,
            accuracyImpactFlag: 'CRITICAL',
            displayOrder: 1,
            dependencyRuleId: null,
            isActive: true
        },
        {
            moiqmId: 'MOIQM_000006',
            moiId: 'MOI_AI_SWITCH_V1',
            questionId: 'Q_ROLE_UNIQUENESS_V1',
            isMandatory: true,
            weightOverride: null,
            accuracyImpactFlag: 'HIGH',
            displayOrder: 1,
            dependencyRuleId: null,               // ✅ FIXED: was DRR_000001 (does not exist)
            isActive: true
        },
        {
            moiqmId: 'MOIQM_000007',
            moiId: 'MOI_AI_UPSKILL_V1',
            questionId: 'Q_AI_ROLE_EXPOSURE_V1',
            isMandatory: true,
            weightOverride: 1.2,
            accuracyImpactFlag: 'HIGH',
            displayOrder: 1,
            dependencyRuleId: null,
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 8 — constraints (flat threshold fields)
// ════════════════════════════════════════════════════════════
async function seedConstraints() {
    await Constraints.deleteMany({});
    await Constraints.insertMany([
        {
            constraintId: 'CONS_AI_001',
            constraintSetId: 'CT_AI_STAY_V1',
            thresholdSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Role Automation Exposure',
            constraintDescription: 'Measures how much of the user role can be automated by AI tools.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 1,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        },
        {
            constraintId: 'CONS_AI_002',
            constraintSetId: 'CT_AI_STAY_V1',
            thresholdSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Financial Resilience',
            constraintDescription: 'Measures financial runway — ability to sustain without income.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 2,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        },
        {
            constraintId: 'CONS_AI_003',
            constraintSetId: 'CT_AI_STAY_V1',
            thresholdSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Role Uniqueness & Replaceability',
            constraintDescription: 'Measures how replaceable the user is in their current role.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 3,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        },
        {
            constraintId: 'CONS_AI_004',
            constraintSetId: 'CT_AI_STAY_V1',
            thresholdSetId: 'CT_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            constraintName: 'Company AI Displacement Risk',
            constraintDescription: 'Measures how aggressively the company is adopting AI in delivery.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 4,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
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
        {
            cqmtId: 'CQMT_000001',                    // ✅ FIXED: was CQMT_0001
            constraintId: 'CONS_AI_001',
            questionId: 'Q_AI_ROLE_EXPOSURE_V1',
            scoringRuleId: 'SR_AI_ROLE_EXPOSURE_V1',
            contributionWeight: 0.60,
            isRequiredForConstraint: true,
            normalizationMethod: 'NORMALIZED_100',
            isActive: true
        },
        {
            cqmtId: 'CQMT_000002',                    // ✅ FIXED: was CQMT_0002
            constraintId: 'CONS_AI_001',
            questionId: 'Q_FINANCIAL_RUNWAY_V1',
            scoringRuleId: 'SR_FINANCIAL_RUNWAY_V1',
            contributionWeight: 0.40,
            isRequiredForConstraint: false,
            normalizationMethod: 'NORMALIZED_100',
            isActive: true
        },
        {
            cqmtId: 'CQMT_000003',                    // ✅ FIXED: was CQMT_0003
            constraintId: 'CONS_AI_002',
            questionId: 'Q_FINANCIAL_RUNWAY_V1',
            scoringRuleId: 'SR_FINANCIAL_RUNWAY_V1',
            contributionWeight: 1.00,
            isRequiredForConstraint: true,
            normalizationMethod: 'NORMALIZED_100',
            isActive: true
        },
        {
            cqmtId: 'CQMT_000004',                    // ✅ FIXED: was CQMT_0004
            constraintId: 'CONS_AI_003',
            questionId: 'Q_ROLE_UNIQUENESS_V1',
            scoringRuleId: 'SR_ROLE_UNIQUENESS_V1',
            contributionWeight: 1.00,
            isRequiredForConstraint: true,
            normalizationMethod: 'NORMALIZED_100',
            isActive: true
        },
        {
            cqmtId: 'CQMT_000005',                    // ✅ FIXED: was CQMT_0005
            constraintId: 'CONS_AI_004',
            questionId: 'Q_COMPANY_AI_POLICY_V1',
            scoringRuleId: 'SR_COMPANY_AI_POLICY_V1',
            contributionWeight: 1.00,
            isRequiredForConstraint: true,
            normalizationMethod: 'NORMALIZED_100',
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 10 — contradictions  ← 4 fields ADDED
// ════════════════════════════════════════════════════════════
async function seedContradictions() {
    await Contradictions.deleteMany({});
    await Contradictions.insertMany([
        {
            contradictionId: 'CONTR_AI_001',
            contradictionSetId: 'CONTR_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            contradictionName: 'Active AI Adoption + Low Financial Runway',
            contradictionDescription: 'Company is actively deploying AI but user has very low financial buffer.',
            contradictionType: 'INPUT_VS_INPUT',
            involvedEntitiesJson: { questionIds: ['Q_COMPANY_AI_POLICY_V1', 'Q_FINANCIAL_RUNWAY_V1'] },
            defaultSeverityBand: 'HIGH',                // ✅ ADDED
            ruleName: 'Active AI + Low Runway Rule',     // ✅ ADDED
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
            confidencePenaltyPoints: 0,                 // ✅ ADDED
            isBlocking: false,
            escalationTag: null,                        // ✅ ADDED
            maxTriggerCount: 1,
            isActive: true
        },
        {
            contradictionId: 'CONTR_AI_002',
            contradictionSetId: 'CONTR_AI_STAY_V1',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            contradictionName: 'Claims Low AI Exposure But Company Is AI-First',
            contradictionDescription: 'User claims very low AI automation exposure but company is AI-first.',
            contradictionType: 'INPUT_VS_INPUT',
            involvedEntitiesJson: { questionIds: ['Q_AI_ROLE_EXPOSURE_V1', 'Q_COMPANY_AI_POLICY_V1'] },
            defaultSeverityBand: 'MEDIUM',              // ✅ ADDED
            ruleName: 'Low Exposure + AI First Rule',   // ✅ ADDED
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
            confidencePenaltyPoints: 0,                 // ✅ ADDED
            isBlocking: false,
            escalationTag: null,                        // ✅ ADDED
            maxTriggerCount: 1,
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 11 — coverage_requirements  ← 2 fields ADDED
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
            escalationThreshold: null,                
            escalationPenaltyPoints: null,              
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
            escalationThreshold: null,                 
            escalationPenaltyPoints: null,             
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
            penaltyPoints: 0,
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
// STEP 14 — warnings  ← 2 fields ADDED
// ════════════════════════════════════════════════════════════
async function seedWarnings() {
    await Warnings.deleteMany({});
    await Warnings.insertMany([
        {
            warningId: 'WARN_FIN_RUNWAY_LOW',
            warningMappingId: 'WMT_AI_V1',
            redFlagId: 'RF_0001',
            triggerMode: 'ALWAYS',
            minSeverityBand: null,                      // ✅ ADDED
            displayPriority: 1,
            warningTitle: 'Financial Cushion Is Weak',
            warningMessage: 'You have less than 6 months of financial runway. This is critically low in a period of AI-driven workforce change. If your role is disrupted, you will have very limited time to transition.',
            severityBand: 'HIGH',
            advisoryType: 'ACTION_REQUIRED',
            ctaText: 'Build a 6-month emergency fund before making any career decisions.',
            humanValidationRecommended: false,
            displayType: 'TOP_BANNER',
            expiresAfterDays: null,                     // ✅ ADDED
            isActive: true
        },
        {
            warningId: 'WARN_AI_DISPLACEMENT_HIGH',
            warningMappingId: 'WMT_AI_V1',
            redFlagId: 'RF_0002',
            triggerMode: 'ALWAYS',
            minSeverityBand: null,                      // ✅ ADDED
            displayPriority: 2,
            warningTitle: 'Your Company Is Actively Deploying AI',
            warningMessage: 'Companies in active AI deployment phases typically reorganize roles and responsibilities within 6 to 12 months. This creates structural risk for roles with high automation overlap.',
            severityBand: 'CRITICAL',
            advisoryType: 'ACTION_REQUIRED',
            ctaText: 'Map which of your tasks are being automated and identify which skills make you irreplaceable.',
            humanValidationRecommended: true,
            displayType: 'REPORT_SECTION',
            expiresAfterDays: null,                     // ✅ ADDED
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 15 — evaluation_library_registry
// ════════════════════════════════════════════════════════════
async function seedEvaluationLibraryRegistry() {
    await EvaluationLibraryRegistry.deleteMany({});
    await EvaluationLibraryRegistry.insertMany([
        {
            elrId: 'ELR_0001',
            elrName: 'AI Job Risk — Stay Safe 12M Library',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            documentPolicyId: 'DOCPOLICY_V1_STD',
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
            applicableSectionsJson: ['ALL'],
            applicableSignalsJson: ['ALL'],
            penaltyPoints: 0,
            violationAction: 'BLOCK',
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
            applicableSectionsJson: ['ALL'],
            applicableSignalsJson: ['ALL'],
            penaltyPoints: 0,
            violationAction: 'BLOCK',
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
            applicableSectionsJson: ['ALL'],
            applicableSignalsJson: ['ALL'],
            penaltyPoints: 0,
            violationAction: 'BLOCK',
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 17 — decision_assurance_sections  ← anchor fields ADDED to all 4
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
            requiredInternalAnchorsJson: [],            // ✅ ADDED
            requiredExternalAnchorsJson: [],            // ✅ ADDED
            outputSchemaReference: null,
            isActive: true
        },
        {
            sectionId: 'SEC_002',
            sectionName: 'Financial Resilience Assessment',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            sectionOrder: 2,
            sectionType: 'RISK_SYNTHESIS',
            allowedAeuTypesJson: ['inferred', 'work'],
            certaintyCapPercent: 85,
            minAccuracyRequired: 0,
            fallbackPolicy: 'DEGRADE',
            requiredInternalAnchorsJson: ['Financial Resilience'],  // ✅ already present
            requiredExternalAnchorsJson: [],                        // ✅ ADDED
            outputSchemaReference: null,
            isActive: true
        },
        {
            sectionId: 'SEC_003',
            sectionName: 'Market Signals',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            sectionOrder: 3,
            sectionType: 'ANALYSIS',
            allowedAeuTypesJson: ['external'],
            certaintyCapPercent: 70,
            minAccuracyRequired: 0,
            fallbackPolicy: 'DEGRADE',
            requiredInternalAnchorsJson: [],                        // ✅ ADDED
            requiredExternalAnchorsJson: ['Market Demand Signal'],  // ✅ already present
            outputSchemaReference: null,
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
            requiredInternalAnchorsJson: [],            // ✅ ADDED
            requiredExternalAnchorsJson: [],            // ✅ ADDED
            outputSchemaReference: null,
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
            userPrompt: `Write a 4-sentence Profile Risk Summary for this user.

Profile:
- Current Role: {{CURRENT_ROLE}}
- Experience: {{EXPERIENCE_YEARS}} years at {{CURRENT_COMPANY}}
- Domain: {{DOMAIN}}
- Skills: {{SKILLS}}

User's Own Risk Inputs:
- AI Exposure in daily work: {{AI_EXPOSURE}}
- Financial Runway: {{FINANCIAL_RUNWAY}}
- Role Uniqueness: {{ROLE_UNIQUENESS}}
- Company AI Policy: {{COMPANY_AI_POLICY}}

Integrity Results:
- Accuracy Score: {{ACCURACY_SCORE}} (Band: {{ACCURACY_BAND}})
- Red Flags triggered: {{RED_FLAGS}}
- Contradictions: {{CONTRADICTIONS}}

Write based ONLY on this data. Reference the user's specific answers.
Be direct. Mention the role name and actual risk signals.
Do not give generic career advice.`,
            evidencePlaceholdersJson: {
                CURRENT_ROLE: 'AEU_IDENTITY_002',
                EXPERIENCE_YEARS: 'AEU_WORK_001',
                SKILLS: 'AEU_COMP_*',
                AI_EXPOSURE: 'AEU_INPUT_001',
                ACCURACY_BAND: 'AEU_INT_001'
            },
            certaintyCapPercent: 85,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            outputSchemaReference: null,
            isActive: true
        },
        {
            promptId: 'PCR_SEC002_V1',
            sectionId: 'SEC_002',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            promptVersion: 1,
            modelFamily: 'GEMINI',
            temperature: 0.3,
            maxTokens: 600,
            systemPrompt: 'You are a financial resilience analyst for Hawksyn. Assess the user\'s financial runway against career risk. Be factual and concise. Do not invent numbers not present in the evidence.',
            userPrompt: 'Assess the financial resilience of this user.\nFinancial Runway: {{FINANCIAL_RUNWAY}} months.\nAccuracy Band: {{ACCURACY_BAND}}.\nRed Flags: {{RED_FLAGS}}.\n\nWrite 2-3 paragraphs covering:\n1. Is the current financial cushion adequate given AI risk?\n2. What happens if role is disrupted?\n3. What is the recommended immediate action?',
            evidencePlaceholdersJson: {
                FINANCIAL_RUNWAY: 'Q_FINANCIAL_RUNWAY_V1',
                ACCURACY_BAND: 'integrityPack.accuracy.band',
                RED_FLAGS: 'integrityPack.redFlags.triggered'
            },
            certaintyCapPercent: 85,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            outputSchemaReference: null,
            isActive: true
        },
        {
            promptId: 'PCR_SEC003_V1',
            sectionId: 'SEC_003',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            promptVersion: 1,
            modelFamily: 'GEMINI',
            temperature: 0.4,
            maxTokens: 500,
            systemPrompt: 'You are a market signals analyst for Hawksyn. Summarize external market conditions relevant to the user\'s role and domain. Only use the provided inputs. Do not fabricate statistics or cite external sources.',
            userPrompt: `Analyze the external market conditions for this user's career risk assessment.

User Profile:
- Current Role: {{CURRENT_ROLE}}
- Industry: {{DOMAIN}}
- Experience: {{EXPERIENCE_YEARS}} years

External Market Signals Collected:
- Market Demand for this role type: {{MARKET_DEMAND_SIGNAL}}
  Supporting data: {{MARKET_DEMAND_RATIONALE}}
- AI/Automation Displacement Risk: {{AI_DISPLACEMENT_RISK}}
  Supporting data: {{AI_DISPLACEMENT_RATIONALE}}
- Industry Hiring Trend: {{INDUSTRY_HIRING_TREND}}
- Role Automation Overlap: {{AUTOMATION_OVERLAP}}%
- Signal Data Quality: {{SIGNAL_DATA_QUALITY}}

Accuracy Band: {{ACCURACY_BAND}}

Analyst Note: {{ANALYST_NOTE}}

Instructions:
- Write a 3-4 sentence market signals analysis for this user.
- Use only the signal data provided above — do not invent statistics.
- Clearly state market demand level, displacement risk, and hiring trend.
- If SIGNAL_DATA_QUALITY is INSUFFICIENT or PARTIAL, note the limitation.
- End with one direct implication for this user's decision.
- Do not use phrases like "Based on my training data" — write as a market analyst would.`,
            evidencePlaceholdersJson: {
                CURRENT_ROLE: 'parsedCvData.current_role',
                DOMAIN: 'parsedCvData.domain',
                COMPANY_AI_POLICY: 'Q_COMPANY_AI_POLICY_V1',
                ACCURACY_BAND: 'integrityPack.accuracy.band'
            },
            certaintyCapPercent: 70,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            outputSchemaReference: null,
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
            userPrompt: `Deliver a verdict for this user based on the integrity data provided.

Accuracy Score: {{ACCURACY_SCORE}}
Accuracy Band: {{ACCURACY_BAND}}
Red Flags: {{RED_FLAGS}}
Contradictions: {{CONTRADICTIONS}}

Instructions:
- Your first line MUST be exactly one of: PROCEED, PAUSE, or ABORT
- Then write 3-4 sentences explaining the verdict
- Reference the specific risk factors from the data above
- End with one clear actionable recommendation for the user

Use this exact format:
ABORT
[Your 3-4 sentence explanation here. Reference red flags and accuracy band. End with one recommendation.]`,
            evidencePlaceholdersJson: {
                ACCURACY_SCORE: 'AEU_INT_001',
                ACCURACY_BAND: 'AEU_INT_002',
                RED_FLAGS: 'AEU_INT_003',
                CONTRADICTIONS: 'AEU_INT_004'
            },
            certaintyCapPercent: 85,
            retryPolicy: 'RETRY_ON_SCHEMA_FAIL',
            outputSchemaReference: null,
            isActive: true
        },
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
            outputSchemaReference: null,
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 19 — dependency_rules
// ════════════════════════════════════════════════════════════
async function seedDependencyRules() {
    await DependencyRules.deleteMany({});
    await DependencyRules.insertMany([
        {
            dependencyRuleId: 'DRR_000004',
            moiId: 'MOI_AI_STAY_V1',
            ruleName: 'Ask company signals only if company size is mid/large',
            targetQuestionId: 'Q_COMPANY_AI_POLICY_V1',  // ✅ FIXED: was Q_COMPANY_SIGNAL_V1
            ruleJson: {
                all: [{ source: 'profile', field: 'inferred.companySize', op: 'in', value: ['MID', 'LARGE'] }],
                any: []
            },
            onFailAction: 'SKIP',
            skipReason: 'Skip because signals question not reliable for very small firms',
            isActive: false
        },
        {
            dependencyRuleId: 'DRR_000005',
            moiId: 'MOI_AI_STAY_V1',
            ruleName: 'Ask exposure only if role is not unemployed',
            targetQuestionId: 'Q_AI_ROLE_EXPOSURE_V1',
            ruleJson: {
                all: [{ source: 'profile', field: 'inferred.employmentStatus', op: 'neq', value: 'UNEMPLOYED' }],
                any: []
            },
            onFailAction: 'SKIP',
            skipReason: 'Skip because role exposure not applicable without employment',
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 20 — external_signal_taxonomy
// ════════════════════════════════════════════════════════════
async function seedExternalSignalTaxonomy() {
    await ExternalSignalTaxonomy.deleteMany({});
    await ExternalSignalTaxonomy.insertMany([
        { signalId: 'EST_LM_001', signalName: 'Labour Market AI Displacement Index', signalCategory: 'LABOUR_MARKET', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', valueFormat: 'NUMERIC', unit: 'index_score', recencyDaysMax: 365, isMandatory: false, isActive: true },
        { signalId: 'EST_TECH_004', signalName: 'AI Tool Adoption Rate in Role Category', signalCategory: 'TECH_TREND', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', valueFormat: 'PERCENT', unit: '%', recencyDaysMax: 180, isMandatory: false, isActive: true },
        { signalId: 'EST_IND_002', signalName: 'Industry Hiring Momentum Score', signalCategory: 'INDUSTRY', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', valueFormat: 'NUMERIC', unit: 'score', recencyDaysMax: 90, isMandatory: false, isActive: true },
        { signalId: 'EST_CO_003', signalName: 'Company AI Investment Signal', signalCategory: 'COMPANY', caseId: 'CASE_AI_JOB_RISK', intentId: 'INT_STAY_12M_SAFE', valueFormat: 'BOOLEAN', unit: '', recencyDaysMax: 180, isMandatory: false, isActive: true },
        { signalId: 'EST_REG_005', signalName: 'Regulatory AI Policy Signal', signalCategory: 'REGULATORY', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', valueFormat: 'TEXT', unit: '', recencyDaysMax: 365, isMandatory: false, isActive: true }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 21 — source_registry
// ════════════════════════════════════════════════════════════
async function seedSourceRegistry() {
    await SourceRegistry.deleteMany({});
    await SourceRegistry.insertMany([
        { sourceId: 'SR_0001', sourceName: 'World Economic Forum', sourceType: 'RESEARCH_BODY', domainUrl: 'weforum.org', credibilityTier: 'TIER_1', geoScope: 'GLOBAL', recencyDaysDefault: 365, minConfidenceWeight: 90, allowedSignalCategories: ['LABOUR_MARKET', 'TECH_TREND'], conflictPriorityRank: 1, requiresManualValidation: false, isActive: true },
        { sourceId: 'SR_0002', sourceName: 'Government Labour Bureau (India)', sourceType: 'GOVERNMENT', domainUrl: 'labour.gov.in', credibilityTier: 'TIER_1', geoScope: 'COUNTRY', recencyDaysDefault: 365, minConfidenceWeight: 95, allowedSignalCategories: ['LABOUR_MARKET'], conflictPriorityRank: 1, requiresManualValidation: false, isActive: true },
        { sourceId: 'SR_0003', sourceName: 'Company Quarterly Filing', sourceType: 'COMPANY_DISCLOSURE', domainUrl: 'investor.company.com', credibilityTier: 'TIER_1', geoScope: 'COMPANY', recencyDaysDefault: 180, minConfidenceWeight: 85, allowedSignalCategories: ['COMPANY'], conflictPriorityRank: 1, requiresManualValidation: false, isActive: true },
        { sourceId: 'SR_0004', sourceName: 'Major Financial News Outlet', sourceType: 'NEWS', domainUrl: 'example-news.com', credibilityTier: 'TIER_2', geoScope: 'GLOBAL', recencyDaysDefault: 90, minConfidenceWeight: 70, allowedSignalCategories: ['LABOUR_MARKET', 'INDUSTRY', 'COMPANY'], conflictPriorityRank: 2, requiresManualValidation: false, isActive: true },
        { sourceId: 'SR_0005', sourceName: 'Independent Tech Blog', sourceType: 'OTHER', domainUrl: 'techblog.example', credibilityTier: 'TIER_3', geoScope: 'GLOBAL', recencyDaysDefault: 60, minConfidenceWeight: 50, allowedSignalCategories: ['TECH_TREND'], conflictPriorityRank: 3, requiresManualValidation: true, isActive: true }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 22 — data_pattern_key_taxonomy
// ════════════════════════════════════════════════════════════
async function seedDataPatternKeyTaxonomy() {
    await DataPatternKeyTaxonomy.deleteMany({});
    await DataPatternKeyTaxonomy.insertMany([
        { patternKeyId: 'DPKT_0001', patternName: 'AI Labour Risk Composite', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', requiredSignals: ['EST_LM_001', 'EST_TECH_004'], minRequiredSignals: 2, aggregationMethod: 'INDEX_BLEND', weightingLogicJson: { 'EST_LM_001': 0.6, 'EST_TECH_004': 0.4 }, minimumConfidenceScore: 75, conflictResolutionStrategy: 'HIGH_TIER_PRIORITY', producesAnchorName: 'Labour Market Risk Anchor', isActive: true },
        { patternKeyId: 'DPKT_0002', patternName: 'Industry Hiring Momentum Pattern', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', requiredSignals: ['EST_IND_002'], minRequiredSignals: 1, aggregationMethod: 'THRESHOLD_BREACH', weightingLogicJson: {}, minimumConfidenceScore: 70, conflictResolutionStrategy: 'MARK_CONFLICT', producesAnchorName: 'Industry Stability Anchor', isActive: true },
        { patternKeyId: 'DPKT_0003', patternName: 'Company Stability Pattern', caseId: 'CASE_AI_JOB_RISK', intentId: 'INT_STAY_12M_SAFE', requiredSignals: ['EST_CO_003'], minRequiredSignals: 1, aggregationMethod: 'MAJORITY_SIGNAL', weightingLogicJson: {}, minimumConfidenceScore: 75, conflictResolutionStrategy: 'ESCALATE_HUMAN', producesAnchorName: 'Company Stability Anchor', isActive: true },
        { patternKeyId: 'DPKT_0004', patternName: 'Regulatory Pressure Pattern', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', requiredSignals: ['EST_REG_005'], minRequiredSignals: 1, aggregationMethod: 'THRESHOLD_BREACH', weightingLogicJson: {}, minimumConfidenceScore: 65, conflictResolutionStrategy: 'HIGH_TIER_PRIORITY', producesAnchorName: 'Regulatory Risk Anchor', isActive: true },
        { patternKeyId: 'DPKT_0005', patternName: 'Multi-Signal Escalation Pattern', caseId: 'CASE_AI_JOB_RISK', intentId: 'ALL', requiredSignals: ['EST_LM_001', 'EST_IND_002', 'EST_CO_003'], minRequiredSignals: 2, aggregationMethod: 'COMPOSITE_RULE', weightingLogicJson: { rule: '2_or_more_negative' }, minimumConfidenceScore: 80, conflictResolutionStrategy: 'ESCALATE_HUMAN', producesAnchorName: 'Composite External Risk Anchor', isActive: true }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 23 — risk_auditor_registry
// ════════════════════════════════════════════════════════════
async function seedRiskAuditorRegistry() {
    await RiskAuditorRegistry.deleteMany({});
    await RiskAuditorRegistry.insertMany([
        {
            auditorId: 'RAR_001',
            auditorName: 'Senior AI Risk Analyst',
            caseId: 'CASE_AI_JOB_RISK',
            specializations: ['AI_DISPLACEMENT', 'FINANCIAL_RISK'],
            maxCaseload: 50,
            currentCaseload: 5,
            isActive: true
        },
        {
            auditorId: 'RAR_004',
            auditorName: 'MBA Education Consultant',
            caseId: 'CASE_MBA_BREAK',
            specializations: ['MBA_ADVISORY', 'FINANCIAL_PLANNING'],
            maxCaseload: 20,
            currentCaseload: 0,
            isActive: true
        },
        {
            auditorId: 'RAR_005',
            auditorName: 'Freelance & Gig Economy Specialist',
            caseId: 'CASE_FREELANCE_SWITCH',
            specializations: ['FREELANCE_MARKETS', 'ENTREPRENEURSHIP'],
            maxCaseload: 20,
            currentCaseload: 0,
            isActive: true
        },
        {
            auditorId: 'RAR_006',
            auditorName: 'Strategic Career Transition Lead',
            caseId: 'CASE_ROLE_SWITCH',
            specializations: ['ROLE_TRANSITION', 'SKILL_ANALYSIS'],
            maxCaseload: 20,
            currentCaseload: 0,
            isActive: true
        }
    ]);
}

// ════════════════════════════════════════════════════════════
// STEP 25 — command_center (MarketPulse + UserCredits)
// ════════════════════════════════════════════════════════════
async function seedCommandCenter() {
    // 1. Initial Market Pulses
    await MarketPulse.deleteMany({});
    await MarketPulse.insertMany([
        {
            pulseId: 'MP_SEED_001',
            role: 'Software Engineer',
            industry: 'Technology',
            aiExposureScore: 45,
            careerMomentumScore: 85,
            skillRelevanceScore: 90,
            opportunityWindowScore: 80,
            careerMomentumMonths: 24,
            opportunityWindowYears: 3,
            insightText: 'Engineers adding AI orchestration skills seeing 20% higher market demand.',
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        {
            pulseId: 'MP_SEED_002',
            role: 'Product Manager',
            industry: 'Technology',
            aiExposureScore: 30,
            careerMomentumScore: 75,
            skillRelevanceScore: 80,
            opportunityWindowScore: 70,
            careerMomentumMonths: 18,
            opportunityWindowYears: 2,
            insightText: 'PMs focusing on AI product strategy are high in demand.',
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
    ]);

    // 2. Initial Credits for Test User
    // Note: Replace with actual test userId from your DB if needed
    const testUserId = '69b3d07789aa8455b137e302'; // From your logs
    await UserCredits.deleteMany({ userId: testUserId });
    await UserCredits.create({
        userId: testUserId,
        checksBalance: 5,
        transactions: [
            { type: 'BONUS', amount: 5, balanceAfter: 5, note: 'Initial test credits' }
        ]
    });
}

async function seedCase_MBA() {
    // ── CaseRegistry ──
    await CaseRegistry.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await CaseRegistry.insertMany([{
        caseId: 'CASE_MBA_BREAK',
        caseName: 'Should I take a career break for MBA?',
        caseCategory: 'DECISION',
        caseDescription: 'Validates whether taking a career break for an MBA is the right financial and career move right now.',
        launchStage: 'MVP',
        defaultCurrency: 'INR',
        minPrice: 999,
        maxPrice: 2999,
        documentRequired: true,
        isActive: true,
        logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 5 L88 20 L88 52 C88 72 70 88 50 95 C30 88 12 72 12 52 L12 20 Z" fill="#1E1E2E" stroke="#FFA500" stroke-width="2.5"/><rect x="30" y="45" width="40" height="25" rx="3" fill="none" stroke="#FFA500" stroke-width="1.5"/><path d="M50 30 L20 45 L50 45 L80 45 Z" fill="#FFA500" opacity="0.8"/><line x1="38" y1="55" x2="62" y2="55" stroke="#FFA500" stroke-width="1.2" opacity="0.7"/><line x1="38" y1="62" x2="62" y2="62" stroke="#FFA500" stroke-width="1.2" opacity="0.7"/><circle cx="50" cy="78" r="4" fill="#FFA500" opacity="0.9"/></svg>`
    }]);

    // ── IntentTaxonomy ──
    await IntentTaxonomy.deleteMany({ intentId: { $in: ['INT_MBA_2026_YESNO', 'INT_MBA_USA', 'INT_MBA_EUROPE'] } });
    await IntentTaxonomy.insertMany([
        {
            intentId: 'INT_MBA_2026_YESNO',
            intentName: 'Global MBA Decision (Next 12 Months)',
            intentDescription: 'Validate whether the financial, career, and personal conditions are right to pursue an MBA now.',
            intentHorizonDays: 365, intentType: 'DECISION', primaryOutcome: 'DECISION_SAFETY', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: true
        },
        {
            intentId: 'INT_MBA_USA', intentName: 'Top US Business Schools', intentDescription: 'Analyze your profile for Top 20 US Programs.',
            intentHorizonDays: 730, intentType: 'DECISION', primaryOutcome: 'ADMISSION_GUIDANCE', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: false
        },
        {
            intentId: 'INT_MBA_EUROPE', intentName: 'Top European Schools', intentDescription: 'Analyze your profile for Top 10 European Programs.',
            intentHorizonDays: 365, intentType: 'DECISION', primaryOutcome: 'ADMISSION_GUIDANCE', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: false
        }
    ]);

    // ── Playbook ──
    await Playbooks.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await Playbooks.insertMany([{
        playbookId: 'PB_MBA_BREAK',
        playbookVersionId: 'PBV_000002',
        playbookName: 'MBA Career Break Decision — 12 Month Window',
        version: 'v1.0',
        caseId: 'CASE_MBA_BREAK',
        intentId: 'INT_MBA_2026_YESNO',
        documentPolicyId: 'DOCPOLICY_V1_STD',
        documentMandatory: true,
        allowedDocumentFormats: 'PDF|DOCX',
        adversarialMirrorEnabled: false,
        allowedLlms: 'GEMINI|OPENAI',
        normalisationLlm: 'GEMINI',
        mandatoryDocumentFields: 'current_role|experience_years|skills|current_company|domain',
        objectiveInputSchemaId: 'MOI_MBA_V1',
        outputContracts: 'INTEGRITY_PACK|VERDICT|FINANCIAL_RESILIENCE|MARKET_SIGNALS',
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
        isActive: true,
        notes: 'MVP playbook v1 for MBA decision'
    }]);

    // ── CaseIntentConfig ──
    await CaseIntentConfig.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await CaseIntentConfig.insertMany([
        { caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', playbookVersionId: 'PBV_000002', isDefault: true, displayOrder: 1, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
        { caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_USA', playbookVersionId: 'PBV_000002', isDefault: false, displayOrder: 2, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false },
        { caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_EUROPE', playbookVersionId: 'PBV_000002', isDefault: false, displayOrder: 3, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false }
    ]);

    // ── Questions ──
    await Questions.deleteMany({ caseScope: 'CASE_MBA_BREAK' });
    await Questions.insertMany([
        {
            questionId: 'Q_MBA_SAVINGS_RUNWAY_V1',
            questionText: 'How many months of living expenses can you cover during your MBA (including tuition gap)?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Less than 6 months', score: 1 },
                { opt: '6 to 12 months', score: 2 },
                { opt: '12 to 24 months', score: 3 },
                { opt: 'More than 24 months', score: 4 }
            ],
            scoreMode: 'DIRECT',
            defaultWeight: 0.30,
            caseScope: 'CASE_MBA_BREAK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_MBA_SAVINGS_V1',
            scoringType: 'MCQ_MAP',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'HIGHER_IS_BETTER',
            curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 40 },
                { optionScore: 3, normalizedScore: 75 },
                { optionScore: 4, normalizedScore: 95 }
            ]
        },
        {
            questionId: 'Q_MBA_EMPLOYER_SUPPORT_V1',
            questionText: 'Does your employer offer sponsorship or guaranteed re-hire after MBA?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'No support at all', score: 1 },
                { opt: 'Partial support — no guarantee', score: 2 },
                { opt: 'Full sponsorship or guaranteed re-hire', score: 3 }
            ],
            scoreMode: 'DIRECT',
            defaultWeight: 0.25,
            caseScope: 'CASE_MBA_BREAK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_MBA_EMPLOYER_V1',
            scoringType: 'MCQ_MAP',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'HIGHER_IS_BETTER',
            curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 15 },
                { optionScore: 2, normalizedScore: 55 },
                { optionScore: 3, normalizedScore: 95 }
            ]
        },
        {
            questionId: 'Q_MBA_ROI_CLARITY_V1',
            questionText: 'Do you have a clear post-MBA career target with defined salary uplift?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'No clear plan — exploring options', score: 1 },
                { opt: 'Vague direction — no specific role target', score: 2 },
                { opt: 'Clear target role with salary expectation defined', score: 3 }
            ],
            scoreMode: 'DIRECT',
            defaultWeight: 0.25,
            caseScope: 'CASE_MBA_BREAK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_MBA_ROI_V1',
            scoringType: 'MCQ_MAP',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'HIGHER_IS_BETTER',
            curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 45 },
                { optionScore: 3, normalizedScore: 90 }
            ]
        },
        {
            questionId: 'Q_MBA_EXPERIENCE_YEARS_V1',
            questionText: 'How many years of work experience do you have before this MBA?',
            questionType: 'NUMERIC',
            scoreMode: 'DIRECT',
            defaultWeight: 0.20,
            caseScope: 'CASE_MBA_BREAK',
            intentScope: 'ALL',
            isMandatory: true,
            isActive: true,
            scoringRuleId: 'SR_MBA_EXP_V1',
            scoringType: 'NUMERIC_RANGE',
            normalizationMin: 0,
            normalizationMax: 100,
            direction: 'HIGHER_IS_BETTER',
            numericMin: 0,
            numericMax: 20,
            outOfRangePolicy: 'CLAMP',
            roundingRule: 'ROUND',
            validationJson: { min: 0, max: 20, unit: 'years' },
            scoringMapJson: [
                { minVal: 0, maxVal: 1, normalizedScore: 10 },
                { minVal: 2, maxVal: 3, normalizedScore: 40 },
                { minVal: 4, maxVal: 6, normalizedScore: 80 },
                { minVal: 7, maxVal: 10, normalizedScore: 95 },
                { minVal: 11, maxVal: 20, normalizedScore: 70 }
            ]
        }
    ]);

    // ── MandatoryObjectiveInput ──
    await MandatoryObjectiveInput.deleteMany({ moiId: 'MOI_MBA_V1' });
    await MandatoryObjectiveInput.insertMany([{
        moiId: 'MOI_MBA_V1',
        moiName: 'MBA Decision — Mandatory Inputs',
        caseId: 'CASE_MBA_BREAK',
        intentId: 'INT_MBA_2026_YESNO',
        playbookVersionId: 'PBV_000002',
        version: 'v1.0',
        description: 'Inputs required for MBA decision validation',
        isActive: true
    }]);

    // ── MoiQuestionMapping ──
    await MoiQuestionMapping.deleteMany({ moiId: 'MOI_MBA_V1' });
    await MoiQuestionMapping.insertMany([
        { moiqmId: 'MOIQM_MBA_001', moiId: 'MOI_MBA_V1', questionId: 'Q_MBA_SAVINGS_RUNWAY_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 1, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_MBA_002', moiId: 'MOI_MBA_V1', questionId: 'Q_MBA_EMPLOYER_SUPPORT_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 2, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_MBA_003', moiId: 'MOI_MBA_V1', questionId: 'Q_MBA_ROI_CLARITY_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 3, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_MBA_004', moiId: 'MOI_MBA_V1', questionId: 'Q_MBA_EXPERIENCE_YEARS_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'MEDIUM', displayOrder: 4, dependencyRuleId: null, isActive: true },
    ]);

    // ── Constraints ──
    await Constraints.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await Constraints.insertMany([
        {
            constraintId: 'CONS_MBA_001',
            constraintSetId: 'CT_MBA_V1',
            thresholdSetId: 'CT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            constraintName: 'Financial Runway for MBA',
            constraintDescription: 'Measures if user has enough savings to sustain through MBA without income.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 1,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        },
        {
            constraintId: 'CONS_MBA_002',
            constraintSetId: 'CT_MBA_V1',
            thresholdSetId: 'CT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            constraintName: 'Employer Support & Safety Net',
            constraintDescription: 'Measures institutional backing — sponsorship or guaranteed re-hire.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 2,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        },
        {
            constraintId: 'CONS_MBA_003',
            constraintSetId: 'CT_MBA_V1',
            thresholdSetId: 'CT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            constraintName: 'ROI Clarity & Career Target',
            constraintDescription: 'Measures whether user has a clear post-MBA career plan and ROI expectation.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 3,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        },
        {
            constraintId: 'CONS_MBA_004',
            constraintSetId: 'CT_MBA_V1',
            thresholdSetId: 'CT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            constraintName: 'Work Experience Readiness',
            constraintDescription: 'Measures whether user has sufficient pre-MBA work experience for top programs.',
            scoringModel: 'WEIGHTED_AVG',
            isBlockingConstraint: false,
            displayOrder: 4,
            strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1,
            moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2,
            fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3,
            criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4,
            isActive: true
        }
    ]);

    // ── ConstraintQuestionMapping ──
    await ConstraintQuestionMapping.deleteMany({ constraintId: { $in: ['CONS_MBA_001', 'CONS_MBA_002', 'CONS_MBA_003', 'CONS_MBA_004'] } });
    await ConstraintQuestionMapping.insertMany([
        { cqmtId: 'CQMT_MBA_001', constraintId: 'CONS_MBA_001', questionId: 'Q_MBA_SAVINGS_RUNWAY_V1', scoringRuleId: 'SR_MBA_SAVINGS_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_MBA_002', constraintId: 'CONS_MBA_002', questionId: 'Q_MBA_EMPLOYER_SUPPORT_V1', scoringRuleId: 'SR_MBA_EMPLOYER_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_MBA_003', constraintId: 'CONS_MBA_003', questionId: 'Q_MBA_ROI_CLARITY_V1', scoringRuleId: 'SR_MBA_ROI_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_MBA_004', constraintId: 'CONS_MBA_004', questionId: 'Q_MBA_EXPERIENCE_YEARS_V1', scoringRuleId: 'SR_MBA_EXP_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
    ]);

    // ── Contradictions ──
    await Contradictions.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await Contradictions.insertMany([
        {
            contradictionId: 'CONTR_MBA_001',
            contradictionSetId: 'CONTR_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            contradictionName: 'No Plan + No Savings',
            contradictionDescription: 'User has no ROI clarity and also no savings runway — highest risk combination.',
            contradictionType: 'INPUT_VS_INPUT',
            involvedEntitiesJson: { questionIds: ['Q_MBA_ROI_CLARITY_V1', 'Q_MBA_SAVINGS_RUNWAY_V1'] },
            defaultSeverityBand: 'CRITICAL',
            ruleName: 'No Plan No Savings Rule',
            ruleJson: {
                operator: 'AND',
                conditions: [
                    { field: 'Q_MBA_ROI_CLARITY_V1', operator: 'EQ', value: 1 },
                    { field: 'Q_MBA_SAVINGS_RUNWAY_V1', operator: 'EQ', value: 1 }
                ]
            },
            evaluationMode: 'STRICT',
            onMissingData: 'NOT_EVALUATED',
            severityBand: 'CRITICAL',
            accuracyPenaltyPoints: 20,
            confidencePenaltyPoints: 0,
            isBlocking: false,
            escalationTag: null,
            maxTriggerCount: 1,
            isActive: true
        }
    ]);

    // ── CoverageRequirements ──
    await CoverageRequirements.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await CoverageRequirements.insertMany([
        {
            crtId: 'CRT_MBA_001',
            coverageSetId: 'CRT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            anchorName: 'Financial Runway',
            requiredSourcesJson: { questionIds: ['Q_MBA_SAVINGS_RUNWAY_V1'] },
            minimumEvidenceCount: 1,
            allowsPartial: false,
            missingPenaltyPoints: 15,
            partialPenaltyPoints: 7,
            reasoningBlockFlag: true,
            gapType: 'MISSING',
            stackingMode: 'CAP',
            stackingCapPoints: 15,
            escalationThreshold: null,
            escalationPenaltyPoints: null,
            displayOrder: 1,
            isActive: true
        },
        {
            crtId: 'CRT_MBA_002',
            coverageSetId: 'CRT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
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
            escalationThreshold: null,
            escalationPenaltyPoints: null,
            displayOrder: 2,
            isActive: true
        }
    ]);

    // ── RedFlagTaxonomy ──
    await RedFlagTaxonomy.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await RedFlagTaxonomy.insertMany([
        {
            redFlagId: 'RF_MBA_001',
            redFlagSetId: 'RFT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            redFlagName: 'Critical Financial Vulnerability for MBA',
            triggerSource: 'CONSTRAINT',
            triggerReferenceId: 'CONS_MBA_001',
            severityBand: 'CRITICAL',
            penaltyPoints: 25,
            uniquenessMode: 'UNIQUE',
            remediationCode: 'REM_FIN_PLAN',
            escalationRequired: true,
            displayOrder: 1,
            isActive: true
        },
        {
            redFlagId: 'RF_MBA_002',
            redFlagSetId: 'RFT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            redFlagName: 'No Career Plan for Post-MBA',
            triggerSource: 'CONSTRAINT',
            triggerReferenceId: 'CONS_MBA_003',
            severityBand: 'HIGH',
            penaltyPoints: 20,
            uniquenessMode: 'UNIQUE',
            remediationCode: 'REM_CAREER_PLAN',
            escalationRequired: false,
            displayOrder: 2,
            isActive: true
        },
        {
            redFlagId: 'RF_MBA_003',
            redFlagSetId: 'RFT_MBA_V1',
            caseId: 'CASE_MBA_BREAK',
            intentId: 'INT_MBA_2026_YESNO',
            redFlagName: 'No Plan and No Savings — Extreme Risk',
            triggerSource: 'CONTRADICTION',
            triggerReferenceId: 'CONTR_MBA_001',
            severityBand: 'CRITICAL',
            penaltyPoints: 0,
            uniquenessMode: 'UNIQUE',
            escalationRequired: true,
            displayOrder: 3,
            isActive: true
        }
    ]);

    // ── AccuracyScoringPolicy ──
    await AccuracyScoringPolicy.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await AccuracyScoringPolicy.insertMany([{
        accuracyPolicyId: 'ASP_MBA_V1',
        policyName: 'MBA Break Accuracy Policy v1',
        caseId: 'CASE_MBA_BREAK',
        intentId: 'INT_MBA_2026_YESNO',
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
    }]);

    // ── Warnings ──
    await Warnings.deleteMany({ redFlagId: { $in: ['RF_MBA_001', 'RF_MBA_002', 'RF_MBA_003'] } });
    await Warnings.insertMany([
        {
            warningId: 'WARN_MBA_FIN_LOW',
            warningMappingId: 'WMT_MBA_V1',
            redFlagId: 'RF_MBA_001',
            triggerMode: 'ALWAYS',
            minSeverityBand: null,
            displayPriority: 1,
            warningTitle: 'Savings Are Insufficient for MBA',
            warningMessage: 'You have less than 6 months of financial runway to cover MBA costs and living expenses. This is critically low. Most MBA programs require 18-24 months of financial buffer.',
            severityBand: 'CRITICAL',
            advisoryType: 'ACTION_REQUIRED',
            ctaText: 'Build at least 18 months of savings before committing to an MBA break.',
            humanValidationRecommended: true,
            displayType: 'TOP_BANNER',
            expiresAfterDays: null,
            isActive: true
        },
        {
            warningId: 'WARN_MBA_NO_PLAN',
            warningMappingId: 'WMT_MBA_V1',
            redFlagId: 'RF_MBA_002',
            triggerMode: 'ALWAYS',
            minSeverityBand: null,
            displayPriority: 2,
            warningTitle: 'No Clear Post-MBA Career Target',
            warningMessage: 'MBA ROI depends entirely on having a clear target role and salary expectation. Without this, an MBA is a high-cost exploration — not a strategic investment.',
            severityBand: 'HIGH',
            advisoryType: 'ACTION_REQUIRED',
            ctaText: 'Define your target role, industry, and expected salary before applying.',
            humanValidationRecommended: false,
            displayType: 'REPORT_SECTION',
            expiresAfterDays: null,
            isActive: true
        }
    ]);

    // ── DecisionAssuranceSections ──
    await DecisionAssuranceSections.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await DecisionAssuranceSections.insertMany([
        { sectionId: 'MBA_SEC_001', sectionName: 'Profile & Readiness Summary', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', sectionOrder: 1, sectionType: 'ANALYSIS', allowedAeuTypesJson: ['identity', 'work', 'composition', 'inferred'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true },
        { sectionId: 'MBA_SEC_002', sectionName: 'Financial Feasibility Assessment', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', sectionOrder: 2, sectionType: 'RISK_SYNTHESIS', allowedAeuTypesJson: ['inferred', 'work'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: ['Financial Runway'], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true },
        { sectionId: 'MBA_SEC_003', sectionName: 'Market Signals & ROI Outlook', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', sectionOrder: 3, sectionType: 'ANALYSIS', allowedAeuTypesJson: ['external'], certaintyCapPercent: 70, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: ['Market Demand Signal'], outputSchemaReference: null, isActive: true },
        { sectionId: 'MBA_SEC_004', sectionName: 'Verdict', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', sectionOrder: 4, sectionType: 'VERDICT', allowedAeuTypesJson: ['identity', 'work', 'inferred', 'external'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'ESCALATE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true }
    ]);

    // ── PromptConfigRegistry ──
    await PromptConfigRegistry.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await PromptConfigRegistry.insertMany([
        {
            promptId: 'PCR_MBA_SEC001_V1', sectionId: 'MBA_SEC_001', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', playbookVersionId: 'PBV_000002', promptVersion: 1, modelFamily: 'OPENAI', temperature: 0.3, maxTokens: 600,
            systemPrompt: 'You are a career decision analyst for Hawksyn. Write only what evidence supports. Do not introduce external facts.',
            userPrompt: `Write a 4-sentence Profile and Readiness Summary for this user considering an MBA.\n\nProfile:\n- Current Role: {{CURRENT_ROLE}}\n- Experience: {{EXPERIENCE_YEARS}} years at {{CURRENT_COMPANY}}\n- Domain: {{DOMAIN}}\n- Skills: {{SKILLS}}\n\nUser's Inputs:\n- Savings Runway: {{MBA_SAVINGS_RUNWAY}}\n- Employer Support: {{MBA_EMPLOYER_SUPPORT}}\n- ROI Clarity: {{MBA_ROI_CLARITY}}\n- Work Experience: {{MBA_EXPERIENCE_YEARS}} years\n\nIntegrity Results:\n- Accuracy Score: {{ACCURACY_SCORE}} (Band: {{ACCURACY_BAND}})\n- Red Flags: {{RED_FLAGS}}\n\nWrite based ONLY on this data. Be direct and specific. Do not give generic MBA advice.`,
            evidencePlaceholdersJson: { 
                CURRENT_ROLE: 'identity.currentRole', 
                EXPERIENCE_YEARS: 'work.totalYearsExperience',
                CURRENT_COMPANY: 'work.experience.0.company',
                DOMAIN: 'identity.industry',
                SKILLS: 'skills',
                MBA_SAVINGS_RUNWAY: 'Q_MBA_SAVINGS_RUNWAY_V1',
                MBA_EMPLOYER_SUPPORT: 'Q_MBA_EMPLOYER_SUPPORT_V1',
                MBA_ROI_CLARITY: 'Q_MBA_ROI_CLARITY_V1',
                MBA_EXPERIENCE_YEARS: 'Q_MBA_EXPERIENCE_YEARS_V1'
            },
            certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true
        },
        {
            promptId: 'PCR_MBA_SEC002_V1', sectionId: 'MBA_SEC_002', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', playbookVersionId: 'PBV_000002', promptVersion: 1, modelFamily: 'GEMINI', temperature: 0.3, maxTokens: 600,
            systemPrompt: 'You are a financial feasibility analyst for Hawksyn. Assess MBA financial viability. Be factual. Do not invent numbers.',
            userPrompt: `Assess the financial feasibility of this user's MBA plan.\n\nSavings Runway: {{MBA_SAVINGS_RUNWAY}}\nEmployer Support: {{MBA_EMPLOYER_SUPPORT}}\nAccuracy Band: {{ACCURACY_BAND}}\nRed Flags: {{RED_FLAGS}}\n\nWrite 2-3 paragraphs:\n1. Is the financial position adequate for an MBA break?\n2. What happens if the user goes ahead without adequate savings?\n3. What immediate action is recommended?`,
            evidencePlaceholdersJson: { 
                MBA_SAVINGS_RUNWAY: 'Q_MBA_SAVINGS_RUNWAY_V1',
                MBA_EMPLOYER_SUPPORT: 'Q_MBA_EMPLOYER_SUPPORT_V1'
            },
            certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true
        },
        {
            promptId: 'PCR_MBA_SEC003_V1', sectionId: 'MBA_SEC_003', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', playbookVersionId: 'PBV_000002', promptVersion: 1, modelFamily: 'GEMINI', temperature: 0.4, maxTokens: 500,
            systemPrompt: 'You are a market signals analyst for Hawksyn. Summarize MBA market ROI conditions. Use only provided data.',
            userPrompt: `Analyze market conditions for MBA ROI for this user.\n\nUser: {{CURRENT_ROLE}} in {{DOMAIN}} with {{EXPERIENCE_YEARS}} years experience\nMarket Demand Signal: {{MARKET_DEMAND_SIGNAL}}\nAI Displacement Risk: {{AI_DISPLACEMENT_RISK}}\nIndustry Hiring Trend: {{INDUSTRY_HIRING_TREND}}\nAccuracy Band: {{ACCURACY_BAND}}\nAnalyst Note: {{ANALYST_NOTE}}\n\nWrite 3-4 sentences on MBA ROI signals for this profile. End with one direct implication.`,
            evidencePlaceholdersJson: { 
                CURRENT_ROLE: 'identity.currentRole',
                DOMAIN: 'identity.industry',
                EXPERIENCE_YEARS: 'work.totalYearsExperience'
            },
            certaintyCapPercent: 70, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true
        },
        {
            promptId: 'PCR_MBA_SEC004_V1', sectionId: 'MBA_SEC_004', caseId: 'CASE_MBA_BREAK', intentId: 'INT_MBA_2026_YESNO', playbookVersionId: 'PBV_000002', promptVersion: 1, modelFamily: 'OPENAI', temperature: 0.2, maxTokens: 400,
            systemPrompt: 'You are the verdict engine for Hawksyn MBA decisions. Deliver PROCEED, PAUSE, or ABORT. Base verdict solely on provided integrity data.',
            userPrompt: `Deliver a verdict on whether this user should pursue MBA now.\n\nAccuracy Score: {{ACCURACY_SCORE}}\nAccuracy Band: {{ACCURACY_BAND}}\nRed Flags: {{RED_FLAGS}}\nContradictions: {{CONTRADICTIONS}}\n\nYour first line MUST be: PROCEED, PAUSE, or ABORT\nThen 3-4 sentences explaining the verdict.\nEnd with one clear recommendation.`,
            evidencePlaceholdersJson: { 
                ACCURACY_SCORE: 'INTEGRITY.score',
                ACCURACY_BAND: 'INTEGRITY.band',
                RED_FLAGS: 'INTEGRITY.redFlags',
                CONTRADICTIONS: 'INTEGRITY.contradictions'
            },
            certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true
        }
    ]);

    // ── EvaluationLibraryRegistry ──
    await EvaluationLibraryRegistry.deleteMany({ caseId: 'CASE_MBA_BREAK' });
    await EvaluationLibraryRegistry.insertMany([{
        elrId: 'ELR_0002',
        elrName: 'MBA Break — Decision Library',
        caseId: 'CASE_MBA_BREAK',
        intentId: 'INT_MBA_2026_YESNO',
        playbookVersionId: 'PBV_000002',
        documentPolicyId: 'DOCPOLICY_V1_STD',
        constraintSetId: 'CT_MBA_V1',
        contradictionSetId: 'CONTR_MBA_V1',
        coverageSetId: 'CRT_MBA_V1',
        redFlagSetId: 'RFT_MBA_V1',
        accuracyPolicyId: 'ASP_MBA_V1',
        warningMappingId: 'WMT_MBA_V1',
        version: 'v1.0',
        isActive: true
    }]);

    console.log('✅ CASE_MBA_BREAK seeded');
}

async function seedCase_Freelance() {

    await CaseRegistry.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await CaseRegistry.insertMany([{
        caseId: 'CASE_FREELANCE_SWITCH',
        caseName: 'Should I switch to freelancing?',
        caseCategory: 'DECISION',
        caseDescription: 'Validates whether switching from full-time employment to freelancing is financially and professionally viable.',
        launchStage: 'MVP',
        defaultCurrency: 'INR',
        minPrice: 999,
        maxPrice: 2999,
        documentRequired: true,
        isActive: true,
        logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 5 L88 20 L88 52 C88 72 70 88 50 95 C30 88 12 72 12 52 L12 20 Z" fill="#1E1E2E" stroke="#FFA500" stroke-width="2.5"/><circle cx="50" cy="45" r="18" fill="none" stroke="#FFA500" stroke-width="1.8"/><path d="M38 45 Q50 32 62 45 Q50 58 38 45Z" fill="#FFA500" opacity="0.7"/><circle cx="50" cy="45" r="5" fill="#FFA500"/><line x1="50" y1="27" x2="50" y2="22" stroke="#FFA500" stroke-width="1.5"/><line x1="50" y1="63" x2="50" y2="68" stroke="#FFA500" stroke-width="1.5"/><line x1="32" y1="45" x2="27" y2="45" stroke="#FFA500" stroke-width="1.5"/><line x1="68" y1="45" x2="73" y2="45" stroke="#FFA500" stroke-width="1.5"/></svg>`
    }]);

    await IntentTaxonomy.deleteMany({ intentId: 'INT_FREELANCE_6M' });
    await IntentTaxonomy.insertMany([
        {
            intentId: 'INT_FREELANCE_6M',
            intentName: 'Switch to freelancing in the next 6 months',
            intentDescription: 'Validate whether the conditions are right to transition to full-time freelancing within 6 months.',
            intentHorizonDays: 180,
            intentType: 'SWITCH',
            primaryOutcome: 'TRANSITION_PLAN',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: true
        },
        {
            intentId: 'INT_FREELANCE_3M',
            intentName: 'Immediate Switch (3 Months)',
            intentDescription: 'High-speed transition to freelance.',
            intentHorizonDays: 90,
            intentType: 'SWITCH',
            primaryOutcome: 'TRANSITION_PLAN',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: true
        },
        {
            intentId: 'INT_FREELANCE_SIDE',
            intentName: 'Start as Side-Hustle First',
            intentDescription: 'Build freelance while working full-time.',
            intentHorizonDays: 180,
            intentType: 'DECISION',
            primaryOutcome: 'SIDE_HUSTLE_PLAN',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: true
        }
    ]);

    await Playbooks.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await Playbooks.insertMany([{
        playbookId: 'PB_FREELANCE_SWITCH',
        playbookVersionId: 'PBV_000003',
        playbookName: 'Freelance Switch Decision — 6 Month Window',
        version: 'v1.0',
        caseId: 'CASE_FREELANCE_SWITCH',
        intentId: 'INT_FREELANCE_6M',
        documentPolicyId: 'DOCPOLICY_V1_STD',
        documentMandatory: true,
        allowedDocumentFormats: 'PDF|DOCX',
        adversarialMirrorEnabled: false,
        allowedLlms: 'GEMINI|OPENAI',
        normalisationLlm: 'GEMINI',
        mandatoryDocumentFields: 'current_role|experience_years|skills|current_company|domain',
        objectiveInputSchemaId: 'MOI_FREELANCE_V1',
        outputContracts: 'INTEGRITY_PACK|VERDICT|FINANCIAL_RESILIENCE|MARKET_SIGNALS',
        layerGuardrails: { L2: 'no_hallucination', L3: 'citation_required', L4: 'certainty_cap_by_accuracy_band' },
        configJson: { verdictOptions: ['PROCEED', 'PAUSE', 'ABORT'], minAccuracyForProceed: 70, maxRedFlagsForProceed: 0 },
        effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, notes: 'MVP playbook v1 for freelance switch'
    }]);

    await CaseIntentConfig.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await CaseIntentConfig.insertMany([
        { caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003', isDefault: true, displayOrder: 1, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
        { caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_3M', playbookVersionId: 'PBV_000003', isDefault: false, displayOrder: 2, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false },
        { caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_SIDE', playbookVersionId: 'PBV_000003', isDefault: false, displayOrder: 3, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false }
    ]);

    await Questions.deleteMany({ caseScope: 'CASE_FREELANCE_SWITCH' });
    await Questions.insertMany([
        {
            questionId: 'Q_FL_SAVINGS_RUNWAY_V1',
            questionText: 'How many months of expenses can you cover if freelance income is zero for the first few months?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Less than 3 months', score: 1 },
                { opt: '3 to 6 months', score: 2 },
                { opt: '6 to 12 months', score: 3 },
                { opt: 'More than 12 months', score: 4 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.30, caseScope: 'CASE_FREELANCE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_FL_SAVINGS_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 5 },
                { optionScore: 2, normalizedScore: 35 },
                { optionScore: 3, normalizedScore: 70 },
                { optionScore: 4, normalizedScore: 95 }
            ]
        },
        {
            questionId: 'Q_FL_CLIENT_NETWORK_V1',
            questionText: 'Do you already have paying clients or confirmed leads for freelance work?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'No clients at all — starting from zero', score: 1 },
                { opt: 'Some leads but no confirmed paying clients', score: 2 },
                { opt: '1 to 2 confirmed paying clients', score: 3 },
                { opt: '3 or more confirmed paying clients', score: 4 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.35, caseScope: 'CASE_FREELANCE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_FL_CLIENT_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 5 },
                { optionScore: 2, normalizedScore: 35 },
                { optionScore: 3, normalizedScore: 70 },
                { optionScore: 4, normalizedScore: 95 }
            ]
        },
        {
            questionId: 'Q_FL_SKILL_MARKETABILITY_V1',
            questionText: 'How in-demand are your skills in the freelance marketplace right now?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Low demand — mostly company-internal skills', score: 1 },
                { opt: 'Moderate demand — some freelance market', score: 2 },
                { opt: 'High demand — actively sought by multiple companies', score: 3 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.20, caseScope: 'CASE_FREELANCE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_FL_SKILL_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 55 },
                { optionScore: 3, normalizedScore: 90 }
            ]
        },
        {
            questionId: 'Q_FL_DEPENDENTS_V1',
            questionText: 'Do you have financial dependents (family, EMIs, loans) that require fixed monthly income?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Yes — heavy financial obligations', score: 1 },
                { opt: 'Yes — moderate obligations', score: 2 },
                { opt: 'Minimal or no fixed obligations', score: 3 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.15, caseScope: 'CASE_FREELANCE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_FL_DEPENDENTS_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 50 },
                { optionScore: 3, normalizedScore: 90 }
            ]
        }
    ]);

    await MandatoryObjectiveInput.deleteMany({ moiId: 'MOI_FREELANCE_V1' });
    await MandatoryObjectiveInput.insertMany([{
        moiId: 'MOI_FREELANCE_V1', moiName: 'Freelance Switch — Mandatory Inputs',
        caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003',
        version: 'v1.0', description: 'Inputs required for freelance switch validation', isActive: true
    }]);

    await MoiQuestionMapping.deleteMany({ moiId: 'MOI_FREELANCE_V1' });
    await MoiQuestionMapping.insertMany([
        { moiqmId: 'MOIQM_FL_001', moiId: 'MOI_FREELANCE_V1', questionId: 'Q_FL_SAVINGS_RUNWAY_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 1, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_FL_002', moiId: 'MOI_FREELANCE_V1', questionId: 'Q_FL_CLIENT_NETWORK_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 2, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_FL_003', moiId: 'MOI_FREELANCE_V1', questionId: 'Q_FL_SKILL_MARKETABILITY_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'MEDIUM', displayOrder: 3, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_FL_004', moiId: 'MOI_FREELANCE_V1', questionId: 'Q_FL_DEPENDENTS_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'MEDIUM', displayOrder: 4, dependencyRuleId: null, isActive: true },
    ]);

    await Constraints.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await Constraints.insertMany([
        { constraintId: 'CONS_FL_001', constraintSetId: 'CT_FL_V1', thresholdSetId: 'CT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', constraintName: 'Financial Safety Net', constraintDescription: 'Measures savings runway to survive initial zero-income freelance months.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 1, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true },
        { constraintId: 'CONS_FL_002', constraintSetId: 'CT_FL_V1', thresholdSetId: 'CT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', constraintName: 'Client Network Strength', constraintDescription: 'Measures existing client pipeline before making the switch.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 2, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true },
        { constraintId: 'CONS_FL_003', constraintSetId: 'CT_FL_V1', thresholdSetId: 'CT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', constraintName: 'Skill Marketability', constraintDescription: 'Measures how portable and in-demand the user skills are in freelance market.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 3, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true },
        { constraintId: 'CONS_FL_004', constraintSetId: 'CT_FL_V1', thresholdSetId: 'CT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', constraintName: 'Fixed Obligation Risk', constraintDescription: 'Measures how much financial obligation the user carries that requires fixed income.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 4, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true }
    ]);

    await ConstraintQuestionMapping.deleteMany({ constraintId: { $in: ['CONS_FL_001', 'CONS_FL_002', 'CONS_FL_003', 'CONS_FL_004'] } });
    await ConstraintQuestionMapping.insertMany([
        { cqmtId: 'CQMT_FL_001', constraintId: 'CONS_FL_001', questionId: 'Q_FL_SAVINGS_RUNWAY_V1', scoringRuleId: 'SR_FL_SAVINGS_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_FL_002', constraintId: 'CONS_FL_002', questionId: 'Q_FL_CLIENT_NETWORK_V1', scoringRuleId: 'SR_FL_CLIENT_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_FL_003', constraintId: 'CONS_FL_003', questionId: 'Q_FL_SKILL_MARKETABILITY_V1', scoringRuleId: 'SR_FL_SKILL_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_FL_004', constraintId: 'CONS_FL_004', questionId: 'Q_FL_DEPENDENTS_V1', scoringRuleId: 'SR_FL_DEPENDENTS_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
    ]);

    await Contradictions.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await Contradictions.insertMany([
        { contradictionId: 'CONTR_FL_001', contradictionSetId: 'CONTR_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', contradictionName: 'Zero Clients + Heavy Obligations', contradictionDescription: 'No clients at all but heavy financial obligations — extreme risk combination.', contradictionType: 'INPUT_VS_INPUT', involvedEntitiesJson: { questionIds: ['Q_FL_CLIENT_NETWORK_V1', 'Q_FL_DEPENDENTS_V1'] }, defaultSeverityBand: 'CRITICAL', ruleName: 'Zero Client Heavy Obligation Rule', ruleJson: { operator: 'AND', conditions: [{ field: 'Q_FL_CLIENT_NETWORK_V1', operator: 'EQ', value: 1 }, { field: 'Q_FL_DEPENDENTS_V1', operator: 'EQ', value: 1 }] }, evaluationMode: 'STRICT', onMissingData: 'NOT_EVALUATED', severityBand: 'CRITICAL', accuracyPenaltyPoints: 20, confidencePenaltyPoints: 0, isBlocking: false, escalationTag: null, maxTriggerCount: 1, isActive: true }
    ]);

    await CoverageRequirements.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await CoverageRequirements.insertMany([
        { crtId: 'CRT_FL_001', coverageSetId: 'CRT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', anchorName: 'Financial Runway', requiredSourcesJson: { questionIds: ['Q_FL_SAVINGS_RUNWAY_V1'] }, minimumEvidenceCount: 1, allowsPartial: false, missingPenaltyPoints: 15, partialPenaltyPoints: 7, reasoningBlockFlag: true, gapType: 'MISSING', stackingMode: 'CAP', stackingCapPoints: 15, escalationThreshold: null, escalationPenaltyPoints: null, displayOrder: 1, isActive: true },
        { crtId: 'CRT_FL_002', coverageSetId: 'CRT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', anchorName: 'Market Demand Signal', requiredSourcesJson: { externalSignalIds: ['EST_LM_001'] }, minimumEvidenceCount: 1, allowsPartial: true, missingPenaltyPoints: 10, partialPenaltyPoints: 5, reasoningBlockFlag: false, gapType: 'MISSING', stackingMode: 'CAP', stackingCapPoints: 10, escalationThreshold: null, escalationPenaltyPoints: null, displayOrder: 2, isActive: true }
    ]);

    await RedFlagTaxonomy.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await RedFlagTaxonomy.insertMany([
        { redFlagId: 'RF_FL_001', redFlagSetId: 'RFT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', redFlagName: 'Critically Low Financial Safety Net', triggerSource: 'CONSTRAINT', triggerReferenceId: 'CONS_FL_001', severityBand: 'CRITICAL', penaltyPoints: 25, uniquenessMode: 'UNIQUE', remediationCode: 'REM_FIN_PLAN', escalationRequired: true, displayOrder: 1, isActive: true },
        { redFlagId: 'RF_FL_002', redFlagSetId: 'RFT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', redFlagName: 'Zero Client Network', triggerSource: 'CONSTRAINT', triggerReferenceId: 'CONS_FL_002', severityBand: 'CRITICAL', penaltyPoints: 25, uniquenessMode: 'UNIQUE', remediationCode: 'REM_BUILD_NETWORK', escalationRequired: true, displayOrder: 2, isActive: true },
        { redFlagId: 'RF_FL_003', redFlagSetId: 'RFT_FL_V1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', redFlagName: 'Zero Clients + Heavy Obligations', triggerSource: 'CONTRADICTION', triggerReferenceId: 'CONTR_FL_001', severityBand: 'CRITICAL', penaltyPoints: 0, uniquenessMode: 'UNIQUE', escalationRequired: true, displayOrder: 3, isActive: true }
    ]);

    await AccuracyScoringPolicy.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await AccuracyScoringPolicy.insertMany([{ accuracyPolicyId: 'ASP_FL_V1', policyName: 'Freelance Switch Accuracy Policy v1', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', baseScore: 100, aggregationMode: 'ADDITIVE', maxTotalPenalty: 75, floorScore: 25, escalationThresholdScore: 40, bandRulesJson: { HIGH: { min: 80, max: 100 }, MEDIUM: { min: 60, max: 79 }, LOW: { min: 40, max: 59 }, VERY_LOW: { min: 0, max: 39 } }, isActive: true }]);

    await Warnings.deleteMany({ redFlagId: { $in: ['RF_FL_001', 'RF_FL_002', 'RF_FL_003'] } });
    await Warnings.insertMany([
        { warningId: 'WARN_FL_FIN_LOW', warningMappingId: 'WMT_FL_V1', redFlagId: 'RF_FL_001', triggerMode: 'ALWAYS', minSeverityBand: null, displayPriority: 1, warningTitle: 'Savings Too Low for Freelance Switch', warningMessage: 'You have less than 3 months of savings. Freelance income is unpredictable for the first 3-6 months. This combination is critically risky.', severityBand: 'CRITICAL', advisoryType: 'ACTION_REQUIRED', ctaText: 'Build at least 6-12 months of savings before making the switch.', humanValidationRecommended: true, displayType: 'TOP_BANNER', expiresAfterDays: null, isActive: true },
        { warningId: 'WARN_FL_NO_CLIENTS', warningMappingId: 'WMT_FL_V1', redFlagId: 'RF_FL_002', triggerMode: 'ALWAYS', minSeverityBand: null, displayPriority: 2, warningTitle: 'No Clients — Do Not Switch Yet', warningMessage: 'Starting freelance from zero clients is the highest-risk entry point. Most successful freelancers secure 1-2 clients before leaving employment.', severityBand: 'CRITICAL', advisoryType: 'ACTION_REQUIRED', ctaText: 'Secure at least 1-2 paying clients while still employed before making the switch.', humanValidationRecommended: false, displayType: 'REPORT_SECTION', expiresAfterDays: null, isActive: true }
    ]);

    await DecisionAssuranceSections.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await DecisionAssuranceSections.insertMany([
        { sectionId: 'FL_SEC_001', sectionName: 'Profile & Freelance Readiness', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', sectionOrder: 1, sectionType: 'ANALYSIS', allowedAeuTypesJson: ['identity', 'work', 'composition', 'inferred'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true },
        { sectionId: 'FL_SEC_002', sectionName: 'Financial Safety Net Assessment', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', sectionOrder: 2, sectionType: 'RISK_SYNTHESIS', allowedAeuTypesJson: ['inferred', 'work'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: ['Financial Runway'], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true },
        { sectionId: 'FL_SEC_003', sectionName: 'Market Signals for Freelancers', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', sectionOrder: 3, sectionType: 'ANALYSIS', allowedAeuTypesJson: ['external'], certaintyCapPercent: 70, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: ['Market Demand Signal'], outputSchemaReference: null, isActive: true },
        { sectionId: 'FL_SEC_004', sectionName: 'Verdict', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', sectionOrder: 4, sectionType: 'VERDICT', allowedAeuTypesJson: ['identity', 'work', 'inferred', 'external'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'ESCALATE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true }
    ]);

    await PromptConfigRegistry.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await PromptConfigRegistry.insertMany([
        { 
            promptId: 'PCR_FL_SEC001_V1', sectionId: 'FL_SEC_001', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003', promptVersion: 1, modelFamily: 'OPENAI', temperature: 0.3, maxTokens: 600, 
            systemPrompt: 'You are a career decision analyst for Hawksyn. Write only what evidence supports.', 
            userPrompt: `Write a 4-sentence Freelance Readiness Summary for this user.\n\nProfile:\n- Current Role: {{CURRENT_ROLE}}\n- Experience: {{EXPERIENCE_YEARS}} years at {{CURRENT_COMPANY}}\n- Domain: {{DOMAIN}}\n- Skills: {{SKILLS}}\n\nUser Inputs:\n- Savings Runway: {{FL_SAVINGS_RUNWAY}}\n- Client Network: {{FL_CLIENT_NETWORK}}\n- Skill Marketability: {{FL_SKILL_MARKETABILITY}}\n- Financial Obligations: {{FL_DEPENDENTS}}\n\nIntegrity:\n- Accuracy Score: {{ACCURACY_SCORE}} (Band: {{ACCURACY_BAND}})\n- Red Flags: {{RED_FLAGS}}\n\nBe direct. Reference specific answers. No generic advice.`, 
            evidencePlaceholdersJson: {
                CURRENT_ROLE: 'identity.currentRole',
                EXPERIENCE_YEARS: 'work.totalYearsExperience',
                CURRENT_COMPANY: 'work.experience.0.company',
                DOMAIN: 'identity.industry',
                SKILLS: 'skills',
                FL_SAVINGS_RUNWAY: 'Q_FL_SAVINGS_RUNWAY_V1',
                FL_CLIENT_NETWORK: 'Q_FL_CLIENT_NETWORK_V1',
                FL_SKILL_MARKETABILITY: 'Q_FL_SKILL_MARKETABILITY_V1',
                FL_DEPENDENTS: 'Q_FL_DEPENDENTS_V1'
            }, 
            certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true 
        },
        { 
            promptId: 'PCR_FL_SEC002_V1', sectionId: 'FL_SEC_002', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003', promptVersion: 1, modelFamily: 'GEMINI', temperature: 0.3, maxTokens: 600, 
            systemPrompt: 'You are a financial resilience analyst for Hawksyn. Assess freelance financial safety.', 
            userPrompt: `Assess financial readiness for freelance switch.\n\nSavings Runway: {{FL_SAVINGS_RUNWAY}}\nClient Network: {{FL_CLIENT_NETWORK}}\nFinancial Obligations: {{FL_DEPENDENTS}}\nAccuracy Band: {{ACCURACY_BAND}}\nRed Flags: {{RED_FLAGS}}\n\nWrite 2-3 paragraphs:\n1. Is the financial cushion adequate?\n2. What happens with zero income for 3-6 months?\n3. Recommended immediate action?`, 
            evidencePlaceholdersJson: {
                FL_SAVINGS_RUNWAY: 'Q_FL_SAVINGS_RUNWAY_V1',
                FL_CLIENT_NETWORK: 'Q_FL_CLIENT_NETWORK_V1',
                FL_DEPENDENTS: 'Q_FL_DEPENDENTS_V1'
            }, 
            certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true 
        },
        { 
            promptId: 'PCR_FL_SEC003_V1', sectionId: 'FL_SEC_003', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003', promptVersion: 1, modelFamily: 'GEMINI', temperature: 0.4, maxTokens: 500, 
            systemPrompt: 'You are a market signals analyst for Hawksyn. Analyze freelance market conditions.', 
            userPrompt: `Analyze freelance market for: {{CURRENT_ROLE}} in {{DOMAIN}}\n\nMarket Demand: {{MARKET_DEMAND_SIGNAL}}\nAI Risk: {{AI_DISPLACEMENT_RISK}}\nHiring Trend: {{INDUSTRY_HIRING_TREND}}\nAccuracy Band: {{ACCURACY_BAND}}\n\nWrite 3-4 sentences. End with direct implication for this user.`, 
            evidencePlaceholdersJson: {
                CURRENT_ROLE: 'identity.currentRole',
                DOMAIN: 'identity.industry'
            }, 
            certaintyCapPercent: 70, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true 
        },
        { 
            promptId: 'PCR_FL_SEC004_V1', sectionId: 'FL_SEC_004', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003', promptVersion: 1, modelFamily: 'OPENAI', temperature: 0.2, maxTokens: 400, 
            systemPrompt: 'You are the verdict engine for Hawksyn freelance decisions. PROCEED, PAUSE, or ABORT only.', 
            userPrompt: `Verdict on freelance switch:\n\nAccuracy Score: {{ACCURACY_SCORE}}\nAccuracy Band: {{ACCURACY_BAND}}\nRed Flags: {{RED_FLAGS}}\nContradictions: {{CONTRADICTIONS}}\n\nFirst line: PROCEED, PAUSE, or ABORT\nThen 3-4 sentences with reasoning.\nEnd with one recommendation.`, 
            evidencePlaceholdersJson: {
                ACCURACY_SCORE: 'INTEGRITY.score',
                ACCURACY_BAND: 'INTEGRITY.band',
                RED_FLAGS: 'INTEGRITY.redFlags'
            }, 
            certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true 
        }
    ]);

    await EvaluationLibraryRegistry.deleteMany({ caseId: 'CASE_FREELANCE_SWITCH' });
    await EvaluationLibraryRegistry.insertMany([{ elrId: 'ELR_0003', elrName: 'Freelance Switch — Decision Library', caseId: 'CASE_FREELANCE_SWITCH', intentId: 'INT_FREELANCE_6M', playbookVersionId: 'PBV_000003', documentPolicyId: 'DOCPOLICY_V1_STD', constraintSetId: 'CT_FL_V1', contradictionSetId: 'CONTR_FL_V1', coverageSetId: 'CRT_FL_V1', redFlagSetId: 'RFT_FL_V1', accuracyPolicyId: 'ASP_FL_V1', warningMappingId: 'WMT_FL_V1', version: 'v1.0', isActive: true }]);

    console.log('✅ CASE_FREELANCE_SWITCH seeded');
}

async function seedCase_RoleSwitch() {

    await CaseRegistry.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await CaseRegistry.insertMany([{
        caseId: 'CASE_ROLE_SWITCH',
        caseName: 'Should I switch to a different role?',
        caseCategory: 'DECISION',
        caseDescription: 'Validates whether switching to a different functional role is strategic given current skills and market displacement risk.',
        launchStage: 'MVP',
        defaultCurrency: 'INR',
        minPrice: 999,
        maxPrice: 2999,
        documentRequired: true,
        isActive: true,
        logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 5 L88 20 L88 52 C88 72 70 88 50 95 C30 88 12 72 12 52 L12 20 Z" fill="#1E1E2E" stroke="#FFA500" stroke-width="2.5"/><circle cx="35" cy="45" r="10" fill="none" stroke="#FFA500" stroke-width="1.8"/><circle cx="65" cy="45" r="10" fill="none" stroke="#FFA500" stroke-width="1.8"/><path d="M45 45 L55 45" stroke="#FFA500" stroke-width="2" marker-end="url(#a)"/><path d="M50 38 L57 45 L50 52" fill="none" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round"/><line x1="35" y1="60" x2="65" y2="60" stroke="#FFA500" stroke-width="1" opacity="0.5" stroke-dasharray="3,2"/></svg>`
    }]);

    await IntentTaxonomy.deleteMany({ intentId: { $in: ['INT_SWITCH_ROLE_SAFE', 'INT_SWITCH_INDUSTRY', 'INT_SWITCH_VERTICAL'] } });
    await IntentTaxonomy.insertMany([
        {
            intentId: 'INT_SWITCH_ROLE_SAFE',
            intentName: 'Switch to a different role (Same Industry)',
            intentDescription: 'Evaluate the feasibility and safety of transitioning to a new functional role within 12 months.',
            intentHorizonDays: 365, intentType: 'SWITCH', primaryOutcome: 'DECISION_SAFETY', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: true
        },
        {
            intentId: 'INT_SWITCH_INDUSTRY', intentName: 'Pivot to a new Industry', intentDescription: 'Switch industries while maintaining your functional expertise.',
            intentHorizonDays: 365, intentType: 'SWITCH', primaryOutcome: 'DECISION_SAFETY', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: false
        },
        {
            intentId: 'INT_SWITCH_VERTICAL', intentName: 'Career Jump (Vertical Move)', intentDescription: 'Aggressive switch to a higher-seniority role.',
            intentHorizonDays: 180, intentType: 'SWITCH', primaryOutcome: 'PROMOTION_GUIDANCE', defaultVerdictMode: 'PROCEED_PAUSE_ABORT', isActive: false
        }
    ]);

    await Playbooks.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await Playbooks.insertMany([{
        playbookId: 'PB_ROLE_SWITCH',
        playbookVersionId: 'PBV_000004',
        playbookName: 'Role Switch Decision — 12 Month Window',
        version: 'v1.0',
        caseId: 'CASE_ROLE_SWITCH',
        intentId: 'INT_SWITCH_ROLE_SAFE',
        documentPolicyId: 'DOCPOLICY_V1_STD',
        documentMandatory: true,
        allowedDocumentFormats: 'PDF|DOCX',
        adversarialMirrorEnabled: false,
        allowedLlms: 'GEMINI|OPENAI',
        normalisationLlm: 'GEMINI',
        mandatoryDocumentFields: 'current_role|experience_years|skills|current_company|domain',
        objectiveInputSchemaId: 'MOI_ROLE_SWITCH_V1',
        outputContracts: 'INTEGRITY_PACK|VERDICT|FINANCIAL_RESILIENCE|MARKET_SIGNALS',
        layerGuardrails: { L2: 'no_hallucination', L3: 'citation_required', L4: 'certainty_cap_by_accuracy_band' },
        configJson: { verdictOptions: ['PROCEED', 'PAUSE', 'ABORT'], minAccuracyForProceed: 70, maxRedFlagsForProceed: 0 },
        effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, notes: 'MVP playbook v1 for role switch'
    }]);

    await CaseIntentConfig.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await CaseIntentConfig.insertMany([
        { caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004', isDefault: true, displayOrder: 1, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
        { caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_INDUSTRY', playbookVersionId: 'PBV_000004', isDefault: false, displayOrder: 2, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false },
        { caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_VERTICAL', playbookVersionId: 'PBV_000004', isDefault: false, displayOrder: 3, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: false }
    ]);

    await Questions.deleteMany({ caseScope: 'CASE_ROLE_SWITCH' });
    await Questions.insertMany([
        {
            questionId: 'Q_RS_SKILL_OVERLAP_V1',
            questionText: 'How much skill overlap is there between your current role and the target role?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Low overlap (<20%) — requires major reskilling', score: 1 },
                { opt: 'Moderate overlap (20%-50%)', score: 2 },
                { opt: 'High overlap (50%-80%)', score: 3 },
                { opt: 'Very high overlap (>80%) — direct transition', score: 4 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.35, caseScope: 'CASE_ROLE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_RS_OVERLAP_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 40 },
                { optionScore: 3, normalizedScore: 75 },
                { optionScore: 4, normalizedScore: 95 }
            ]
        },
        {
            questionId: 'Q_RS_TARGET_MARKET_DEMAND_V1',
            questionText: 'What is the current hiring momentum for your target role in the market?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Low demand — market is saturated or shrinking', score: 1 },
                { opt: 'Moderate demand — standard hiring', score: 2 },
                { opt: 'High demand — talent shortage, active hiring', score: 3 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.30, caseScope: 'CASE_ROLE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_RS_DEMAND_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 15 },
                { optionScore: 2, normalizedScore: 55 },
                { optionScore: 3, normalizedScore: 90 }
            ]
        },
        {
            questionId: 'Q_RS_SALARY_IMPACT_V1',
            questionText: 'What is the expected salary impact of this role switch?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'Significant pay cut (>20%)', score: 1 },
                { opt: 'Moderate pay cut (10%-20%)', score: 2 },
                { opt: 'Neutral or slight increase', score: 3 },
                { opt: 'Significant increase (>20%)', score: 4 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.20, caseScope: 'CASE_ROLE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_RS_SALARY_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 40 },
                { optionScore: 3, normalizedScore: 75 },
                { optionScore: 4, normalizedScore: 95 }
            ]
        },
        {
            questionId: 'Q_RS_RESKILLING_TIME_V1',
            questionText: 'How many months are you willing/able to dedicate to full-time reskilling?',
            questionType: 'MCQ',
            optionsJson: [
                { opt: 'No time — need immediate transition', score: 1 },
                { opt: '1 to 3 months', score: 2 },
                { opt: '3 to 6 months', score: 3 },
                { opt: '6+ months', score: 4 }
            ],
            scoreMode: 'DIRECT', defaultWeight: 0.15, caseScope: 'CASE_ROLE_SWITCH', intentScope: 'ALL',
            isMandatory: true, isActive: true, scoringRuleId: 'SR_RS_RESKILL_V1', scoringType: 'MCQ_MAP',
            normalizationMin: 0, normalizationMax: 100, direction: 'HIGHER_IS_BETTER', curveType: 'STEP',
            scoringMapJson: [
                { optionScore: 1, normalizedScore: 10 },
                { optionScore: 2, normalizedScore: 45 },
                { optionScore: 3, normalizedScore: 75 },
                { optionScore: 4, normalizedScore: 95 }
            ]
        }
    ]);

    await MandatoryObjectiveInput.deleteMany({ moiId: 'MOI_ROLE_SWITCH_V1' });
    await MandatoryObjectiveInput.insertMany([{
        moiId: 'MOI_ROLE_SWITCH_V1', moiName: 'Role Switch — Mandatory Inputs',
        caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004',
        version: 'v1.0', description: 'Inputs required for role switch validation', isActive: true
    }]);

    await MoiQuestionMapping.deleteMany({ moiId: 'MOI_ROLE_SWITCH_V1' });
    await MoiQuestionMapping.insertMany([
        { moiqmId: 'MOIQM_RS_001', moiId: 'MOI_ROLE_SWITCH_V1', questionId: 'Q_RS_SKILL_OVERLAP_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 1, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_RS_002', moiId: 'MOI_ROLE_SWITCH_V1', questionId: 'Q_RS_TARGET_MARKET_DEMAND_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'HIGH', displayOrder: 2, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_RS_003', moiId: 'MOI_ROLE_SWITCH_V1', questionId: 'Q_RS_SALARY_IMPACT_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'MEDIUM', displayOrder: 3, dependencyRuleId: null, isActive: true },
        { moiqmId: 'MOIQM_RS_004', moiId: 'MOI_ROLE_SWITCH_V1', questionId: 'Q_RS_RESKILLING_TIME_V1', isMandatory: true, weightOverride: null, accuracyImpactFlag: 'MEDIUM', displayOrder: 4, dependencyRuleId: null, isActive: true },
    ]);

    await Constraints.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await Constraints.insertMany([
        { constraintId: 'CONS_RS_001', constraintSetId: 'CT_RS_V1', thresholdSetId: 'CT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', constraintName: 'Skill Overlap & Portability', constraintDescription: 'Measures how much of existing skills transfer to the target role.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 1, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true },
        { constraintId: 'CONS_RS_002', constraintSetId: 'CT_RS_V1', thresholdSetId: 'CT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', constraintName: 'Market Demand for Target Role', constraintDescription: 'Measures hiring momentum for the target role.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 2, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true },
        { constraintId: 'CONS_RS_003', constraintSetId: 'CT_RS_V1', thresholdSetId: 'CT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', constraintName: 'Economic Feasibility', constraintDescription: 'Measures the salary impact of making the switch.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 3, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true },
        { constraintId: 'CONS_RS_004', constraintSetId: 'CT_RS_V1', thresholdSetId: 'CT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', constraintName: 'Reskilling Capacity', constraintDescription: 'Measures the time availability for reskilling into the new role.', scoringModel: 'WEIGHTED_AVG', isBlockingConstraint: false, displayOrder: 4, strongMin: 80, strongMax: 100, strongColor: '#2E7D32', strongIsTerminal: false, strongPriority: 1, moderateMin: 60, moderateMax: 79, moderateColor: '#F57F17', moderateIsTerminal: false, moderatePriority: 2, fragileMin: 40, fragileMax: 59, fragileColor: '#E65100', fragileIsTerminal: false, fragilePriority: 3, criticalMin: 0, criticalMax: 39, criticalColor: '#C62828', criticalIsTerminal: true, criticalPriority: 4, isActive: true }
    ]);

    await ConstraintQuestionMapping.deleteMany({ constraintId: { $in: ['CONS_RS_001', 'CONS_RS_002', 'CONS_RS_003', 'CONS_RS_004'] } });
    await ConstraintQuestionMapping.insertMany([
        { cqmtId: 'CQMT_RS_001', constraintId: 'CONS_RS_001', questionId: 'Q_RS_SKILL_OVERLAP_V1', scoringRuleId: 'SR_RS_OVERLAP_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_RS_002', constraintId: 'CONS_RS_002', questionId: 'Q_RS_TARGET_MARKET_DEMAND_V1', scoringRuleId: 'SR_RS_DEMAND_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_RS_003', constraintId: 'CONS_RS_003', questionId: 'Q_RS_SALARY_IMPACT_V1', scoringRuleId: 'SR_RS_SALARY_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
        { cqmtId: 'CQMT_RS_004', constraintId: 'CONS_RS_004', questionId: 'Q_RS_RESKILLING_TIME_V1', scoringRuleId: 'SR_RS_RESKILL_V1', contributionWeight: 1.00, isRequiredForConstraint: true, normalizationMethod: 'NORMALIZED_100', isActive: true },
    ]);

    await Contradictions.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await Contradictions.insertMany([
        { contradictionId: 'CONTR_RS_001', contradictionSetId: 'CONTR_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', contradictionName: 'Low Overlap + No Reskill Time', contradictionDescription: 'Very low skill overlap but also no time provided for reskilling — failed transition risk.', contradictionType: 'INPUT_VS_INPUT', involvedEntitiesJson: { questionIds: ['Q_RS_SKILL_OVERLAP_V1', 'Q_RS_RESKILLING_TIME_V1'] }, defaultSeverityBand: 'CRITICAL', ruleName: 'Low Overlap No Reskill Rule', ruleJson: { operator: 'AND', conditions: [{ field: 'Q_RS_SKILL_OVERLAP_V1', operator: 'EQ', value: 1 }, { field: 'Q_RS_RESKILLING_TIME_V1', operator: 'EQ', value: 1 }] }, evaluationMode: 'STRICT', onMissingData: 'NOT_EVALUATED', severityBand: 'CRITICAL', accuracyPenaltyPoints: 20, confidencePenaltyPoints: 0, isBlocking: false, escalationTag: null, maxTriggerCount: 1, isActive: true }
    ]);

    await CoverageRequirements.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await CoverageRequirements.insertMany([
        { crtId: 'CRT_RS_001', coverageSetId: 'CRT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', anchorName: 'Financial Runway', requiredSourcesJson: { questionIds: ['Q_RS_SALARY_IMPACT_V1'] }, minimumEvidenceCount: 1, allowsPartial: false, missingPenaltyPoints: 10, partialPenaltyPoints: 5, reasoningBlockFlag: true, gapType: 'MISSING', stackingMode: 'CAP', stackingCapPoints: 10, escalationThreshold: null, escalationPenaltyPoints: null, displayOrder: 1, isActive: true },
        { crtId: 'CRT_RS_002', coverageSetId: 'CRT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', anchorName: 'Market Demand Signal', requiredSourcesJson: { externalSignalIds: ['EST_LM_001'] }, minimumEvidenceCount: 1, allowsPartial: true, missingPenaltyPoints: 10, partialPenaltyPoints: 5, reasoningBlockFlag: false, gapType: 'MISSING', stackingMode: 'CAP', stackingCapPoints: 10, escalationThreshold: null, escalationPenaltyPoints: null, displayOrder: 2, isActive: true }
    ]);

    await RedFlagTaxonomy.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await RedFlagTaxonomy.insertMany([
        { redFlagId: 'RF_RS_001', redFlagSetId: 'RFT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', redFlagName: 'Very Low Skill Portability', triggerSource: 'CONSTRAINT', triggerReferenceId: 'CONS_RS_001', severityBand: 'HIGH', penaltyPoints: 20, uniquenessMode: 'UNIQUE', remediationCode: 'REM_RESKILL', escalationRequired: false, displayOrder: 1, isActive: true },
        { redFlagId: 'RF_RS_002', redFlagSetId: 'RFT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', redFlagName: 'Target Market in Decline', triggerSource: 'CONSTRAINT', triggerReferenceId: 'CONS_RS_002', severityBand: 'CRITICAL', penaltyPoints: 25, uniquenessMode: 'UNIQUE', remediationCode: 'REM_MARKET_CHECK', escalationRequired: true, displayOrder: 2, isActive: true },
        { redFlagId: 'RF_RS_003', redFlagSetId: 'RFT_RS_V1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', redFlagName: 'Low Overlap + No Reskill Time', triggerSource: 'CONTRADICTION', triggerReferenceId: 'CONTR_RS_001', severityBand: 'CRITICAL', penaltyPoints: 0, uniquenessMode: 'UNIQUE', escalationRequired: true, displayOrder: 3, isActive: true }
    ]);

    await AccuracyScoringPolicy.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await AccuracyScoringPolicy.insertMany([{ accuracyPolicyId: 'ASP_RS_V1', policyName: 'Role Switch Accuracy Policy v1', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', baseScore: 100, aggregationMode: 'ADDITIVE', maxTotalPenalty: 75, floorScore: 25, escalationThresholdScore: 40, bandRulesJson: { HIGH: { min: 80, max: 100 }, MEDIUM: { min: 60, max: 79 }, LOW: { min: 40, max: 59 }, VERY_LOW: { min: 0, max: 39 } }, isActive: true }]);

    await Warnings.deleteMany({ redFlagId: { $in: ['RF_RS_001', 'RF_RS_002', 'RF_RS_003'] } });
    await Warnings.insertMany([
        { warningId: 'WARN_RS_LOW_OVERLAP', warningMappingId: 'WMT_RS_V1', redFlagId: 'RF_RS_001', triggerMode: 'ALWAYS', minSeverityBand: null, displayPriority: 1, warningTitle: 'Major Reskilling Required', warningMessage: 'Your current skills have very low overlap with the target role. This switch will require significant time (6-12 months) and effort to be successful.', severityBand: 'HIGH', advisoryType: 'ACTION_REQUIRED', ctaText: 'Enroll in a structured certification or degree program before switching.', humanValidationRecommended: false, displayType: 'REPORT_SECTION', expiresAfterDays: null, isActive: true },
        { warningId: 'WARN_RS_BAD_MARKET', warningMappingId: 'WMT_RS_V1', redFlagId: 'RF_RS_002', triggerMode: 'ALWAYS', minSeverityBand: null, displayPriority: 2, warningTitle: 'Target Market Is Weak', warningMessage: 'The hiring momentum for your target role is currently low or shrinking. Switching now may lead to prolonged unemployment or lower negotiation power.', severityBand: 'CRITICAL', advisoryType: 'ACTION_REQUIRED', ctaText: 'Re-evaluate the timing of this switch or choose a more resilient target role.', humanValidationRecommended: true, displayType: 'TOP_BANNER', expiresAfterDays: null, isActive: true }
    ]);

    await DecisionAssuranceSections.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await DecisionAssuranceSections.insertMany([
        { sectionId: 'RS_SEC_001', sectionName: 'Profile & Role Compatibility', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', sectionOrder: 1, sectionType: 'ANALYSIS', allowedAeuTypesJson: ['identity', 'work', 'composition', 'inferred'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true },
        { sectionId: 'RS_SEC_002', sectionName: 'Economic & Reskilling Assessment', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', sectionOrder: 2, sectionType: 'RISK_SYNTHESIS', allowedAeuTypesJson: ['inferred', 'work'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: ['Financial Runway'], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true },
        { sectionId: 'RS_SEC_003', sectionName: 'Market Demand for Target Role', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', sectionOrder: 3, sectionType: 'ANALYSIS', allowedAeuTypesJson: ['external'], certaintyCapPercent: 70, minAccuracyRequired: 0, fallbackPolicy: 'DEGRADE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: ['Market Demand Signal'], outputSchemaReference: null, isActive: true },
        { sectionId: 'RS_SEC_004', sectionName: 'Verdict', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', sectionOrder: 4, sectionType: 'VERDICT', allowedAeuTypesJson: ['identity', 'work', 'inferred', 'external'], certaintyCapPercent: 85, minAccuracyRequired: 0, fallbackPolicy: 'ESCALATE', requiredInternalAnchorsJson: [], requiredExternalAnchorsJson: [], outputSchemaReference: null, isActive: true }
    ]);

    await PromptConfigRegistry.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await PromptConfigRegistry.insertMany([
        { promptId: 'PCR_RS_SEC001_V1', sectionId: 'RS_SEC_001', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004', promptVersion: 1, modelFamily: 'OPENAI', temperature: 0.3, maxTokens: 600, systemPrompt: 'You are a career decision analyst for Hawksyn. Write only what evidence supports.', userPrompt: `Write a 4-sentence Role Compatibility Summary for this user.\n\nProfile:\n- Current Role: {{CURRENT_ROLE}}\n- Experience: {{EXPERIENCE_YEARS}} years\n- Skills: {{SKILLS}}\n\nUser Inputs:\n- Skill Overlap: {{RS_SKILL_OVERLAP}}\n- Target Market Demand: {{RS_TARGET_MARKET_DEMAND}}\n- Salary Impact: {{RS_SALARY_IMPACT}}\n- Reskilling Time: {{RS_RESKILLING_TIME}}\n\nIntegrity:\n- Accuracy Score: {{ACCURACY_SCORE}} (Band: {{ACCURACY_BAND}})\n- Red Flags: {{RED_FLAGS}}\n\nBe direct. Reference specific data. No generic advice.`, evidencePlaceholdersJson: { CURRENT_ROLE: 'AEU_IDENTITY_002' }, certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true },
        { promptId: 'PCR_RS_SEC002_V1', sectionId: 'RS_SEC_002', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004', promptVersion: 1, modelFamily: 'GEMINI', temperature: 0.3, maxTokens: 600, systemPrompt: 'You are an economic feasibility analyst for Hawksyn. Assess role switch economics.', userPrompt: `Assess economic and reskilling feasibility of this switch.\n\nSalary Impact: {{RS_SALARY_IMPACT}}\nReskilling Time: {{RS_RESKILLING_TIME}}\nSkill Overlap: {{RS_SKILL_OVERLAP}}\nAccuracy Band: {{ACCURACY_BAND}}\nRed Flags: {{RED_FLAGS}}\n\nWrite 2-3 paragraphs:\n1. Is the economic impact acceptable?\n2. Is the reskilling plan realistic given overlap?\n3. Recommended immediate action?`, evidencePlaceholdersJson: { RS_SALARY_IMPACT: 'Q_RS_SALARY_IMPACT_V1' }, certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true },
        { promptId: 'PCR_RS_SEC003_V1', sectionId: 'RS_SEC_003', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004', promptVersion: 1, modelFamily: 'GEMINI', temperature: 0.4, maxTokens: 500, systemPrompt: 'You are a market signals analyst for Hawksyn. Analyze target role market conditions.', userPrompt: `Analyze market for target role: {{CURRENT_ROLE}}\n\nTarget Demand: {{RS_TARGET_MARKET_DEMAND}}\nAI Risk: {{AI_DISPLACEMENT_RISK}}\nHiring Trend: {{INDUSTRY_HIRING_TREND}}\nAccuracy Band: {{ACCURACY_BAND}}\n\nWrite 3-4 sentences. End with direct implication.`, evidencePlaceholdersJson: { CURRENT_ROLE: 'parsedCvData.current_role' }, certaintyCapPercent: 70, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true },
        { promptId: 'PCR_RS_SEC004_V1', sectionId: 'RS_SEC_004', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004', promptVersion: 1, modelFamily: 'OPENAI', temperature: 0.2, maxTokens: 400, systemPrompt: 'You are the verdict engine for Hawksyn role switch decisions. PROCEED, PAUSE, or ABORT only.', userPrompt: `Verdict on role switch:\n\nAccuracy Score: {{ACCURACY_SCORE}}\nAccuracy Band: {{ACCURACY_BAND}}\nRed Flags: {{RED_FLAGS}}\nContradictions: {{CONTRADICTIONS}}\n\nFirst line: PROCEED, PAUSE, or ABORT\nThen 3-4 sentences with reasoning.\nEnd with one recommendation.`, evidencePlaceholdersJson: { ACCURACY_SCORE: 'AEU_INT_001' }, certaintyCapPercent: 85, retryPolicy: 'RETRY_ON_SCHEMA_FAIL', outputSchemaReference: null, isActive: true }
    ]);

    await EvaluationLibraryRegistry.deleteMany({ caseId: 'CASE_ROLE_SWITCH' });
    await EvaluationLibraryRegistry.insertMany([{ elrId: 'ELR_0004', elrName: 'Role Switch — Decision Library', caseId: 'CASE_ROLE_SWITCH', intentId: 'INT_SWITCH_ROLE_SAFE', playbookVersionId: 'PBV_000004', documentPolicyId: 'DOCPOLICY_V1_STD', constraintSetId: 'CT_RS_V1', contradictionSetId: 'CONTR_RS_V1', coverageSetId: 'CRT_RS_V1', redFlagSetId: 'RFT_RS_V1', accuracyPolicyId: 'ASP_RS_V1', warningMappingId: 'WMT_RS_V1', version: 'v1.0', isActive: true }]);

    console.log('✅ CASE_ROLE_SWITCH seeded');
}

// ════════════════════════════════════════════════════════════
// RUN
// ════════════════════════════════════════════════════════════
async function runSeed() {
    try {
        console.log('\n🌱 Hawksyn Master Seed Starting...\n');
        await mongoose.connect(process.env.DB_URI);
        console.log('✅ MongoDB connected\n');

        const steps = [
            { name: 'case_registry', fn: seedCaseRegistry },
            { name: 'intent_taxonomy', fn: seedIntentTaxonomy },
            { name: 'document_file_rules', fn: seedDocumentFileRules },
            { name: 'playbooks', fn: seedPlaybooks },
            { name: 'case_intent_config', fn: seedCaseIntentConfig },
            { name: 'questions', fn: seedQuestions },
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
            { name: 'dependency_rules', fn: seedDependencyRules },
            { name: 'external_signal_taxonomy', fn: seedExternalSignalTaxonomy },
            { name: 'source_registry', fn: seedSourceRegistry },
            { name: 'data_pattern_key_taxonomy', fn: seedDataPatternKeyTaxonomy },
            { name: 'risk_auditor_registry', fn: seedRiskAuditorRegistry },
            { name: 'mandatory_objective_inputs', fn: seedMandatoryObjectiveInputs },
            { name: 'moi_question_mapping', fn: seedMoiQuestionMapping },
            { name: 'command_center', fn: seedCommandCenter },
            { name: 'case_mba', fn: seedCase_MBA },
            { name: 'case_freelance', fn: seedCase_Freelance },
            { name: 'case_role_switch', fn: seedCase_RoleSwitch },
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
        console.log('   Cases:   CASE_AI_JOB_RISK, CASE_MBA_BREAK, CASE_FREELANCE_SWITCH, CASE_ROLE_SWITCH');
        console.log('   Ready to test all recruitment and career flows.\n');

    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB disconnected\n');
    }
}

runSeed();