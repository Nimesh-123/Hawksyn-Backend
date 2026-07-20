/**
 * Execution & Transformation Detectors
 */

function detectTransformationSpecialist(cv, stats) {
    const transformationAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('transform') || 
        (a.raw_text || '').toLowerCase().includes('redesign') ||
        (a.raw_text || '').toLowerCase().includes('architected')
    );
    
    const isDetected = transformationAeus.length >= 3;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Strong track record in leading organizational or digital transformation programs.' : 'Limited specific transformation experience detected.',
        anchors: isDetected ? [
            { type: 'TRANSFORMATION_AEU_COUNT', value: transformationAeus.length },
            { type: 'TRANSFORMATION_AEUS', value: transformationAeus.map(a => a.aue_id) }
        ] : []
    };
}

function detectStrategicExecution(cv, stats) {
    const executionAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('market entry') || 
        (a.raw_text || '').toLowerCase().includes('go-to-market') ||
        (a.raw_text || '').toLowerCase().includes('scaled') ||
        (a.raw_text || '').toLowerCase().includes('merger')
    );
    
    const isDetected = executionAeus.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to execute high-level mandates including market entry and scaling.' : 'Limited evidence of high-stakes high-level execution.',
        anchors: isDetected ? [
            { type: 'STRATEGIC_EXECUTION_AEU_COUNT', value: executionAeus.length },
            { type: 'STRATEGIC_EXECUTION_AEUS', value: executionAeus.map(a => a.aue_id) }
        ] : []
    };
}

function detectMarqueeProjectAssociation(cv, stats) {
    const marqueeAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('fortune 500') || 
        (a.raw_text || '').toLowerCase().includes('unicorn') ||
        (a.raw_text || '').toLowerCase().includes('top-3') ||
        (a.raw_text || '').toLowerCase().includes('flagship')
    );
    
    const isDetected = marqueeAeus.length >= 1;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experience working on high-profile, high-visibility flagship projects.' : 'No explicit mention of marquee projects found.',
        anchors: isDetected ? [
            { type: 'MARQUEE_PROJECT_AEU_COUNT', value: marqueeAeus.length }
        ] : []
    };
}

function detectPrestigeClimber(cv, stats) {
    const tier1Roles = (cv.roles || []).filter(r => (r.role_flags || []).includes('tier1_employer'));
    const isDetected = tier1Roles.length >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `Consistent movement between ${tier1Roles.length} prestige employers.` : 'Limited history with tier-1 marquee employers.',
        anchors: isDetected ? [
            { type: 'TIER1_EMPLOYER_COUNT', value: tier1Roles.length }
        ] : []
    };
}

function detectTurnaroundSpecialist(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.raw_text || '').toLowerCase().includes('turnaround') || 
        (a.raw_text || '').toLowerCase().includes('revitalis') ||
        (a.raw_text || '').toLowerCase().includes('restructur')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in reversing negative business trends or restructuring underperforming units.' : 'No explicit turnaround experience detected.',
        anchors: []
    };
}

function detectScaleUpExpert(cv, stats) {
    const scaleAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('scale-up') || 
        (a.raw_text || '').toLowerCase().includes('zero to one') ||
        (a.metrics?.delta && parseInt(a.metrics.delta) > 100)
    );
    const isDetected = scaleAeus.length >= 1;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven ability to scale operations or products during rapid growth phases.' : 'No explicit scale-up signals found.',
        anchors: []
    };
}

function detectGreenfieldProjectLead(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.raw_text || '').toLowerCase().includes('greenfield') || 
        (a.raw_text || '').toLowerCase().includes('set up from scratch')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experience leading "greenfield" initiatives or setting up new business units from scratch.' : 'No greenfield project signals found.',
        anchors: []
    };
}

function detectMAIntegrationSpecialist(cv, stats) {
    const maAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('m&a') || 
        (a.raw_text || '').toLowerCase().includes('acquisition') ||
        (a.raw_text || '').toLowerCase().includes('due diligence')
    );
    const isDetected = maAeus.length >= 1;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Found evidence of Mergers & Acquisitions (M&A) lifecycle involvement.' : 'No M&A signals found.',
        anchors: []
    };
}

function detectPostMergerNavigator(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.raw_text || '').toLowerCase().includes('post-merger') || 
        (a.raw_text || '').toLowerCase().includes('pmi') ||
        (a.raw_text || '').toLowerCase().includes('synergy achievement')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in post-merger integration (PMI) and realizing acquisition effective collaboration.' : 'No explicit PMI experience detected.',
        anchors: []
    };
}

function detectCostOptimisationLead(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.raw_text || '').toLowerCase().includes('cost optimis') || 
        (a.raw_text || '').toLowerCase().includes('saving') ||
        (a.metrics?.metric_name || '').toLowerCase().includes('opex')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record of leading significant cost optimisation or opex reduction.' : 'Limited evidence of cost-focused execution.',
        anchors: []
    };
}

function detectDigitalTransformationArchitect(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.raw_text || '').toLowerCase().includes('digital transformation') && 
        (a.decision_level === 'owned')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Successfully architected and led large-scale digital transformation roadmaps.' : 'No high-ownership digital transformation signals.',
        anchors: []
    };
}

function detectOperatingModelSpecialist(cv, stats) {
    const isDetected = (cv.roles || []).flatMap(r => r.base_aeus || []).some(a => 
        (a.raw_text || '').toLowerCase().includes('operating model') || 
        (a.raw_text || '').toLowerCase().includes('org design')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experience in designing or redesigning complex organizational operating models.' : 'No explicit operating model work detected.',
        anchors: []
    };
}

const TIER_1_EMPLOYERS = ['ibm', 'google', 'microsoft', 'amazon', 'facebook', 'meta', 'apple', 'tata', 'netflix', 'mckinsey', 'bain', 'bcg', 'goldman sachs', 'morgan stanley', 'jpmorgan', 'jp morgan'];

function detectTier1Career(cv, stats) {
    const tier1Roles = (cv.roles || []).filter(r => {
        const companyName = (r.company || r.role_metadata?.company || '').toLowerCase();
        const llmFlag = (r.role_flags || []).includes('tier1_employer') || r.domain_metadata?.tier1_employer === true;
        const stringMatch = TIER_1_EMPLOYERS.some(tier1 => companyName.includes(tier1));
        return stringMatch || llmFlag;
    });
    const isDetected = tier1Roles.length >= 1;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Found history with Tier-1 / Marquee employers.' : 'No significant Tier-1 employer signals found.',
        anchors: isDetected ? [{ type: 'TIER1_EMPLOYER_COUNT', value: tier1Roles.length }] : []
    };
}

module.exports = {
    detectTransformationSpecialist,
    detectStrategicExecution,
    detectMarqueeProjectAssociation,
    detectPrestigeClimber,
    detectTurnaroundSpecialist,
    detectScaleUpExpert,
    detectGreenfieldProjectLead,
    detectMAIntegrationSpecialist,
    detectPostMergerNavigator,
    detectCostOptimisationLead,
    detectDigitalTransformationArchitect,
    detectOperatingModelSpecialist,
    detectTier1Career
};
