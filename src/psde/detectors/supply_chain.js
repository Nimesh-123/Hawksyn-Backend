/**
 * Supply Chain & Logistics Detectors
 */

function detectSupplyChainOrchestrator(cv, stats) {
    const keywords = [
        'supply chain management', 'end-to-end supply chain', 'scm strategy',
        's&op', 'sales and operations planning', 'supply chain optimization',
        'global supply chain', 'supply chain resilience'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven expertise in orchestrating complex, end-to-end global supply chains.' : 'No significant supply chain orchestrator signals detected.',
        anchors: []
    };
}

function detectLogisticsExpert(cv, stats) {
    const keywords = [
        'logistics', 'freight', 'transportation management', 'warehousing',
        'last mile', 'distribution center', 'fleet management',
        'third-party logistics', '3pl'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Extensive experience in managing logistics, transportation, and large-scale distribution networks.' : 'Limited evidence of logistics expertise.',
        anchors: []
    };
}

function detectProcurementPowerhouse(cv, stats) {
    const keywords = [
        'procurement', 'strategic sourcing', 'vendor management', 'cost savings',
        'supplier negotiation', 'category management', 'indirect spend',
        'contract negotiation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record in high-level sourcing, procurement, and leading significant cost savings.' : 'No significant procurement signals found.',
        anchors: []
    };
}

function detectInventoryOptimizer(cv, stats) {
    const keywords = [
        'inventory management', 'demand planning', 'stock optimization',
        'just-in-time', 'jit', 'inventory turnover', 'safety stock',
        'warehouse management systems', 'wms'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in optimizing inventory levels, demand forecasting, and inventory turnover.' : 'Limited evidence of inventory optimization leadership.',
        anchors: []
    };
}

function detectSustainabilitySupplyChain(cv, stats) {
    const keywords = [
        'sustainable supply chain', 'circular economy', 'green logistics',
        'ethical sourcing', 'scope 3 emissions', 'carbon footprint reduction',
        'responsible procurement', 'esg in supply chain'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven commitment to leading sustainability and ethical practices within the supply chain.' : 'No significant supply chain sustainability signals detected.',
        anchors: []
    };
}

module.exports = {
    detectSupplyChainOrchestrator,
    detectLogisticsExpert,
    detectProcurementPowerhouse,
    detectInventoryOptimizer,
    detectSustainabilitySupplyChain
};
