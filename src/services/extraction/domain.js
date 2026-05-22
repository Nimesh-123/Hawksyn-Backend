/**
 * Expanded Domain Intelligence Service
 * Taxonomy for Consulting, Banking, and Telecom
 */

const DOMAIN_DICTIONARY = {
    consulting: ['m&a', 'synergy', 'integration', 'operating model', 'transformation', 'strategic planning', 'market entry', 'due diligence', 'benchmarking', 'conglomerate'],
    banking: ['npa', 'nbfc', 'trade finance', 'retail banking', 'fintech', 'digitisation', 'cbs', 'wealth management', 'aml', 'kyc', 'investment banking'],
    telecom: ['bts', 'rf planning', '4g', '5g', 'lte', 'network operations', 'sla', 'uptime', 'fibre', 'tower', 'backhaul'],
    tech: ['saas', 'cloud', 'architecture', 'scalability', 'agile', 'devops', 'product management'],
    prestige: ['fortune-500', 'top-tier', 'blue-chip', 'iit', 'iim', 'ivy league']
};

function enrichWithDomainData(roleData) {
    const foundTerms = [];
    const text = JSON.stringify(roleData).toLowerCase();
    const scores = {};

    Object.entries(DOMAIN_DICTIONARY).forEach(([domain, terms]) => {
        scores[domain] = 0;
        terms.forEach(term => {
            if (text.includes(term)) {
                foundTerms.push(term);
                scores[domain]++;
            }
        });
    });

    const primaryDomain = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);

    return {
        domain_terms_found: [...new Set(foundTerms)],
        domain_depth_score: foundTerms.length,
        primary_industry: scores[primaryDomain] > 0 ? primaryDomain : 'General',
        industry_confidence: scores[primaryDomain] > 2 ? 'high' : (scores[primaryDomain] > 0 ? 'medium' : 'low')
    };
}

module.exports = enrichWithDomainData;
