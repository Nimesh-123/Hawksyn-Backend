/**
 * Domain-Aware Ontology Service
 * Prevents cross-domain contamination and validates term relevance
 */

const DOMAIN_WHITELIST = {
    'banking': ['banking_term', 'tier1_employer_banking', 'regulatory_body'],
    'pharma': ['pharma_term', 'tier1_employer_pharma', 'regulatory_body'],
    'consulting': ['tier1_employer_consulting', 'domain_term_consulting'], // some terms might be tagged differently
    'tech': ['tier1_employer_it', 'domain_term_tech']
};

function detectCVDomain(roles, topSkills = []) {
    const scores = { banking: 0, pharma: 0, tech: 0, consulting: 0 };
    
    const text = roles.map(r => (r.role_metadata?.company || '') + ' ' + (r.role_metadata?.title || '')).join(' ').toLowerCase();
    
    if (text.includes('bank') || text.includes('finance') || text.includes('capital')) scores.banking += 2;
    if (text.includes('pharma') || text.includes('clinical') || text.includes('drug')) scores.pharma += 2;
    if (text.includes('software') || text.includes('tech') || text.includes('developer')) scores.tech += 2;
    if (text.includes('consulting') || text.includes('strategy')) scores.consulting += 2;

    // Highest score is the domain
    let maxScore = 0;
    let primaryDomain = 'generic';
    
    for (const [domain, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            primaryDomain = domain;
        }
    }
    
    return primaryDomain;
}

function filterTermsByDomain(terms, domain) {
    if (domain === 'generic') return terms;

    const whitelist = DOMAIN_WHITELIST[domain] || [];
    
    return terms.filter(term => {
        // Always allow Tier 1 employers from other domains but flag them as non-primary
        if (term.category.startsWith('tier1_employer')) return true;
        
        // Allow regulatory bodies
        if (term.category === 'regulatory_body') return true;
        
        // Match specific domain terms
        const termDomain = term.category.split('_').pop(); // e.g. domain_term_pharma -> pharma
        if (termDomain === domain) return true;
        
        // Otherwise, it's likely a contamination risk
        return false;
    });
}

module.exports = { detectCVDomain, filterTermsByDomain };
