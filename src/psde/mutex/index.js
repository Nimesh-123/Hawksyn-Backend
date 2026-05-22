/**
 * PSDE Mutex (Mutual Exclusion) Engine
 * 
 * Logic: When a "Stronger" archetype is detected, we suppress the "Weaker" 
 * or "More General" version to maintain report clarity.
 */

const MUTEX_RULES = {
    // [Stronger Archetype ID] -> [Archetypes to Suppress]
    'ARCH_001_003': ['ARCH_001_001'], // Accelerated Growth suppresses Linear Growth
    'ARCH_001_011': ['ARCH_011_001', 'ARCH_012_001'], // Consistent High Velocity suppresses basic velocity/fast track
    'ARCH_001_007': ['ARCH_001_001'], // Multi-Level Jump suppresses Linear Growth
    'ARCH_001_008': ['ARCH_001_002'], // Internal Mobility Specialist suppresses basic Internal Promotion
    
    'ARCH_002_004': ['ARCH_002_001'], // Sector Loyalist suppresses Long Tenure
    'ARCH_002_009': ['ARCH_002_001'], // Anchor Tenure suppresses Long Tenure
    
    'ARCH_008_001': ['ARCH_004_001'], // Executive Ownership suppresses general Leadership Density
    
    'ARCH_010_009': ['ARCH_009_001'], // Digital Transformation Architect suppresses general Transformation Specialist
    'ARCH_010_007': ['ARCH_010_006'], // Post-Merger Navigator suppresses M&A Integration (PMI is more specific)
    
    'ARCH_DOMAIN_006': ['ARCH_005_001'], // Cross-Functional Bridge suppresses general Domain Depth
    'ARCH_DOMAIN_009': ['ARCH_015_001'], // Global Perspective suppresses general Cross-Industry Exposure
    
    // Industry specific suppression
    'ARCH_IND_001': ['ARCH_DOMAIN_010'], // SaaS Expert suppresses Niche Domain Specialist
    'ARCH_IND_002': ['ARCH_DOMAIN_010'], // FinTech Specialist suppresses Niche Domain Specialist
    'ARCH_IND_003': ['ARCH_DOMAIN_010'], // BFSI Veteran suppresses Niche Domain Specialist
    'ARCH_IND_004': ['ARCH_DOMAIN_010'], // E-commerce Specialist suppresses Niche Domain Specialist
    'ARCH_IND_005': ['ARCH_DOMAIN_010'], // Manufacturing Lead suppresses Niche Domain Specialist
    'ARCH_IND_006': ['ARCH_DOMAIN_010'], // Healthcare Domain Expert suppresses Niche Domain Specialist
    'ARCH_IND_007': ['ARCH_DOMAIN_010'], // Consumer Goods Expert suppresses Niche Domain Specialist
    
    // Behavioral & Contextual suppression
    'ARCH_BEH_003': ['ARCH_BEH_004'], // Visionary Leader suppresses Methodical Operator
    'ARCH_BEH_005': ['ARCH_011_001'], // High Ambition suppresses standard Promotion Velocity
    'ARCH_CTX_002': ['ARCH_CTX_003'], // Big Tech Alumni suppresses Mature Enterprise Leader

    // Batch 5 (Specialization)
    'ARCH_SPC_003': ['ARCH_010_008'], // Profitability Driver -> Cost Optimisation Lead
    'ARCH_SPC_006': ['ARCH_010_001'], // GTM Architect -> Strategic Execution
    
    // Batch 6 (Financial & Crisis)
    'ARCH_SPC_007': ['ARCH_BEH_002'], // Crisis DNA -> Crisis Manager
    'ARCH_SPC_009': ['ARCH_010_004'], // Hypergrowth Veteran -> Scale-Up Expert
    'ARCH_SPC_011': ['ARCH_003_004'], // Capital Efficiency Lead -> Efficiency Expert
    
    // Batch 7 (Engineering Culture)
    'ARCH_ENG_002': ['ARCH_010_009'], // Cloud Native Architect -> Digital Transformation Architect
    'ARCH_ENG_004': ['ARCH_009_001'], // Legacy Modernizer -> Transformation Specialist

    // Batch 8 (Product & Design)
    'ARCH_PRD_001': ['ARCH_010_001'], // Product Visionary -> Strategic Execution
    'ARCH_PRD_004': ['ARCH_009_002'], // Zero-to-One Lead -> Innovation Specialist

    // Batch 9 (Soft Skills & EQ)
    'ARCH_BEH_006': ['ARCH_004_005'], // Empathetic Leader -> Mentorship Profile
    'ARCH_BEH_007': ['ARCH_004_007'], // Conflict Navigator -> Stakeholder Navigator
    'ARCH_BEH_010': ['ARCH_004_008'], // Collaborative Catalyst -> Cross-Functional Leader

    // Batch 10 (Governance & Compliance)
    'ARCH_GOV_001': ['ARCH_008_001'], // Governance Guardian -> Executive Ownership
    'ARCH_GOV_002': ['ARCH_DOMAIN_004'], // Regulatory Navigator -> Regulatory Specialist
    'ARCH_GOV_005': ['ARCH_BEH_004'], // Audit Readiness Expert -> Methodical Operator

    // Batch 11 (International & Global Mobility)
    'ARCH_GLOB_004': ['ARCH_CTX_003'], // Multi-National Operator -> Mature Enterprise Leader
    'ARCH_GLOB_001': ['ARCH_DOMAIN_009'], // Expat Leader -> Global Perspective

    // Batch 12 (Sales & Revenue)
    'ARCH_REV_005': ['ARCH_003_003'], // High-Ticket Closer -> Revenue Driver
    'ARCH_REV_003': ['ARCH_010_010'], // RevOps Architect -> Operating Model Specialist

    // Batch 13 (Customer Success)
    'ARCH_CS_003': ['ARCH_PRD_005'], // Customer Advocate -> Voice of Customer (VoC) Lead
    'ARCH_CS_002': ['ARCH_PRD_002'], // CX Architect -> Design Thinking Advocate

    // Batch 14 (HR & People)
    'ARCH_PEO_001': ['ARCH_004_006'], // Talent Architect -> Team Builder
    'ARCH_PEO_002': ['ARCH_BEH_006'], // Culture Designer -> Empathetic Leader

    // Batch 15 (Finance & Control)
    'ARCH_FIN_001': ['ARCH_004_009'], // FP&A Strategist -> Strategic Execution
    'ARCH_FIN_002': ['ARCH_010_003'], // Commercial Controller -> Cost Optimisation Lead

    // Batch 16 (Legal & IP)
    'ARCH_LEG_001': ['ARCH_GOV_002'], // General Counsel -> Regulatory Navigator
    'ARCH_LEG_004': ['ARCH_GOV_004'], // Privacy & Data Ethics Lead -> Policy Architect

    // Batch 17 (Supply Chain)
    'ARCH_OPS_001': ['ARCH_010_010'], // Supply Chain Orchestrator -> Operating Model Specialist
    'ARCH_OPS_003': ['ARCH_010_003'], // Procurement Powerhouse -> Cost Optimisation Lead

    // Batch 18 (Marketing & Brand)
    'ARCH_MKT_004': ['ARCH_PRD_001'], // Growth Marketer -> Product Visionary
    'ARCH_MKT_001': ['ARCH_PEO_002'], // Brand Architect -> Culture Designer

    // Batch 19 (Data & AI)
    'ARCH_DATA_001': ['ARCH_ENG_005'], // AI Researcher -> Data-Driven Engineer
    'ARCH_DATA_004': ['ARCH_ENG_005'], // Big Data Architect -> Data-Driven Engineer

    // Batch 20 (Support & Service)
    'ARCH_SRV_001': ['ARCH_010_010'], // Support Architect -> Operating Model Specialist
    'ARCH_SRV_004': ['ARCH_BEH_001'], // Technical Support Lead -> Problem Solver

    // Batch 21 (Governance & Execution)
    'ARCH_GOV_006': ['ARCH_BEH_004'], // PMO Architect -> Methodical Operator
    'ARCH_GOV_007': ['ARCH_BEH_010'], // Agile Coach -> Collaborative Catalyst
    'ARCH_GOV_008': ['ARCH_010_001'], // Delivery Lead -> Strategic Execution
    'ARCH_GOV_009': ['ARCH_GOV_001'], // Risk & Compliance Lead -> Governance Guardian
    'ARCH_GOV_010': ['ARCH_009_001'], // Change Management Specialist -> Transformation Specialist

    // Batch 22 (Thought Leadership & Executive Presence)
    'ARCH_EXE_001': ['ARCH_EXE_005'], // Board Advisor -> Strategic Advisor
    'ARCH_EXE_004': ['ARCH_023_001'], // Industry Influencer -> High Domain Fluency
    'ARCH_EXE_002': ['ARCH_BEH_009'], // Public Speaker -> Influential Communicator

    // Batch 23 (Strategic Alliances & Ecosystems)
    'ARCH_ALL_003': ['ARCH_010_006'], // M&A Integration Expert -> M&A Integration Specialist
    'ARCH_ALL_001': ['ARCH_DOMAIN_006'], // Partnership Architect -> Cross-Functional Bridge

    // Batch 24 (Product Operations & Growth)
    'ARCH_PRO_007': ['ARCH_001_004'], // PLG Champion -> Growth Hacker
    'ARCH_PRO_010': ['ARCH_010_003'], // A/B Testing Specialist -> Data-Driven Lead

    // Batch 25 (Engineering Leadership)
    'ARCH_ENG_007': ['ARCH_ENG_010'], // VP Engineering -> Engineering Manager

    // Batch 26 (Advanced Tech Architecture)
    'ARCH_ENG_012': ['ARCH_ENG_002'], // Microservices Guru -> Cloud Native Architect

    // Batch 27 (Sales & Revenue Operations)
    'ARCH_OPS_006': ['ARCH_SPC_006'], // RevOps Strategist -> GTM Architect

    // Batch 28 (Customer Success & Retention)
    'ARCH_CS_010': ['ARCH_011_002'],   // CSM Leader (Scaled) -> Account Manager

    // Batch 29 & 30
    'ARCH_CRT_002': ['ARCH_MKT_001'],  // Creative Director -> Brand Architect
    'ARCH_LEG_008': ['ARCH_DOMAIN_004'] // Regulatory Affairs Director -> Regulatory Specialist
};

/**
 * Filters detected archetypes based on Mutex rules.
 * @param {Array} results - The detected archetype results from the scan
 * @returns {Array} - Filtered results with suppressed archetypes marked or removed
 */
function applyArchetypeMutex(results) {
    const detectedIds = results
        .filter(r => r.detection_state === 'detected')
        .map(r => r.archetype_id);

    return results.map(res => {
        // If this archetype is in the suppression list of another detected archetype
        let isSuppressed = false;
        let suppressedBy = null;

        for (const [strongerId, suppressedIds] of Object.entries(MUTEX_RULES)) {
            if (res.detection_state === 'detected' && detectedIds.includes(strongerId) && strongerId !== res.archetype_id) {
                if (suppressedIds.includes(res.archetype_id)) {
                    isSuppressed = true;
                    suppressedBy = strongerId;
                    break;
                }
            }
        }

        if (isSuppressed) {
            return {
                ...res,
                detection_state: 'partial', // Losers become partial, not suppressed
                confidence_score: Math.min(res.confidence_score, 0.5), // Reduce confidence
                flags: [...(res.flags || []), `mutex_suppressed_by:${suppressedBy}`]
            };
        }

        return res;
    });
}

module.exports = { applyArchetypeMutex };
