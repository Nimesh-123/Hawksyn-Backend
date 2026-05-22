/**
 * High-Stakes Operations Detectors (Batch 35 & 36)
 */

function detectDisasterRecoveryArchitect(cv, stats) {
    const keywords = [
        'disaster recovery', 'business continuity planning', 'bcp', 'failover strategy',
        'high availability architect', 'dr site', 'recovery time objective', 'rto', 'rpo'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Specializes in the design and execution of high-availability architectures and complex disaster recovery frameworks.' : 'No significant DR architecture signals detected.',
        anchors: []
    };
}

function detectCrisisCommunicationsLead(cv, stats) {
    const keywords = [
        'crisis communications', 'reputation management', 'crisis pr', 'issue management',
        'high-stakes pr', 'media relations crisis', 'brand protection'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Proven ability to manage high-stakes public relations and protect brand reputation during organizational crises.' : 'No significant crisis communications signals found.',
        anchors: []
    };
}

function detectPhysicalSecurityDirector(cv, stats) {
    const keywords = [
        'physical security', 'facility security', 'asset protection', 'security operations',
        'surveillance systems', 'access control mgmt', 'corporate security'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Experienced in the management of large-scale physical security operations and the protection of corporate assets.' : 'Limited evidence of physical security leadership.',
        anchors: []
    };
}

function detectOHSLead(cv, stats) {
    const keywords = [
        'ohs lead', 'occupational health', 'workplace safety', 'osha',
        'hse', 'safety compliance', 'industrial hygiene', 'safety officer'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Specializes in workplace safety, health standards, and organizational compliance with OHS/OSHA regulations.' : 'No significant OHS signals found.',
        anchors: []
    };
}

function detectFraudPreventionSpecialist(cv, stats) {
    const keywords = [
        'fraud prevention', 'anti-money laundering', 'aml', 'kyc', 'transaction monitoring',
        'fraud detection', 'financial crime', 'anti-fraud strategy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Proven track record of designing and executing anti-fraud and anti-money laundering (AML) strategies.' : 'Limited evidence of fraud prevention specialization.',
        anchors: []
    };
}

function detectCorporateIntelligenceAnalyst(cv, stats) {
    const keywords = [
        'corporate intelligence', 'competitor analysis', 'market signals', 'market intelligence',
        'strategic intelligence', 'competitive landscape analyst'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Specializes in the gathering and analysis of corporate intelligence and market signals to drive strategic advantage.' : 'No significant corporate intelligence signals found.',
        anchors: []
    };
}

function detectProcurementEthicsAuditor(cv, stats) {
    const keywords = [
        'procurement ethics', 'anti-bribery', 'supplier code of conduct', 'ethical sourcing',
        'supplier audit', 'corruption prevention', 'procurement compliance'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Expertise in ensuring ethical procurement practices and auditing supplier compliance with anti-corruption standards.' : 'No significant procurement ethics signals found.',
        anchors: []
    };
}

function detectGlobalMobilityTaxLead(cv, stats) {
    const keywords = [
        'global mobility tax', 'expat tax', 'cross-border payroll', 'tax equalization',
        'shadow payroll', 'assignment management', 'international tax mobility'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Specializes in the complex tax and payroll implications of international employee mobility and expat assignments.' : 'No significant global mobility tax signals found.',
        anchors: []
    };
}

function detectTreasuryRiskManager(cv, stats) {
    const keywords = [
        'treasury risk', 'hedging strategy', 'liquidity risk', 'foreign exchange risk',
        'fx hedging', 'cash flow forecasting', 'interest rate risk'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Expertise in managing treasury risks, specifically regarding liquidity, hedging, and foreign exchange exposure.' : 'No significant treasury risk signals detected.',
        anchors: []
    };
}

function detectInsuranceClaimsDirector(cv, stats) {
    const keywords = [
        'insurance director', 'claims management', 'risk transfer', 'liability management',
        'corporate insurance', 'captive insurance', 'loss prevention'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven track record of managing large-scale corporate insurance programs and liability risk transfer.' : 'Limited evidence of insurance/claims leadership.',
        anchors: []
    };
}

// Batch 36
function detectInterimManagementSpecialist(cv, stats) {
    const keywords = [
        'interim management', 'interim cfo', 'interim cto', 'fractional leadership',
        'short-term leadership', 'interim role', 'turnaround management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Specializes in high-impact interim leadership roles, providing stability and direction during organizational transitions.' : 'No significant interim management signals found.',
        anchors: []
    };
}

function detectFounderAssociate(cv, stats) {
    const keywords = [
        'founder associate', 'right-hand to founder', 'strategic generalist',
        'chief of staff associate', 'ceo office', 'strategic assistant to founder'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Possesses the unique blend of strategic vision and generalist execution required for a Founder Associate role.' : 'No significant Founder Associate signals found.',
        anchors: []
    };
}

module.exports = {
    detectDisasterRecoveryArchitect,
    detectCrisisCommunicationsLead,
    detectPhysicalSecurityDirector,
    detectOHSLead,
    detectFraudPreventionSpecialist,
    detectCorporateIntelligenceAnalyst,
    detectProcurementEthicsAuditor,
    detectGlobalMobilityTaxLead,
    detectTreasuryRiskManager,
    detectInsuranceClaimsDirector,
    detectInterimManagementSpecialist,
    detectFounderAssociate
};
