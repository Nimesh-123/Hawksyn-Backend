/**
 * Sales & Revenue Operations Detectors (Batch 27)
 */

function detectRevOpsStrategist(cv, stats) {
    const keywords = [
        'revops', 'revenue operations', 'sales operations', 'marketing operations',
        'funnel optimization', 'revenue leakage', 'cross-functional alignment',
        'sales marketing alignment', 'revenue cycle'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in aligning sales, marketing, and customer success operations to lead revenue predictability.' : 'No significant RevOps strategy signals detected.',
        anchors: []
    };
}

function detectGTMEnablementLead(cv, stats) {
    const keywords = [
        'sales enablement', 'gtm enablement', 'sales training', 'sales playbooks',
        'onboarding sales', 'sales methodology', 'meddic', 'bant', 'challenger sale',
        'enablement strategy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to lead sales productivity through training, methodology adoption, and go-to-market playbooks.' : 'No significant GTM enablement signals found.',
        anchors: []
    };
}

function detectPricingPackagingModeler(cv, stats) {
    const keywords = [
        'pricing strategy', 'packaging strategy', 'sku management', 'discount structure',
        'price modeling', 'monetization strategy', 'contract value optimization',
        'value-based pricing'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in the high-level design of pricing, packaging, and monetization models to maximize customer lifetime value.' : 'No significant pricing/packaging modeling signals detected.',
        anchors: []
    };
}

function detectSalesTechStackArchitect(cv, stats) {
    const keywords = [
        'salesforce administrator', 'hubspot architect', 'crm architect', 'cpq',
        'outreach.io', 'salesloft', 'gong.io', 'zoominfo', 'lead enrichment',
        'crm migration', 'sales tech stack'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    const hasCRM = text.includes('salesforce') || text.includes('hubspot') || text.includes('crm');
    const hasTools = text.includes('cpq') || text.includes('outreach') || text.includes('salesloft') || text.includes('gong');
    const isDetected = hasCRM && hasTools;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in architecting and managing complex sales technology stacks, including CRM, CPQ, and sales engagement tools.' : 'Limited evidence of sales tech stack architecture.',
        anchors: []
    };
}

function detectTerritoryQuotaPlanner(cv, stats) {
    const keywords = [
        'territory planning', 'quota setting', 'sales capacity planning',
        'sales commission', 'variable compensation', 'sales forecasting',
        'headcount planning sales'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in data-driven sales capacity planning, territory allocation, and quota management.' : 'No significant territory/quota planning signals found.',
        anchors: []
    };
}

module.exports = {
    detectRevOpsStrategist,
    detectGTMEnablementLead,
    detectPricingPackagingModeler,
    detectSalesTechStackArchitect,
    detectTerritoryQuotaPlanner
};
