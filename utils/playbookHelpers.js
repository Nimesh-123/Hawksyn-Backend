/**
 * Sheet to Model Configuration for Playbook Import
 */
const PLAYBOOK_MAPPING = {
    // Core Playbook
    '01 CR': { model: 'CaseRegistry', idField: 'caseId' },
    '04 CIPR': { model: 'CaseIntentConfig', idField: 'playbookVersionId' }, // Merged into CaseIntentConfig with CIMT
    '05 PR': { model: 'Playbooks', idField: 'playbookId' },
    '06 PV': { model: 'Playbooks', idField: 'playbookVersionId' }, // Merged into Playbooks
    '07 CP': { model: 'Playbooks', idField: 'intentId' }, // Merged into Playbooks

    // Taxonomy
    '02 CIMT': { model: 'CaseIntentConfig', idField: 'intentId' },
    '03 IT': { model: 'IntentTaxonomy', idField: 'intentId' },

    // Questions (MCQM + QST merged)
    '08 MCQM': { model: 'Questions', idField: 'questionId' },
    '18 QST': { model: 'Questions', idField: 'scoringRuleId' }, // merged

    // MOI
    '12 MOI': { model: 'MandatoryObjectiveInput', idField: 'moiId' },
    'MOI Master': { model: 'MandatoryObjectiveInput', idField: 'moiId' },
    '13 MOIQM': { model: 'MoiQuestionMapping', idField: 'moiqmId' },

    // Constraints (CT + CTT merged)
    '16 CT': { model: 'Constraints', idField: 'constraintId' },
    '19 CTT': { model: 'Constraints', idField: 'thresholdSetId' }, // merged

    // Mapping (IMPORTANT - separate)
    '17 CQMT': { model: 'ConstraintQuestionMapping', idField: 'cqmtId' },

    // Risk Layer
    '25A DRO': { model: 'DroMaster', idField: 'droId' },
    'DRO Master': { model: 'DroMaster', idField: 'droId' },
    '12 DRO': { model: 'DroMaster', idField: 'droId' },

    '25B RCM': { model: 'RiskConstraintMap', idField: 'rcmId' },
    '13 RCM': { model: 'RiskConstraintMap', idField: 'rcmId' },
    'RCM': { model: 'RiskConstraintMap', idField: 'rcmId' },

    // Integrity
    '24A IER': { model: 'IntegrityEligibilityRules', idField: 'ierId' },
    '41 IER': { model: 'IntegrityEligibilityRules', idField: 'ierId' },
    '41  Integrity Eligibility Rules': { model: 'IntegrityEligibilityRules', idField: 'ierId' },

    // Verdict
    '37 VLT': { model: 'VerdictLogicTable', idField: 'ruleId' },
    'VLT': { model: 'VerdictLogicTable', idField: 'ruleId' },

    // Logic
    '14 DRR': { model: 'DependencyRules', idField: 'dependencyRuleId' },
    '25 RFT': { model: 'RedFlagTaxonomy', idField: 'redFlagId' },

    '20 CDT': { model: 'Contradictions', idField: 'contradictionId' },
    '21 CCT': { model: 'Contradictions', idField: 'contradictionId' },
    '22 CST': { model: 'Contradictions', idField: 'contradictionId' },

    // Accuracy
    '23 CRT': { model: 'CoverageRequirements', idField: 'crtId' },
    '24 CAT': { model: 'CoverageRequirements', idField: 'crtId' },
    '26 ASP': { model: 'AccuracyScoringPolicy', idField: 'accuracyPolicyId' },

    // Output
    '33 DAST': { model: 'DecisionAssuranceSections', idField: 'sectionId' },
    '30 GR': { model: 'GuardrailRegistry', idField: 'grRuleId' },
    '34 PCR': { model: 'PromptConfigRegistry', idField: 'promptId' },

    // External
    '29 EST': { model: 'ExternalSignalTaxonomy', idField: 'signalId' },
    '31 SR': { model: 'SourceRegistry', idField: 'sourceId' },
    '32 DPKT': { model: 'DataPatternKeyTaxonomy', idField: 'patternKeyId' },

    // Warnings
    '27 WMT': { model: 'Warnings', idField: 'warningId' },
    '28 WC': { model: 'Warnings', idField: 'warningId' },

    // Eval
    '15 ELR': { model: 'EvaluationLibraryRegistry', idField: 'elrId' },

    // Fallback (IMPORTANT for Antigravity)
    'CQMT': { model: 'ConstraintQuestionMapping', idField: 'cqmtId' },
    'QST': { model: 'Questions', idField: 'scoringRuleId' }
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

module.exports = {
    PLAYBOOK_MAPPING,
    parseSafeJson
};
