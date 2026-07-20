/**
 * Elite Narrative Engine
 * Synthesizes detected archetypes into a high-impact, professional executive summary.
 */
function generateExecutiveSummary(activeResults, precomputedStats) {
    if (!activeResults || activeResults.length === 0) {
        return "Standard professional profile with foundational industry experience.";
    }

    const detectedIds = activeResults.map(r => r.archetype_id);
    const detectedNames = activeResults.map(r => r.archetype_name);
    const narrativeParts = [];

    // 1. THE HOOK (Persona & Seniority)
    let hook = '';
    const seniority = precomputedStats.seniority_sequence || [];
    const maxSeniority = Math.max(...seniority);
    
    if (detectedIds.includes('ARCH_001_007') || detectedIds.includes('ARCH_001_011')) {
        hook = 'High-velocity professional with an exceptional career direction';
    } else if (detectedIds.includes('ARCH_CTX_002') || detectedIds.includes('ARCH_007_001')) {
        hook = 'Elite-tier professional with a distinguished pedigree';
    } else if (maxSeniority >= 6) {
        hook = 'high-level leader with significant executive oversight';
    } else {
        hook = 'Experienced professional with a solid track record';
    }
    
    const totalExp = Math.round(precomputedStats.total_experience_years || 0);
    narrativeParts.push(`${hook} spanning ${totalExp} years.`);

    // 2. CORE DNA (Growth & Performance)
    let dnaMsg = '';
    if (detectedIds.includes('ARCH_011_001')) {
        dnaMsg = 'Exhibits a rare combination of high-prestige pedigree and consistent, high-velocity career progression.';
    } else if (detectedIds.includes('ARCH_003_001')) {
        dnaMsg = 'Highly results-oriented profile with a significant density of quantified business outcomes.';
    } else if (detectedIds.includes('ARCH_002_001')) {
        dnaMsg = 'Demonstrates deep organizational commitment and long-term value creation.';
    }
    if (dnaMsg) narrativeParts.push(dnaMsg);

    // 3. LEADERSHIP & IMPACT
    let impactMsg = '';
    if (detectedIds.includes('ARCH_008_001')) {
        impactMsg = 'Proven executive capable of owning complex, high-stakes decisions and leading organizational change.';
    } else if (detectedIds.includes('ARCH_009_001')) {
        impactMsg = 'Expert in large-scale organizational transformation and high-level execution.';
    } else if (detectedIds.includes('ARCH_004_006')) {
        impactMsg = 'Strong emphasis on practice-building and talent development, with a track record of scaling teams.';
    }
    if (impactMsg) narrativeParts.push(impactMsg);

    // 4. SPECIALIZATION & GRIT (Functional & Industry)
    let specializationMsg = '';
    const topIndustry = activeResults.find(r => r.cluster === 'industry');
    
    if (detectedIds.includes('ARCH_SPC_007')) {
        specializationMsg = 'A battle-tested leader with significant "Crisis DNA," proven in turnaround and high-stakes restructuring environments.';
    } else if (detectedIds.includes('ARCH_SPC_009')) {
        specializationMsg = 'A hypergrowth veteran who has successfully managed the operational chaos of 10x scaling phases.';
    } else if (detectedIds.includes('ARCH_SPC_006') || detectedIds.includes('ARCH_SPC_001')) {
        specializationMsg = 'Distinguished by a strong commercial lens, with expertise in go-to-market architecture and growth strategies.';
    } else if (detectedIds.includes('ARCH_SPC_008') || detectedIds.includes('ARCH_SPC_003')) {
        specializationMsg = 'A financial-first operator with deep fluency in P&L management and bottom-line profitability.';
    } else if (topIndustry) {
        specializationMsg = `Demonstrates deep-seated expertise in the ${topIndustry.archetype_name.replace(' Specialist', '').replace(' Expert', '')} sector.`;
    }
    if (specializationMsg) narrativeParts.push(specializationMsg);

    // 5. TECHNICAL DNA (Engineering & Architecture)
    let technicalMsg = '';
    if (detectedIds.includes('ARCH_ENG_002') || detectedIds.includes('ARCH_ENG_001')) {
        technicalMsg = 'A pioneer of modern engineering standards, with deep expertise in cloud-native architecture and automated delivery lifecycles.';
    } else if (detectedIds.includes('ARCH_ENG_003')) {
        technicalMsg = 'Exhibits a strong security-first mindset, prioritizing strong architectural safeguards and compliance.';
    } else if (detectedIds.includes('ARCH_ENG_004')) {
        technicalMsg = 'Proven specialist in architectural evolution, with a track record of successfully modernizing complex legacy estates.';
    }
    if (technicalMsg) narrativeParts.push(technicalMsg);

    // 6. PRODUCT & DESIGN (Product Mastery)
    let productMsg = '';
    if (detectedIds.includes('ARCH_PRD_001') || detectedIds.includes('ARCH_PRD_004')) {
        productMsg = 'A product-first strategist with a proven track record of taking products from concept to market-shifting reality.';
    } else if (detectedIds.includes('ARCH_PRD_002') || detectedIds.includes('ARCH_PRD_005')) {
        productMsg = 'Strong advocate for design thinking and user-centricity, leading with empathy and deep customer insights.';
    } else if (detectedIds.includes('ARCH_PRD_003')) {
        productMsg = 'Deeply data-informed, focusing on long-term product health, user retention, and lifecycle optimization.';
    }
    if (productMsg) narrativeParts.push(productMsg);

    // 7. across teams BRIDGE
    if (detectedIds.includes('ARCH_DOMAIN_006')) {
        narrativeParts.push('Effectively bridges the gap between technical depth and high-level business strategy.');
    }

    // 9. BEHAVIORAL DNA (Soft Skills & EQ)
    let behavioralMsg = '';
    if (detectedIds.includes('ARCH_BEH_006') || detectedIds.includes('ARCH_BEH_010')) {
        behavioralMsg = 'A culture-building leader who prioritizes empathy, mentorship, and high-impact across teams collaboration.';
    } else if (detectedIds.includes('ARCH_BEH_007')) {
        behavioralMsg = 'A skilled organizational mediator with a proven ability to align diverse team members and partners and resolve complex conflicts.';
    } else if (detectedIds.includes('ARCH_BEH_008') || detectedIds.includes('ARCH_BEH_009')) {
        behavioralMsg = 'Exhibits strong executive presence and resilience, maintaining effectiveness in high-stakes, volatile environments.';
    }
    if (behavioralMsg) narrativeParts.push(behavioralMsg);

    // 10. GOVERNANCE & ENTERPRISE CONTROL
    let governanceMsg = '';
    if (detectedIds.includes('ARCH_GOV_001') || detectedIds.includes('ARCH_GOV_002')) {
        governanceMsg = 'Acts as a guardian of organizational integrity, with significant experience in board-level governance and regulatory navigation.';
    } else if (detectedIds.includes('ARCH_GOV_003') || detectedIds.includes('ARCH_GOV_005')) {
        governanceMsg = 'Strong focus on institutional control, ethical frameworks, and maintaining audit-ready operational standards.';
    }
    if (governanceMsg) narrativeParts.push(governanceMsg);

    // 11. GLOBAL DNA & MOBILITY
    let globalMsg = '';
    if (detectedIds.includes('ARCH_GLOB_001') || detectedIds.includes('ARCH_GLOB_002')) {
        globalMsg = 'A seasoned international operator with deep fluency in cross-border strategy and multi-national leadership.';
    } else if (detectedIds.includes('ARCH_GLOB_003')) {
        globalMsg = 'Distinguished by extensive experience in working through the complexities of high-growth emerging and frontier markets.';
    } else if (detectedIds.includes('ARCH_GLOB_004')) {
        globalMsg = 'Possesses deep institutional knowledge of operating within large-scale, matrixed multi-national corporations.';
    }
    if (globalMsg) narrativeParts.push(globalMsg);

    // 12. COMMERCIAL & REVENUE ENGINE
    let revenueMsg = '';
    if (detectedIds.includes('ARCH_REV_005') || detectedIds.includes('ARCH_REV_001')) {
        revenueMsg = 'A high-impact commercial powerhouse with a proven track record of leading new business acquisition and closing complex, seven-figure enterprise deals.';
    } else if (detectedIds.includes('ARCH_REV_002')) {
        revenueMsg = 'Skilled in high-level account expansion and relationship management, with a deep focus on long-term revenue growth and customer LTV.';
    } else if (detectedIds.includes('ARCH_REV_003') || detectedIds.includes('ARCH_REV_004')) {
        revenueMsg = 'Expert in revenue operations and partnership environments, capable of architecting scalable engines for commercial success.';
    }
    if (revenueMsg) narrativeParts.push(revenueMsg);

    // 13. CUSTOMER CENTRICITY (Success & Retention)
    let serviceMsg = '';
    if (detectedIds.includes('ARCH_CS_001') || detectedIds.includes('ARCH_CS_005')) {
        serviceMsg = 'A specialist in recurring revenue protection, with deep expertise in churn reduction and scalable customer success models.';
    } else if (detectedIds.includes('ARCH_CS_002') || detectedIds.includes('ARCH_CS_003')) {
        serviceMsg = 'Deeply customer-centric, with a proven track record of architecting superior user journeys and leading institutional NPS improvements.';
    } else if (detectedIds.includes('ARCH_CS_004')) {
        serviceMsg = 'Focused on accelerating customer time-to-value through streamlined implementation and adoption frameworks.';
    }
    if (serviceMsg) narrativeParts.push(serviceMsg);

    // 14. PEOPLE & CULTURE
    let peopleMsg = '';
    if (detectedIds.includes('ARCH_PEO_001') || detectedIds.includes('ARCH_PEO_002')) {
        peopleMsg = 'An expert in human capital strategy, with a deep focus on building elite talent pipelines and high-performance organizational cultures.';
    } else if (detectedIds.includes('ARCH_PEO_003')) {
        peopleMsg = 'Highly skilled in compensation and equity strategy, capable of designing sophisticated total rewards programs for global workforces.';
    } else if (detectedIds.includes('ARCH_PEO_004')) {
        peopleMsg = 'Focused on organizational upskilling and talent development, ensuring a sustainable internal pipeline of future leaders.';
    }
    if (peopleMsg) narrativeParts.push(peopleMsg);

    // 15. FINANCE & STEWARDSHIP
    let financeMsg = '';
    if (detectedIds.includes('ARCH_FIN_001') || detectedIds.includes('ARCH_FIN_002')) {
        financeMsg = 'A sophisticated financial strategist with deep expertise in fiscal planning, commercial control, and margin optimization.';
    } else if (detectedIds.includes('ARCH_FIN_004')) {
        financeMsg = 'Proven expert in the capital markets, with a track record of executing complex M&A transactions and leading corporate development.';
    } else if (detectedIds.includes('ARCH_FIN_005') || detectedIds.includes('ARCH_FIN_003')) {
        financeMsg = 'Distinguished by a strong command of capital structure, investor communication, and global fiscal compliance.';
    }
    if (financeMsg) narrativeParts.push(financeMsg);

    // 16. LEGAL & INTEGRITY
    let legalMsg = '';
    if (detectedIds.includes('ARCH_LEG_001') || detectedIds.includes('ARCH_LEG_003')) {
        legalMsg = 'A seasoned legal heavyweight with a strong command of corporate governance, high-level advisory, and complex dispute resolution.';
    } else if (detectedIds.includes('ARCH_LEG_002')) {
        legalMsg = 'Expert in the management and protection of intellectual property, with a focus on maximizing the value of innovation portfolios.';
    } else if (detectedIds.includes('ARCH_LEG_004')) {
        legalMsg = 'Distinguished by a deep commitment to data privacy and ethics, ensuring global regulatory compliance and digital trust.';
    }
    if (legalMsg) narrativeParts.push(legalMsg);

    // 17. OPERATIONS & SUPPLY CHAIN
    let opsMsg = '';
    if (detectedIds.includes('ARCH_OPS_001') || detectedIds.includes('ARCH_OPS_002')) {
        opsMsg = 'A master of operational complexity, with deep expertise in orchestrating global supply chains and large-scale logistics networks.';
    } else if (detectedIds.includes('ARCH_OPS_003') || detectedIds.includes('ARCH_OPS_004')) {
        opsMsg = 'Expert in high-level sourcing and inventory optimization, with a proven ability to lead cost efficiency and demand-leadn supply stability.';
    } else if (detectedIds.includes('ARCH_OPS_005')) {
        opsMsg = 'Focused on building sustainable and ethical supply chains, aligning operational efficiency with ESG goals.';
    }
    if (opsMsg) narrativeParts.push(opsMsg);

    // 18. MARKETING & GROWTH
    let marketingMsg = '';
    if (detectedIds.includes('ARCH_MKT_001') || detectedIds.includes('ARCH_MKT_005')) {
        marketingMsg = 'A visionary brand builder and communications strategist, capable of designing high-impact identities and managing complex corporate reputations.';
    } else if (detectedIds.includes('ARCH_MKT_004') || detectedIds.includes('ARCH_MKT_002')) {
        marketingMsg = 'Data-leadn growth engine with expertise in full-funnel optimization, performance scaling, and rapid experimentation.';
    } else if (detectedIds.includes('ARCH_MKT_003')) {
        marketingMsg = 'Skilled storyteller and creative director, with a deep focus on content-led growth and high-level brand narrative.';
    }
    if (marketingMsg) narrativeParts.push(marketingMsg);

    // 19. DATA & AI INTELLIGENCE
    let dataMsg = '';
    if (detectedIds.includes('ARCH_DATA_001') || detectedIds.includes('ARCH_DATA_002')) {
        dataMsg = 'At the frontier of the intelligence economy, with deep expertise in AI research, machine learning engineering, and advanced model deployment.';
    } else if (detectedIds.includes('ARCH_DATA_004')) {
        dataMsg = 'Architect of large-scale data environments, capable of managing massive datasets and complex distributed processing infrastructures.';
    } else if (detectedIds.includes('ARCH_DATA_003') || detectedIds.includes('ARCH_DATA_005')) {
        dataMsg = 'Strong analytical lead with a proven ability to translate complex data into compelling visual narratives and high-level business insights.';
    }
    if (dataMsg) narrativeParts.push(dataMsg);

    // 20. SERVICE OPERATIONS
    let serviceOpsMsg = '';
    if (detectedIds.includes('ARCH_SRV_001') || detectedIds.includes('ARCH_SRV_002')) {
        serviceOpsMsg = 'A master of service delivery and support operations, with a deep focus on operational efficiency and meeting complex service level agreements.';
    } else if (detectedIds.includes('ARCH_SRV_004')) {
        serviceOpsMsg = 'Expert in technical troubleshooting and escalation management, capable of leading high-stakes support environments.';
    } else if (detectedIds.includes('ARCH_SRV_003') || detectedIds.includes('ARCH_SRV_005')) {
        serviceOpsMsg = 'Distinguished by a focus on community engagement and automated support strategies, leading user trust at scale.';
    }
    if (serviceOpsMsg) narrativeParts.push(serviceOpsMsg);

    // 21. GOVERNANCE & EXECUTION
    let govMsg = '';
    if (detectedIds.includes('ARCH_GOV_006') || detectedIds.includes('ARCH_GOV_008')) {
        govMsg = 'Demonstrates exceptional rigor in program governance and delivery, with a proven ability to architect execution frameworks and ensure predictable business outcomes.';
    } else if (detectedIds.includes('ARCH_GOV_007')) {
        govMsg = 'Champion of agile methodologies and organizational transformation, focused on leading delivery velocity and across teams alignment.';
    } else if (detectedIds.includes('ARCH_GOV_009')) {
        govMsg = 'Ensures operational integrity through strong risk mitigation and compliance frameworks, balancing aggressive execution with regulatory rigor.';
    } else if (detectedIds.includes('ARCH_GOV_010')) {
        govMsg = 'Specializes in leading organizational change and adoption, ensuring that large-scale transformations deliver lasting business value.';
    }
    if (govMsg) narrativeParts.push(govMsg);
    
    // 22. expertSHIP & EXECUTIVE PRESENCE (Batch 22)
    let presenceMsg = '';
    if (detectedIds.includes('ARCH_EXE_001') || detectedIds.includes('ARCH_EXE_005')) {
        presenceMsg = 'Acts as a high-level high-level advisor with significant experience in board-level engagement and corporate governance.';
    } else if (detectedIds.includes('ARCH_EXE_002') || detectedNames.includes('Industry Influencer')) {
        presenceMsg = 'Recognized as an industry expert, with a proven track record of public speaking and contributing to sector-wide discourse.';
    } else if (detectedIds.includes('ARCH_EXE_003')) {
        presenceMsg = 'Demonstrates a strong commitment to sustainable leadership, with expertise in Environmental, Social, and Governance (ESG) frameworks.';
    }
    if (presenceMsg) narrativeParts.push(presenceMsg);

    // 23. high-level ALLIANCES & environments (Batch 23)
    let allianceMsg = '';
    if (detectedIds.includes('ARCH_ALL_001') || detectedIds.includes('ARCH_ALL_004')) {
        allianceMsg = 'Expert in architecting complex high-level alliances and joint ventures to lead non-linear business growth.';
    } else if (detectedIds.includes('ARCH_ALL_002')) {
        allianceMsg = 'Proven track record of building and scaling business environments and platform-led growth models.';
    } else if (detectedIds.includes('ARCH_ALL_003')) {
        allianceMsg = 'Specializes in high-stakes M&A integration, ensuring operational effective collaboration and cultural alignment post-acquisition.';
    } else if (detectedIds.includes('ARCH_ALL_005')) {
        allianceMsg = 'Highly skilled in scaling businesses through sophisticated franchise and licensed expansion models.';
    }
    if (allianceMsg) narrativeParts.push(allianceMsg);

    // 24. PRODUCT OPERATIONS & GROWTH (Batch 24)
    let prodOpsMsg = '';
    if (detectedIds.includes('ARCH_PRO_006')) {
        prodOpsMsg = 'Distinguished by a focus on operationalizing product teams, streamlining delivery cycles, and standardizing product processes.';
    } else if (detectedNames.includes('PLG Champion')) {
        prodOpsMsg = 'Specializes in product-led growth (PLG), leveraging the product itself as the primary leadr of acquisition, expansion, and retention.';
    } else if (detectedIds.includes('ARCH_PRO_009')) {
        prodOpsMsg = 'Demonstrates deep expertise in product monetization, pricing architecture, and revenue-focused SKU strategy.';
    }
    if (prodOpsMsg) narrativeParts.push(prodOpsMsg);

    // 25. ENGINEERING LEADERSHIP (Batch 25)
    let engLeadMsg = '';
    if (detectedIds.includes('ARCH_ENG_006')) {
        engLeadMsg = 'A high-level technology leader with a focus on R&D, long-term roadmaps, and C-suite technical advisory.';
    } else if (detectedIds.includes('ARCH_ENG_007')) {
        engLeadMsg = 'Experienced in scaling engineering organizations, nurturing technical culture, and leading operational excellence at scale.';
    } else if (detectedIds.includes('ARCH_ENG_008')) {
        engLeadMsg = 'Possesses the rare 0-to-1 founding experience, having led technical product births through early-stage growth and fundraising.';
    }
    if (engLeadMsg) narrativeParts.push(engLeadMsg);

    // 26. ADVANCED TECH ARCHITECTURE (Batch 26)
    let archMsg = '';
    if (detectedIds.includes('ARCH_ENG_011')) {
        archMsg = 'Specializes in the high-performance infrastructure required for modern AI/ML workloads, including GPU scaling and vector data management.';
    } else if (detectedIds.includes('ARCH_ENG_012')) {
        archMsg = 'An expert in distributed systems, service mesh, and complex event-leadn microservices architectures.';
    } else if (detectedIds.includes('ARCH_ENG_014')) {
        archMsg = 'Possesses deep expertise in edge-side computation and global, low-latency delivery strategies.';
    }
    if (archMsg) narrativeParts.push(archMsg);

    // 27. SALES & REVENUE OPERATIONS (Batch 27)
    let revOpsMsg = '';
    if (detectedIds.includes('ARCH_OPS_006')) {
        revOpsMsg = 'An expert in revenue operations, specializing in across teams data alignment and funnel optimization.';
    } else if (detectedIds.includes('ARCH_OPS_007')) {
        revOpsMsg = 'Focused on leading sales productivity through high-level training, playbooks, and methodology adoption.';
    }
    if (revOpsMsg) narrativeParts.push(revOpsMsg);

    // 28. CUSTOMER SUCCESS & RETENTION (Batch 28)
    let csMsg = '';
    if (detectedNames.includes('Churn Mitigation Lead')) {
        csMsg = 'A retention specialist focused on churn risk modeling and proactive customer health management.';
    } else if (detectedNames.includes('CSM Leader (Scaled)')) {
        csMsg = 'Experienced in leading large-scale or digital-touch Customer Success organizations to lead retention at scale.';
    }
    if (csMsg) narrativeParts.push(csMsg);

    // 29 & 30. CREATIVE, LEGAL & GOVERNANCE
    if (detectedNames.includes('Creative Director (Digital)')) {
        narrativeParts.push('A high-level creative leader capable of leading large-scale brand vision and visual storytelling.');
    }
    if (detectedIds.includes('ARCH_LEG_008')) {
        narrativeParts.push('Expert in working through high-stakes regulatory environments and statutory approval processes.');
    }
    if (detectedIds.includes('ARCH_LEG_006')) {
        narrativeParts.push('Specializes in the complex compliance frameworks of international trade and export controls (ITAR/EAR).');
    }

    // 31 & 32. SUPPLY CHAIN & HEALTHTECH
    if (detectedIds.includes('ARCH_OPS_011')) {
        narrativeParts.push('Possesses specialized expertise in the management of temperature-controlled supply chains, critical for pharmaceutical integrity.');
    }
    if (detectedIds.includes('ARCH_SPC_012')) {
        narrativeParts.push('Experienced in the end-to-end operational management of clinical trials and GCP-compliant scientific delivery.');
    }

    // 33-36. ESG, AI & HIGH-STAKES
    if (detectedIds.includes('ARCH_ESG_001')) {
        narrativeParts.push('Specialist in sustainability disclosure and ESG reporting frameworks (GRI/SASB).');
    }
    if (detectedIds.includes('ARCH_AI_001')) {
        narrativeParts.push('Technical expert in the productionization and scaling of machine learning models.');
    }
    if (detectedIds.includes('ARCH_OPS_016')) {
        narrativeParts.push('Critical architect of business continuity and disaster recovery strategies for high-availability systems.');
    }
    if (detectedIds.includes('ARCH_OPS_020')) {
        narrativeParts.push('Expert in designing and auditing anti-fraud and financial crime mitigation systems.');
    }

    // 8. RISK/CONTEXT CAVEATS
    if (detectedIds.includes('ARCH_RISK_004')) {
        narrativeParts.push('Career history includes non-linear periods, suggesting significant pivots or high-level professional pauses.');
    } else if (detectedIds.includes('ARCH_RISK_005')) {
        narrativeParts.push('Some role descriptions exhibit vague outcomes, suggesting a need for deeper verification of executive ownership.');
    }

    return narrativeParts.join(' ');
}

module.exports = {
    generateExecutiveSummary
};
