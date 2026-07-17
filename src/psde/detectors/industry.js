/**
 * Industry & Sector-Specific Detectors
 */

function detectSaaSExpert(extractedCV, precomputedStats) {
    const roles = extractedCV.roles || [];
    const anchors = [];

    const saasTerms = ['saas', 'software as a service', 'subscription model', 'mrr', 'arr', 'churn', 'plg', 'product-led growth', 'nrr'];

    for (const role of roles) {
        // Check 1: Terms in AEUs (bullets)
        for (const aeu of (role.base_aeus || [])) {
            const rawLower = (aeu.raw_text || '').toLowerCase();
            const found = saasTerms.filter(t => rawLower.includes(t));

            if (found.length > 0) {
                anchors.push({
                    anchor_id: `${aeu.aue_id || Math.random().toString(36).substr(2, 9)}_SAAS`,
                    anchor_type: 'SAAS_TERM_IN_BULLET',
                    anchor_value: found,
                    derivation_method: 'direct_extraction',
                    cv_location: { role_index: role.role_index },
                    verbatim_quote: aeu.raw_text,
                    anchor_confidence: 0.50
                });
            }
        }

        // Check 2: Industry metadata (if enriched)
        if (role.domain_metadata?.primary_industry === 'tech_saas') {
            anchors.push({
                anchor_id: `${role.role_index}_SAAS_DOMAIN`,
                anchor_type: 'SAAS_DOMAIN_MATCH',
                anchor_value: 'tech_saas',
                derivation_method: 'aggregation',
                cv_location: { role_index: role.role_index },
                verbatim_quote: null,
                anchor_confidence: 0.9
            });
        }
    }

    const isDetected = anchors.length >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? Math.min(0.9, 0.5 + 0.1 * anchors.length) : 0,
        reasoning: isDetected 
            ? `Detected ${anchors.length} SaaS-specific signals across professional history.` 
            : 'No significant SaaS-specific AEU signals detected.',
        anchors
    };
}

function detectFinTechSpecialist(cv, stats) {
    const keywords = ['fintech', 'payment gateway', 'nbfc', 'digital lending', 'wallets', 'neo-bank', 'p2p lending'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    const isDetected = matches.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in the Financial Technology (FinTech) environments.' : 'No significant FinTech signals found.',
        anchors: isDetected ? [{ type: 'FINTECH_KEYWORDS', value: matches }] : []
    };
}

function detectBFSIVeteran(cv, stats) {
    const keywords = ['banking', 'wealth management', 'insurance', 'capital markets', 'asset management', 'nbaf', 'rbi', 'sebi'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    const isDetected = matches.length >= 3;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Extensive experience in traditional Banking, Financial Services, and Insurance (BFSI).' : 'Limited history in core BFSI sectors.',
        anchors: isDetected ? [{ type: 'BFSI_KEYWORDS', value: matches }] : []
    };
}

function detectEcommerceSpecialist(cv, stats) {
    const keywords = ['e-commerce', 'marketplace', 'd2c', 'logistics', 'last-mile', 'inventory management', 'gmv', 'basket size'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    const isDetected = matches.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record in managing E-commerce or Marketplace operations.' : 'No significant E-commerce signals detected.',
        anchors: isDetected ? [{ type: 'ECOMMERCE_KEYWORDS', value: matches }] : []
    };
}

function detectManufacturingLead(cv, stats) {
    const keywords = ['manufacturing', 'factory', 'supply chain', 'lean six sigma', 'oee', 'production line', 'shop floor'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    const isDetected = matches.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Deep experience in manufacturing environments and production management.' : 'Limited manufacturing background detected.',
        anchors: isDetected ? [{ type: 'MANUFACTURING_KEYWORDS', value: matches }] : []
    };
}

function detectHealthcareDomainExpert(cv, stats) {
    const keywords = ['healthcare', 'pharma', 'clinical', 'hospital', 'medical device', 'fda', 'patient care', 'telemedicine'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    const isDetected = matches.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Found significant history within the Healthcare or Pharmaceutical domain.' : 'No significant healthcare signals found.',
        anchors: isDetected ? [{ type: 'HEALTHCARE_KEYWORDS', value: matches }] : []
    };
}

function detectConsumerGoodsExpert(cv, stats) {
    const keywords = ['fmcg', 'consumer goods', 'retail', 'cpg', 'distribution network', 'channel sales', 'sku'];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    const isDetected = matches.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experience in FMCG or Consumer Packaged Goods (CPG) sectors.' : 'No significant FMCG background found.',
        anchors: isDetected ? [{ type: 'CONSUMER_KEYWORDS', value: matches }] : []
    };
}

module.exports = {
    detectSaaSExpert,
    detectFinTechSpecialist,
    detectBFSIVeteran,
    detectEcommerceSpecialist,
    detectManufacturingLead,
    detectHealthcareDomainExpert,
    detectConsumerGoodsExpert
};
