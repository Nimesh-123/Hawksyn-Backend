let domainTermsCache = [];
let archetypeRegistryCache = [];

async function loadMemoryCaches(db) {
  // Load domain knowledge
  domainTermsCache = await db.collection('domain_knowledge')
    .find({ is_active: true })
    .toArray();
  console.log(`${domainTermsCache.length} domain terms loaded into memory`);

  // Load archetype registry
  archetypeRegistryCache = await db.collection('archetype_rules')
    .find({ is_active: true })
    .toArray();
  console.log(`${archetypeRegistryCache.length} archetype rules loaded into memory`);
}

// Build domain_knowledge_reference string for injection into prompts
function buildDomainReference() {
  const byCategory = {};
  for (const term of domainTermsCache) {
    if (!byCategory[term.category]) byCategory[term.category] = [];
    byCategory[term.category].push(term.term_canonical);
  }

  return `
DOMAIN KNOWLEDGE REFERENCE:
regulatory_body: ${(byCategory.regulatory_body || []).join(', ')}
tier1_employer_it: ${(byCategory.tier1_employer_it || []).join(', ')}
tier1_employer_banking: ${(byCategory.tier1_employer_banking || []).join(', ')}
tier1_employer_consulting: ${(byCategory.tier1_employer_consulting || []).join(', ')}
tier1_employer_psu: ${(byCategory.tier1_employer_psu || []).join(', ')}
tier1_employer_conglomerate: ${(byCategory.tier1_employer_conglomerate || []).join(', ')}
tier1_employer_fmcg: ${(byCategory.tier1_employer_fmcg || []).join(', ')}
banking_term: ${(byCategory.banking_term || []).join(', ')}
pharma_term: ${(byCategory.pharma_term || []).join(', ')}
insurance_term: ${(byCategory.insurance_term || []).join(', ')}

CANONICAL EMPLOYER NAMES (use these exact values for company_canonical):
Boston Consulting Group -> BCG
McKinsey & Company -> McKinsey
Bain & Company -> Bain
HDFC Bank Limited -> HDFC Bank
ICICI Bank Limited -> ICICI Bank
Standard Chartered Bank -> Standard Chartered India
Kotak Mahindra Bank Limited -> Kotak Mahindra Bank
Tata Steel Limited -> Tata Steel
Bharat Heavy Electricals Limited -> BHEL
Reliance Industries Limited -> Reliance Industries
Deloitte Haskins and Sells -> Deloitte India
  `.trim();
}

function getDomainTermsCache() { return domainTermsCache; }
function getArchetypeRegistry() { return archetypeRegistryCache; }

module.exports = {
  loadMemoryCaches,
  buildDomainReference,
  getDomainTermsCache,
  getArchetypeRegistry
};
