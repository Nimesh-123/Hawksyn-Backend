/**
 * ESG, Social Impact & Non-Profit Detectors (Batch 33)
 */

function detectESGReportingLead(cv, stats) {
    const keywords = [
        'esg reporting', 'sustainability report', 'gri standards', 'sasb',
        'carbon footprinting', 'ghg protocol', 'esg disclosure', 'tcfd'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Specializes in the complex frameworks of ESG reporting, including GRI, SASB, and carbon accounting.' : 'No significant ESG reporting signals detected.',
        anchors: []
    };
}

function detectImpactInvestmentAnalyst(cv, stats) {
    const keywords = [
        'impact investment', 'social roi', 'environmental roi', 'impact measurement',
        'sustainable finance', 'blended finance', 'impact analysis'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Proven ability to analyze and measure the social and environmental return on investment in sustainable finance.' : 'No significant impact investment signals found.',
        anchors: []
    };
}

function detectCorporatePhilanthropyDirector(cv, stats) {
    const keywords = [
        'corporate philanthropy', 'charitable foundation', 'community engagement',
        'csr leadership', 'social responsibility director', 'giving strategy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Experienced in leading corporate foundations and designing strategic community engagement and giving programs.' : 'Limited evidence of corporate philanthropy leadership.',
        anchors: []
    };
}

function detectGrantManagementSpecialist(cv, stats) {
    const keywords = [
        'grant management', 'grant writing', 'non-profit funding', 'grant compliance',
        'foundation grants', 'federal grants', 'grant reporting'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Specializes in the end-to-end management of non-profit grants, from securing funding to ensuring strict compliance.' : 'No significant grant management signals found.',
        anchors: []
    };
}

function detectDEILead(cv, stats) {
    const keywords = [
        'dei lead', 'diversity equity inclusion', 'inclusive hiring', 'dei strategy',
        'cultural transformation dei', 'belonging specialist', 'diversity officer'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Proven track record of driving organizational culture transformation through DEI strategy and inclusive practices.' : 'Limited evidence of DEI leadership.',
        anchors: []
    };
}

module.exports = {
    detectESGReportingLead,
    detectImpactInvestmentAnalyst,
    detectCorporatePhilanthropyDirector,
    detectGrantManagementSpecialist,
    detectDEILead
};
