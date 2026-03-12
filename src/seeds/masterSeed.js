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
            isActive: false
        },
        {
            intentId: 'INT_UPSKILL_AI_PROOF',
            intentName: 'Upskill to AI-proof myself in next 3 months',
            intentDescription: 'Upskill strategy to AI-proof current skillset in 3 months.',
            intentHorizonDays: 90,
            intentType: 'UPSKILL',
            primaryOutcome: 'SKILL_GAP_PLAN',
            defaultVerdictMode: 'PROCEED_PAUSE_ABORT',
            isActive: false
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
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            isDefault: true,
            displayOrder: 1,
            minAgeYears: null,
            maxAgeYears: null,
            minExperienceYears: null,
            maxExperienceYears: null,
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
            minAgeYears: null,
            maxAgeYears: null,
            minExperienceYears: null,
            maxExperienceYears: null,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            isActive: false,
            notes: 'Switch role intent — Phase 2'
        },
        {
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_UPSKILL_AI_PROOF',
            playbookVersionId: 'PBV_000003',
            isDefault: false,
            displayOrder: 3,
            minAgeYears: null,
            maxAgeYears: null,
            minExperienceYears: null,
            maxExperienceYears: null,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            isActive: false,
            notes: 'Upskill intent — Phase 3'
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
                { minVal: 0,  maxVal: 3,  normalizedScore: 5  },   // CRITICAL — less than 3 months
                { minVal: 4,  maxVal: 6,  normalizedScore: 25 },   // FRAGILE  — 4 to 6 months
                { minVal: 7,  maxVal: 12, normalizedScore: 55 },   // MODERATE — 7 to 12 months
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
            moiId: 'MOI_AI_SWITCH_V1',
            moiName: 'AI Job Risk – Switch – Mandatory Inputs',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_SWITCH_ROLE_SAFE',          // ✅ FIXED: was INT_SWITCH_ROLE_6M
            playbookVersionId: 'PBV_000002',
            version: 'v1.0',
            description: 'Mandatory inputs for transition evaluation',
            isActive: true
        },
        {
            moiId: 'MOI_AI_UPSKILL_V1',
            moiName: 'AI Job Risk – Upskill – Mandatory Inputs',
            caseId: 'CASE_AI_JOB_RISK',
            intentId: 'INT_UPSKILL_AI_PROOF',          // ✅ FIXED: was INT_UPSKILL_90D
            playbookVersionId: 'PBV_000003',
            version: 'v1.0',
            description: 'Mandatory inputs for skill improvement plan',
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
        },
        {
            moiId: 'MOI_AUDIT_V1',
            moiName: 'Annual Career Audit – Mandatory Inputs',
            caseId: 'CASE_ANNUAL_CAREER_AUDIT',
            intentId: 'INT_FULL_YEAR_AUDIT',
            playbookVersionId: 'PBV_000005',
            version: 'v1.0',
            description: 'Inputs required for full career audit',
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
            escalationThreshold: null,                  // ✅ ADDED
            escalationPenaltyPoints: null,              // ✅ ADDED
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
            escalationThreshold: null,                  // ✅ ADDED
            escalationPenaltyPoints: null,              // ✅ ADDED
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
            outputSchemaReference: null,
            isActive: true
        },
        {
            promptId:          'PCR_SEC002_V1',
            sectionId:         'SEC_002',
            caseId:            'CASE_AI_JOB_RISK',
            intentId:          'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            promptVersion:     1,
            modelFamily:       'GEMINI',
            temperature:       0.3,
            maxTokens:         600,
            systemPrompt:      'You are a financial resilience analyst for Hawksyn. Assess the user\'s financial runway against career risk. Be factual and concise. Do not invent numbers not present in the evidence.',
            userPrompt:        'Assess the financial resilience of this user.\nFinancial Runway: {{FINANCIAL_RUNWAY}} months.\nAccuracy Band: {{ACCURACY_BAND}}.\nRed Flags: {{RED_FLAGS}}.\n\nWrite 2-3 paragraphs covering:\n1. Is the current financial cushion adequate given AI risk?\n2. What happens if role is disrupted?\n3. What is the recommended immediate action?',
            evidencePlaceholdersJson: {
                FINANCIAL_RUNWAY: 'Q_FINANCIAL_RUNWAY_V1',
                ACCURACY_BAND:    'integrityPack.accuracy.band',
                RED_FLAGS:        'integrityPack.redFlags.triggered'
            },
            certaintyCapPercent: 85,
            retryPolicy:         'RETRY_ON_SCHEMA_FAIL',
            outputSchemaReference: null,
            isActive: true
        },
        {
            promptId:          'PCR_SEC003_V1',
            sectionId:         'SEC_003',
            caseId:            'CASE_AI_JOB_RISK',
            intentId:          'INT_STAY_12M_SAFE',
            playbookVersionId: 'PBV_000001',
            promptVersion:     1,
            modelFamily:       'GEMINI',
            temperature:       0.4,
            maxTokens:         500,
            systemPrompt:      'You are a market signals analyst for Hawksyn. Summarize external market conditions relevant to the user\'s role and domain. Only use the provided inputs. Do not fabricate statistics or cite external sources.',
            userPrompt:        'Summarize market demand signals for this user.\nRole: {{CURRENT_ROLE}}.\nDomain: {{DOMAIN}}.\nCompany AI stance: {{COMPANY_AI_POLICY}}.\nAccuracy Band: {{ACCURACY_BAND}}.\n\nNote: External signal data may be limited. Acknowledge any data gaps explicitly.',
            evidencePlaceholdersJson: {
                CURRENT_ROLE:      'parsedCvData.current_role',
                DOMAIN:            'parsedCvData.domain',
                COMPANY_AI_POLICY: 'Q_COMPANY_AI_POLICY_V1',
                ACCURACY_BAND:     'integrityPack.accuracy.band'
            },
            certaintyCapPercent: 70,
            retryPolicy:         'RETRY_ON_SCHEMA_FAIL',
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
            auditorName: 'Senior Risk Analyst', 
            caseId: 'CASE_AI_JOB_RISK', 
            specializations: ['AI_DISPLACEMENT', 'FINANCIAL_RISK', 'REM_SKILL_UPSKILL'], 
            maxCaseload: 20, 
            currentCaseload: 5, 
            isActive: true 
        },
        { 
            auditorId: 'RAR_002', 
            auditorName: 'Neha Kapoor', 
            caseId: 'CASE_AI_JOB_RISK', 
            specializations: ['LABOUR_MARKET', 'POLICY'], 
            maxCaseload: 20, 
            currentCaseload: 2, 
            isActive: true 
        },
        { 
            auditorId: 'RAR_003', 
            auditorName: 'Raghav Sharma', 
            caseId: 'CASE_AI_JOB_RISK', 
            specializations: ['FINANCIAL_RISK', 'RUNWAY_ANALYSIS'], 
            maxCaseload: 20, 
            currentCaseload: 8, 
            isActive: true 
        }
    ]);
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