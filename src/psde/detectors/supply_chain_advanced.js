/**
 * Advanced Supply Chain & Logistics Detectors (Batch 31)
 */

function detectColdChainLogisticsLead(cv, stats) {
    const keywords = [
        'cold chain', 'temperature-controlled', 'refrigerated logistics',
        'perishable supply chain', 'pharma logistics', 'gdp compliance',
        'cool chain', 'thermal packaging'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in the complex management of temperature-controlled supply chains, crucial for pharmaceutical and food sectors.' : 'No significant cold chain signals detected.',
        anchors: []
    };
}

function detectLastMileOptimizationExpert(cv, stats) {
    const keywords = [
        'last mile', 'final-mile delivery', 'micro-fulfillment', 'delivery density',
        'route optimization', 'e-commerce delivery', 'hyperlocal logistics',
        'delivery throughput'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven expertise in optimizing the final leg of the delivery journey, focusing on speed, cost, and route efficiency.' : 'No significant last-mile signals found.',
        anchors: []
    };
}

function detectStrategicSourcingGlobal(cv, stats) {
    const keywords = [
        'strategic sourcing', 'global procurement', 'vendor diversification',
        'low-cost country sourcing', 'supplier risk management', 'category management',
        'high-value procurement', 'global supply base'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated mastery in global vendor diversification and high-stakes high-level procurement.' : 'Limited evidence of global high-level sourcing.',
        anchors: []
    };
}

function detectSupplyChainRiskArchitect(cv, stats) {
    const keywords = [
        'supply chain risk', 'resiliency planning', 'mitigation strategy',
        'port congestion mitigation', 'disruption management', 'supply chain visibility',
        'contingency planning supply chain'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in designing resilient supply chain frameworks and mitigating high-impact global disruptions.' : 'No significant supply chain risk architecture signals found.',
        anchors: []
    };
}

function detectCustomsBrokerageManager(cv, stats) {
    const keywords = [
        'customs brokerage', 'hts classification', 'import duty', 'customs compliance',
        'customs clearance', 'bonded warehouse', 'tariff management', 'trade documentation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in international customs compliance, HTS classification, and the management of import/export duties.' : 'Limited evidence of customs and brokerage management.',
        anchors: []
    };
}

module.exports = {
    detectColdChainLogisticsLead,
    detectLastMileOptimizationExpert,
    detectStrategicSourcingGlobal,
    detectSupplyChainRiskArchitect,
    detectCustomsBrokerageManager
};
