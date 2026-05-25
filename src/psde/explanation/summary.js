/**
 * Elite Narrative Engine
 * Synthesizes detected archetypes into a high-impact, professional executive summary.
 */
function generateExecutiveSummary(activeResults, precomputedStats) {
    if (!activeResults || activeResults.length === 0) {
        return "Standard professional profile with foundational industry experience.";
    }

    const detectedNames = activeResults.map(r => r.archetype_name);
    const narrativeParts = [];

    // 1. THE HOOK (Persona & Seniority)
    let hook = '';
    const seniority = precomputedStats.seniority_sequence || [];
    const maxSeniority = Math.max(...seniority);
    
    if (detectedNames.includes('Multi-Level Jump') || detectedNames.includes('Consistent High Velocity')) {
        hook = 'High-velocity professional with an exceptional trajectory';
    } else if (detectedNames.includes('Big Tech Alumni') || detectedNames.includes('Tier-1 Career')) {
        hook = 'Elite-tier professional with a distinguished pedigree';
    } else if (maxSeniority >= 6) {
        hook = 'Strategic leader with significant executive oversight';
    } else {
        hook = 'Experienced professional with a solid track record';
    }
    
    const totalExp = Math.round(precomputedStats.total_experience_years || 0);
    narrativeParts.push(`${hook} spanning ${totalExp} years.`);

    // 2. CORE DNA (Growth & Performance)
    let dnaMsg = '';
    if (detectedNames.includes('Promotion Velocity')) {
        dnaMsg = 'Exhibits a rare combination of high-prestige pedigree and consistent, high-velocity career progression.';
    } else if (detectedNames.includes('Quantified Impact')) {
        dnaMsg = 'Highly results-oriented profile with a significant density of quantified business outcomes.';
    } else if (detectedNames.includes('Long Tenure')) {
        dnaMsg = 'Demonstrates deep organizational commitment and long-term value creation.';
    }
    if (dnaMsg) narrativeParts.push(dnaMsg);

    // 3. LEADERSHIP & IMPACT
    let impactMsg = '';
    if (detectedNames.includes('Executive Ownership')) {
        impactMsg = 'Proven executive capable of owning complex, high-stakes decisions and driving organizational change.';
    } else if (detectedNames.includes('Transformation Specialist')) {
        impactMsg = 'Expert in large-scale organizational transformation and strategic execution.';
    } else if (detectedNames.includes('Team Builder')) {
        impactMsg = 'Strong emphasis on practice-building and talent development, with a track record of scaling teams.';
    }
    if (impactMsg) narrativeParts.push(impactMsg);

    // 4. SPECIALIZATION & GRIT (Functional & Industry)
    let specializationMsg = '';
    const topIndustry = activeResults.find(r => r.cluster === 'industry');
    
    if (detectedNames.includes('Crisis DNA')) {
        specializationMsg = 'A battle-tested leader with significant "Crisis DNA," proven in turnaround and high-stakes restructuring environments.';
    } else if (detectedNames.includes('Hypergrowth Veteran')) {
        specializationMsg = 'A hypergrowth veteran who has successfully navigated the operational chaos of 10x scaling phases.';
    } else if (detectedNames.includes('GTM Architect') || detectedNames.includes('PLG Expert')) {
        specializationMsg = 'Distinguished by a strong commercial lens, with expertise in go-to-market architecture and growth strategies.';
    } else if (detectedNames.includes('Financial Literacy Expert') || detectedNames.includes('Profitability Driver')) {
        specializationMsg = 'A financial-first operator with deep fluency in P&L management and bottom-line profitability.';
    } else if (topIndustry) {
        specializationMsg = `Demonstrates deep-seated expertise in the ${topIndustry.archetype_name.replace(' Specialist', '').replace(' Expert', '')} sector.`;
    }
    if (specializationMsg) narrativeParts.push(specializationMsg);

    // 5. TECHNICAL DNA (Engineering & Architecture)
    let technicalMsg = '';
    if (detectedNames.includes('Cloud Native Architect') || detectedNames.includes('DevOps Pioneer')) {
        technicalMsg = 'A pioneer of modern engineering standards, with deep expertise in cloud-native architecture and automated delivery lifecycles.';
    } else if (detectedNames.includes('Security-First Developer')) {
        technicalMsg = 'Exhibits a strong security-first mindset, prioritizing robust architectural safeguards and compliance.';
    } else if (detectedNames.includes('Legacy Modernizer')) {
        technicalMsg = 'Proven specialist in architectural evolution, with a track record of successfully modernizing complex legacy estates.';
    }
    if (technicalMsg) narrativeParts.push(technicalMsg);

    // 6. PRODUCT & DESIGN (Product Mastery)
    let productMsg = '';
    if (detectedNames.includes('Product Visionary') || detectedNames.includes('Zero-to-One Lead')) {
        productMsg = 'A product-first strategist with a proven track record of taking products from concept to market-shifting reality.';
    } else if (detectedNames.includes('Design Thinking Advocate') || detectedNames.includes('Voice of Customer (VoC) Lead')) {
        productMsg = 'Strong advocate for design thinking and user-centricity, leading with empathy and deep customer insights.';
    } else if (detectedNames.includes('Retention Specialist')) {
        productMsg = 'Deeply data-informed, focusing on long-term product health, user retention, and lifecycle optimization.';
    }
    if (productMsg) narrativeParts.push(productMsg);

    // 7. CROSS-FUNCTIONAL BRIDGE
    if (detectedNames.includes('Cross-Functional Bridge')) {
        narrativeParts.push('Effectively bridges the gap between technical depth and high-level business strategy.');
    }

    // 9. BEHAVIORAL DNA (Soft Skills & EQ)
    let behavioralMsg = '';
    if (detectedNames.includes('Empathetic Leader') || detectedNames.includes('Collaborative Catalyst')) {
        behavioralMsg = 'A culture-building leader who prioritizes empathy, mentorship, and high-impact cross-functional collaboration.';
    } else if (detectedNames.includes('Conflict Navigator')) {
        behavioralMsg = 'A skilled organizational mediator with a proven ability to align diverse stakeholders and resolve complex conflicts.';
    } else if (detectedNames.includes('Resilient Operator') || detectedNames.includes('Influential Communicator')) {
        behavioralMsg = 'Exhibits strong executive presence and resilience, maintaining effectiveness in high-stakes, volatile environments.';
    }
    if (behavioralMsg) narrativeParts.push(behavioralMsg);

    // 10. GOVERNANCE & ENTERPRISE CONTROL
    let governanceMsg = '';
    if (detectedNames.includes('Governance Guardian') || detectedNames.includes('Regulatory Navigator')) {
        governanceMsg = 'Acts as a guardian of organizational integrity, with significant experience in board-level governance and regulatory navigation.';
    } else if (detectedNames.includes('Ethics & Integrity Lead') || detectedNames.includes('Audit Readiness Expert')) {
        governanceMsg = 'Strong focus on institutional control, ethical frameworks, and maintaining audit-ready operational standards.';
    }
    if (governanceMsg) narrativeParts.push(governanceMsg);

    // 11. GLOBAL DNA & MOBILITY
    let globalMsg = '';
    if (detectedNames.includes('Expat Leader') || detectedNames.includes('Cross-Border Strategist')) {
        globalMsg = 'A seasoned international operator with deep fluency in cross-border strategy and multi-national leadership.';
    } else if (detectedNames.includes('Emerging Markets Pioneer')) {
        globalMsg = 'Distinguished by extensive experience in navigating the complexities of high-growth emerging and frontier markets.';
    } else if (detectedNames.includes('Multi-National Operator')) {
        globalMsg = 'Possesses deep institutional knowledge of operating within large-scale, matrixed multi-national corporations.';
    }
    if (globalMsg) narrativeParts.push(globalMsg);

    // 12. COMMERCIAL & REVENUE ENGINE
    let revenueMsg = '';
    if (detectedNames.includes('High-Ticket Closer') || detectedNames.includes('Sales Hunter')) {
        revenueMsg = 'A high-impact commercial powerhouse with a proven track record of driving new business acquisition and closing complex, seven-figure enterprise deals.';
    } else if (detectedNames.includes('Account Farmer')) {
        revenueMsg = 'Skilled in strategic account expansion and relationship management, with a deep focus on long-term revenue growth and customer LTV.';
    } else if (detectedNames.includes('RevOps Architect') || detectedNames.includes('Channel Strategy Lead')) {
        revenueMsg = 'Expert in revenue operations and partnership ecosystems, capable of architecting scalable engines for commercial success.';
    }
    if (revenueMsg) narrativeParts.push(revenueMsg);

    // 13. CUSTOMER CENTRICITY (Success & Retention)
    let serviceMsg = '';
    if (detectedNames.includes('Retention Master') || detectedNames.includes('Scale CSM')) {
        serviceMsg = 'A specialist in recurring revenue protection, with deep expertise in churn reduction and scalable customer success models.';
    } else if (detectedNames.includes('CX Architect') || detectedNames.includes('Customer Advocate')) {
        serviceMsg = 'Deeply customer-centric, with a proven track record of architecting superior user journeys and driving institutional NPS improvements.';
    } else if (detectedNames.includes('Onboarding Specialist')) {
        serviceMsg = 'Focused on accelerating customer time-to-value through streamlined implementation and adoption frameworks.';
    }
    if (serviceMsg) narrativeParts.push(serviceMsg);

    // 14. PEOPLE & CULTURE
    let peopleMsg = '';
    if (detectedNames.includes('Talent Architect') || detectedNames.includes('Culture Designer')) {
        peopleMsg = 'An expert in human capital strategy, with a deep focus on building elite talent pipelines and high-performance organizational cultures.';
    } else if (detectedNames.includes('Total Rewards Specialist')) {
        peopleMsg = 'Highly skilled in compensation and equity strategy, capable of designing sophisticated total rewards programs for global workforces.';
    } else if (detectedNames.includes('Learning & Development Lead')) {
        peopleMsg = 'Focused on organizational upskilling and talent development, ensuring a sustainable internal pipeline of future leaders.';
    }
    if (peopleMsg) narrativeParts.push(peopleMsg);

    // 15. FINANCE & STEWARDSHIP
    let financeMsg = '';
    if (detectedNames.includes('FP&A Strategist') || detectedNames.includes('Commercial Controller')) {
        financeMsg = 'A sophisticated financial strategist with deep expertise in fiscal planning, commercial control, and margin optimization.';
    } else if (detectedNames.includes('M&A Deal Lead')) {
        financeMsg = 'Proven expert in the capital markets, with a track record of executing complex M&A transactions and driving corporate development.';
    } else if (detectedNames.includes('Investor Relations Expert') || detectedNames.includes('Treasury & Tax Lead')) {
        financeMsg = 'Distinguished by a strong command of capital structure, investor communication, and global fiscal compliance.';
    }
    if (financeMsg) narrativeParts.push(financeMsg);

    // 16. LEGAL & INTEGRITY
    let legalMsg = '';
    if (detectedNames.includes('General Counsel') || detectedNames.includes('Litigation Specialist')) {
        legalMsg = 'A seasoned legal heavyweight with a strong command of corporate governance, strategic advisory, and complex dispute resolution.';
    } else if (detectedNames.includes('IP Strategist')) {
        legalMsg = 'Expert in the management and protection of intellectual property, with a focus on maximizing the value of innovation portfolios.';
    } else if (detectedNames.includes('Privacy & Data Ethics Lead')) {
        legalMsg = 'Distinguished by a deep commitment to data privacy and ethics, ensuring global regulatory compliance and digital trust.';
    }
    if (legalMsg) narrativeParts.push(legalMsg);

    // 17. OPERATIONS & SUPPLY CHAIN
    let opsMsg = '';
    if (detectedNames.includes('Supply Chain Orchestrator') || detectedNames.includes('Logistics Expert')) {
        opsMsg = 'A master of operational complexity, with deep expertise in orchestrating global supply chains and large-scale logistics networks.';
    } else if (detectedNames.includes('Procurement Powerhouse') || detectedNames.includes('Inventory Optimizer')) {
        opsMsg = 'Expert in strategic sourcing and inventory optimization, with a proven ability to drive cost efficiency and demand-driven supply stability.';
    } else if (detectedNames.includes('Sustainability Lead (Ops)')) {
        opsMsg = 'Focused on building sustainable and ethical supply chains, aligning operational efficiency with ESG goals.';
    }
    if (opsMsg) narrativeParts.push(opsMsg);

    // 18. MARKETING & GROWTH
    let marketingMsg = '';
    if (detectedNames.includes('Brand Architect') || detectedNames.includes('PR & Communications Lead')) {
        marketingMsg = 'A visionary brand builder and communications strategist, capable of designing high-impact identities and managing complex corporate reputations.';
    } else if (detectedNames.includes('Growth Marketer') || detectedNames.includes('Performance Marketer')) {
        marketingMsg = 'Data-driven growth engine with expertise in full-funnel optimization, performance scaling, and rapid experimentation.';
    } else if (detectedNames.includes('Content Strategist')) {
        marketingMsg = 'Skilled storyteller and creative director, with a deep focus on content-led growth and strategic brand narrative.';
    }
    if (marketingMsg) narrativeParts.push(marketingMsg);

    // 19. DATA & AI INTELLIGENCE
    let dataMsg = '';
    if (detectedNames.includes('AI Researcher') || detectedNames.includes('ML Engineer')) {
        dataMsg = 'At the frontier of the intelligence economy, with deep expertise in AI research, machine learning engineering, and advanced model deployment.';
    } else if (detectedNames.includes('Big Data Architect')) {
        dataMsg = 'Architect of large-scale data ecosystems, capable of managing massive datasets and complex distributed processing infrastructures.';
    } else if (detectedNames.includes('Data Storyteller') || detectedNames.includes('Analytics Lead')) {
        dataMsg = 'Strong analytical lead with a proven ability to translate complex data into compelling visual narratives and strategic business insights.';
    }
    if (dataMsg) narrativeParts.push(dataMsg);

    // 20. SERVICE OPERATIONS
    let serviceOpsMsg = '';
    if (detectedNames.includes('Support Architect') || detectedNames.includes('SLA Champion')) {
        serviceOpsMsg = 'A master of service delivery and support operations, with a deep focus on operational efficiency and meeting complex service level agreements.';
    } else if (detectedNames.includes('Technical Support Lead')) {
        serviceOpsMsg = 'Expert in technical troubleshooting and escalation management, capable of leading high-stakes support environments.';
    } else if (detectedNames.includes('Community Manager') || detectedNames.includes('Self-Service Expert')) {
        serviceOpsMsg = 'Distinguished by a focus on community engagement and automated support strategies, driving user trust at scale.';
    }
    if (serviceOpsMsg) narrativeParts.push(serviceOpsMsg);

    // 21. GOVERNANCE & EXECUTION
    let govMsg = '';
    if (detectedNames.includes('PMO Architect') || detectedNames.includes('Delivery Lead')) {
        govMsg = 'Demonstrates exceptional rigor in program governance and delivery, with a proven ability to architect execution frameworks and ensure predictable business outcomes.';
    } else if (detectedNames.includes('Agile Coach')) {
        govMsg = 'Champion of agile methodologies and organizational transformation, focused on driving delivery velocity and cross-functional alignment.';
    } else if (detectedNames.includes('Risk & Compliance Lead')) {
        govMsg = 'Ensures operational integrity through robust risk mitigation and compliance frameworks, balancing aggressive execution with regulatory rigor.';
    } else if (detectedNames.includes('Change Management Specialist')) {
        govMsg = 'Specializes in driving organizational change and adoption, ensuring that large-scale transformations deliver lasting business value.';
    }
    if (govMsg) narrativeParts.push(govMsg);
    
    // 22. THOUGHT LEADERSHIP & EXECUTIVE PRESENCE (Batch 22)
    let presenceMsg = '';
    if (detectedNames.includes('Board Advisor') || detectedNames.includes('Strategic Advisor')) {
        presenceMsg = 'Acts as a high-level strategic advisor with significant experience in board-level engagement and corporate governance.';
    } else if (detectedNames.includes('Public Speaker') || detectedNames.includes('Industry Influencer')) {
        presenceMsg = 'Recognized as an industry thought leader, with a proven track record of public speaking and contributing to sector-wide discourse.';
    } else if (detectedNames.includes('ESG Champion')) {
        presenceMsg = 'Demonstrates a strong commitment to sustainable leadership, with expertise in Environmental, Social, and Governance (ESG) frameworks.';
    }
    if (presenceMsg) narrativeParts.push(presenceMsg);

    // 23. STRATEGIC ALLIANCES & ECOSYSTEMS (Batch 23)
    let allianceMsg = '';
    if (detectedNames.includes('Partnership Architect') || detectedNames.includes('Joint Venture Strategist')) {
        allianceMsg = 'Expert in architecting complex strategic alliances and joint ventures to drive non-linear business growth.';
    } else if (detectedNames.includes('Ecosystem Builder')) {
        allianceMsg = 'Proven track record of building and scaling business ecosystems and platform-led growth models.';
    } else if (detectedNames.includes('M&A Integration Expert')) {
        allianceMsg = 'Specializes in high-stakes M&A integration, ensuring operational synergy and cultural alignment post-acquisition.';
    } else if (detectedNames.includes('Franchise Expansion Lead')) {
        allianceMsg = 'Highly skilled in scaling businesses through sophisticated franchise and licensed expansion models.';
    }
    if (allianceMsg) narrativeParts.push(allianceMsg);

    // 24. PRODUCT OPERATIONS & GROWTH (Batch 24)
    let prodOpsMsg = '';
    if (detectedNames.includes('Product Ops Lead')) {
        prodOpsMsg = 'Distinguished by a focus on operationalizing product teams, streamlining delivery cycles, and standardizing product processes.';
    } else if (detectedNames.includes('PLG Champion')) {
        prodOpsMsg = 'Specializes in product-led growth (PLG), leveraging the product itself as the primary driver of acquisition, expansion, and retention.';
    } else if (detectedNames.includes('Monetization Strategist')) {
        prodOpsMsg = 'Demonstrates deep expertise in product monetization, pricing architecture, and revenue-focused SKU strategy.';
    }
    if (prodOpsMsg) narrativeParts.push(prodOpsMsg);

    // 25. ENGINEERING LEADERSHIP (Batch 25)
    let engLeadMsg = '';
    if (detectedNames.includes('CTO (Visionary)')) {
        engLeadMsg = 'A strategic technology leader with a focus on R&D, long-term roadmaps, and C-suite technical advisory.';
    } else if (detectedNames.includes('VP Engineering')) {
        engLeadMsg = 'Experienced in scaling engineering organizations, nurturing technical culture, and driving operational excellence at scale.';
    } else if (detectedNames.includes('Technical Co-founder')) {
        engLeadMsg = 'Possesses the rare 0-to-1 founding experience, having led technical product births through early-stage growth and fundraising.';
    }
    if (engLeadMsg) narrativeParts.push(engLeadMsg);

    // 26. ADVANCED TECH ARCHITECTURE (Batch 26)
    let archMsg = '';
    if (detectedNames.includes('AI/ML Infrastructure Lead')) {
        archMsg = 'Specializes in the high-performance infrastructure required for modern AI/ML workloads, including GPU scaling and vector data management.';
    } else if (detectedNames.includes('Microservices Guru')) {
        archMsg = 'An expert in distributed systems, service mesh, and complex event-driven microservices architectures.';
    } else if (detectedNames.includes('Edge Computing Specialist')) {
        archMsg = 'Possesses deep expertise in edge-side computation and global, low-latency delivery strategies.';
    }
    if (archMsg) narrativeParts.push(archMsg);

    // 27. SALES & REVENUE OPERATIONS (Batch 27)
    let revOpsMsg = '';
    if (detectedNames.includes('RevOps Strategist')) {
        revOpsMsg = 'An expert in revenue operations, specializing in cross-functional data alignment and funnel optimization.';
    } else if (detectedNames.includes('GTM Enablement Lead')) {
        revOpsMsg = 'Focused on driving sales productivity through strategic training, playbooks, and methodology adoption.';
    }
    if (revOpsMsg) narrativeParts.push(revOpsMsg);

    // 28. CUSTOMER SUCCESS & RETENTION (Batch 28)
    let csMsg = '';
    if (detectedNames.includes('Churn Mitigation Lead')) {
        csMsg = 'A retention specialist focused on churn risk modeling and proactive customer health management.';
    } else if (detectedNames.includes('CSM Leader (Scaled)')) {
        csMsg = 'Experienced in leading large-scale or digital-touch Customer Success organizations to drive retention at scale.';
    }
    if (csMsg) narrativeParts.push(csMsg);

    // 29 & 30. CREATIVE, LEGAL & GOVERNANCE
    if (detectedNames.includes('Creative Director (Digital)')) {
        narrativeParts.push('A strategic creative leader capable of driving large-scale brand vision and visual storytelling.');
    }
    if (detectedNames.includes('Regulatory Affairs Director')) {
        narrativeParts.push('Expert in navigating high-stakes regulatory environments and statutory approval processes.');
    }
    if (detectedNames.includes('Export Control Specialist')) {
        narrativeParts.push('Specializes in the complex compliance frameworks of international trade and export controls (ITAR/EAR).');
    }

    // 31 & 32. SUPPLY CHAIN & HEALTHTECH
    if (detectedNames.includes('Cold Chain Logistics Lead')) {
        narrativeParts.push('Possesses specialized expertise in the management of temperature-controlled supply chains, critical for pharmaceutical integrity.');
    }
    if (detectedNames.includes('Clinical Operations Director')) {
        narrativeParts.push('Experienced in the end-to-end operational management of clinical trials and GCP-compliant scientific delivery.');
    }

    // 33-36. ESG, AI & HIGH-STAKES
    if (detectedNames.includes('ESG Reporting Lead')) {
        narrativeParts.push('Specialist in sustainability disclosure and ESG reporting frameworks (GRI/SASB).');
    }
    if (detectedNames.includes('MLOps Engineer')) {
        narrativeParts.push('Technical expert in the productionization and scaling of machine learning models.');
    }
    if (detectedNames.includes('Disaster Recovery Architect')) {
        narrativeParts.push('Critical architect of business continuity and disaster recovery strategies for high-availability systems.');
    }
    if (detectedNames.includes('Fraud Prevention Specialist')) {
        narrativeParts.push('Expert in designing and auditing anti-fraud and financial crime mitigation systems.');
    }

    // 8. RISK/CONTEXT CAVEATS
    if (detectedNames.includes('Career Gaps')) {
        narrativeParts.push('Career history includes non-linear periods, suggesting significant pivots or strategic professional pauses.');
    } else if (detectedNames.includes('Responsibility Deflation')) {
        narrativeParts.push('Some role descriptions exhibit vague outcomes, suggesting a need for deeper verification of executive ownership.');
    }

    return narrativeParts.join(' ');
}

module.exports = {
    generateExecutiveSummary
};
