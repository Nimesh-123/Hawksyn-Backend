/**
 * Sheet to Model Configuration for Playbook Import/Export
 * Combo Format: Number_ShortName_(FullName)
 * Note: Excel sheet names are limited to 31 characters.
 */
const PLAYBOOK_MAPPING = {
    // 1. Registry & Policy
    '01_CR_(Case_Registry)': { model: 'CaseRegistry', idField: 'caseId' },
    '02_CIMT_(Case_Intent_Map)': { model: 'CaseIntentConfig', idField: 'cimtId' },
    '03_IT_(Intent_Master)': { model: 'IntentTaxonomy', idField: 'intentId' },
    '04_CP_(Case_Policy)': { model: 'Playbooks', idField: 'caseId' },

    // 2. Survey & Scoring
    '05_MCQM_(Questions)': { model: 'Questions', idField: 'questionId' },
    '06_QST_(Scoring)': { model: 'Questions', idField: 'questionId' },
    '07_DRR_(Dep_Rules)': { model: 'DependencyRules', idField: 'dependencyRuleId' },
    '08_CT_(Constraints)': { model: 'Constraints', idField: 'constraintId' },
    '09_CQMT_(Constraint_Map)': { model: 'ConstraintQuestionMapping', idField: 'cqmtId' },
    '10_CTT_(Thresholds)': { model: 'Constraints', idField: 'constraintId' },

    // 3. Logic & Intelligence
    '11_VLT_(Verdict_Logic)': { model: 'VerdictLogicTable', idField: 'ruleId' },
    '12_ASP_(Accuracy_Policy)': { model: 'AccuracyScoringPolicy', idField: 'accuracyPolicyId' },
    '13_RFT_(Red_Flags)': { model: 'RedFlagTaxonomy', idField: 'redFlagId' },
    '14_CDT_(Contradictions)': { model: 'Contradictions', idField: 'contradictionId' },
    '15_CCT_(Condition_Logic)': { model: 'Contradictions', idField: 'contradictionId' },
    '16_CST_(Penalty_Rules)': { model: 'Contradictions', idField: 'contradictionId' },
    '17_DRO_(Risk_Ontology)': { model: 'DroMaster', idField: 'droId' },
    '18_RCM_(Risk_Map)': { model: 'RiskConstraintMap', idField: 'rcmId' },

    // 4. Reporting & UI
    // '19_CONF_(Badges)': { model: 'VerdictLogicTable', idField: 'ruleId' }, // TODO: Lacks pivot logic, causes VLT validation failure
    // '20_IM_(Threshold_Mods)': { model: 'AccuracyScoringPolicy', idField: 'intentId' }, // TODO: Lacks pivot logic
    '21_DAST_(Report_Sections)': { model: 'DecisionAssuranceSections', idField: 'sectionId' },
    '22_PCR_(Prompt_Registry)': { model: 'PromptConfigRegistry', idField: 'promptId' },
    '23_OST_(Objective_Scoring)': { model: 'ObjectiveScoringTaxonomy', idField: 'schemaId' },
    '24_DPKT_(Placeholders)': { model: 'DataPatternKeyTaxonomy', idField: 'patternKeyId' },
    '25_EST_(External_Signals)': { model: 'ExternalSignalTaxonomy', idField: 'signalId' },
    // '26_REMED_(Remediation)': { model: 'RedFlagTaxonomy', idField: 'remediationCode' },
    
    'Questions_1': { model: 'MandatoryObjectiveInput', idField: 'moiId' },
    'Questions_2': { model: 'MoiQuestionMapping', idField: 'moiqmId' },
    'Questions_3': { model: 'DependencyRules', idField: 'dependencyRuleId' },
    'Constraints_1': { model: 'ConstraintQuestionMapping', idField: 'cqmtId' },
    'Constraints_2': { model: 'Constraints', idField: 'constraintId' },
    'Constraints_3': { model: 'DependencyRules', idField: 'dependencyRuleId' }
};

/**
 * Utility: Parse JSON strings or return the object if already parsed
 */
const parseSafeJson = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    if (typeof val !== 'string') return val;
    let cleaned = val.trim();
    if (cleaned.toUpperCase() === 'NULL') return null;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"');
    }
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        try { return JSON.parse(cleaned.replace(/'/g, '"')); } catch (e2) { return cleaned; }
    }
};

/**
 * Utility: Convert camelCase to snake_case for Excel Headers
 */
const toSnakeCase = (str) => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Utility: Convert snake_case to camelCase for DB Keys
 */
const toCamelCase = (str) => {
    return str.toLowerCase().replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
};

module.exports = {
    PLAYBOOK_MAPPING,
    parseSafeJson,
    toSnakeCase,
    toCamelCase
};
