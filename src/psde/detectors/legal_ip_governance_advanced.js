/**
 * Advanced Legal, IP & Governance Detectors (Batch 30)
 */

function detectExportControlSpecialist(cv, stats) {
    const keywords = [
        'export control', 'itar', 'ear compliance', 'sanctions compliance',
        'ofac', 'dual-use technology', 'export licensing', 'trade compliance'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in international trade compliance, specifically regarding ITAR, EAR, and global export controls.' : 'No significant export control signals detected.',
        anchors: []
    };
}

function detectLegalTechImplementationLead(cv, stats) {
    const keywords = [
        'legal tech', 'clm implementation', 'contract lifecycle management',
        'legal ai', 'e-discovery tools', 'matter management', 'legal operations automation',
        'ironclad', 'iubenda', 'conga'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Specializes in the selection and implementation of legal technology stacks, including CLM and automated matter management.' : 'No significant legal tech implementation signals found.',
        anchors: []
    };
}

function detectRegulatoryAffairsDirector(cv, stats) {
    const keywords = [
        'regulatory affairs', 'statutory approvals', 'clinical regulatory',
        'financial regulatory', 'energy regulatory', 'compliance strategy',
        'government liaison', 'regulatory filings'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven ability to manage high-stakes regulatory approvals and navigate complex statutory environments.' : 'Limited evidence of regulatory affairs leadership.',
        anchors: []
    };
}

function detectIPMonetizationStrategist(cv, stats) {
    const keywords = [
        'ip monetization', 'licensing income', 'royalty audit', 'ip sales',
        'patent licensing', 'technology transfer', 'monetizing ip', 'royalty management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Specializes in the commercialization of intellectual property, including licensing strategy and royalty optimization.' : 'No significant IP monetization signals found.',
        anchors: []
    };
}

function detectCorporateSecretary(cv, stats) {
    const keywords = [
        'corporate secretary', 'board governance', 'shareholder relations',
        'statutory filings', 'board meeting management', 'minutes of meetings',
        'governance compliance'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Expertise in managing board-level governance, statutory filings, and high-level shareholder communications.' : 'Limited evidence of corporate secretarial experience.',
        anchors: []
    };
}

module.exports = {
    detectExportControlSpecialist,
    detectLegalTechImplementationLead,
    detectRegulatoryAffairsDirector,
    detectIPMonetizationStrategist,
    detectCorporateSecretary
};
