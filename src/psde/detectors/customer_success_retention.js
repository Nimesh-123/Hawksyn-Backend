/**
 * Customer Success & Retention Detectors (Batch 28)
 */

function detectChurnMitigationLead(cv, stats) {
    const keywords = [
        'churn reduction', 'retention strategy', 'health score', 'churn mitigation',
        'customer health', 'proactive retention', 'churn risk', 'net revenue retention', 'nrr'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in modeling customer health and executing proactive strategies to mitigate churn and drive retention.' : 'No significant churn mitigation signals detected.',
        anchors: []
    };
}

function detectCSOperationsArchitect(cv, stats) {
    const keywords = [
        'cs ops', 'customer success operations', 'gainsight', 'totango', 'churnzero',
        'cs process automation', 'customer journey mapping', 'cs tech stack'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Specializes in the operational infrastructure of Customer Success, including tool orchestration and process automation.' : 'No significant CS operations signals found.',
        anchors: []
    };
}

function detectStrategicAccountDirector(cv, stats) {
    const keywords = [
        'strategic account management', 'enterprise customer success', 'high acv accounts',
        'key account director', 'account expansion', 'executive business reviews', 'ebr'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven track record of managing high-value enterprise accounts and driving strategic account expansion.' : 'Limited evidence of strategic account management.',
        anchors: []
    };
}

function detectRenewalsStrategist(cv, stats) {
    const keywords = [
        'renewals manager', 'renewals strategy', 'contract renewals', 'renewal negotiation',
        'gross revenue retention', 'grr', 'commercial renewal'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Specializes in the commercial and strategic management of customer contract renewals and negotiations.' : 'No significant renewals strategy signals found.',
        anchors: []
    };
}

function detectCSMLeaderScaled(cv, stats) {
    const keywords = [
        'head of customer success', 'vp of customer success', 'scaled customer success',
        'digital touch cs', 'tech-touch cs', 'cs leadership', 'customer success culture'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Experienced in leading large-scale or digital-first Customer Success organizations with a focus on organizational scaling.' : 'Limited evidence of scaled CS leadership.',
        anchors: []
    };
}

module.exports = {
    detectChurnMitigationLead,
    detectCSOperationsArchitect,
    detectStrategicAccountDirector,
    detectRenewalsStrategist,
    detectCSMLeaderScaled
};
