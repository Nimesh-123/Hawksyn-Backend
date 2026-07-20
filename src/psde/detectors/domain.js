/**
 * Domain Depth & Industry Exposure Detectors
 */

function detectDomainDepth(cv, stats) {
    const isDetected = (stats.domain_depth_score || 0) >= 10;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'High density of domain-specific terminology indicates deep technical/functional expertise.' : 'Domain terminology density is standard.',
        anchors: isDetected ? [
            { type: 'DOMAIN_TERM_COUNT', value: stats.domain_depth_score }
        ] : []
    };
}

function detectCrossIndustryExposure(cv, stats) {
    const companies = (cv.roles || []).map(r => (r.role_metadata?.company || '').toLowerCase());
    const sectors = new Set();
    
    companies.forEach(c => {
        if (c.includes('bank') || c.includes('capital')) sectors.add('banking');
        if (c.includes('pharma') || c.includes('drug')) sectors.add('pharma');
        if (c.includes('consulting') || c.includes('bcg') || c.includes('mckinsey')) sectors.add('consulting');
        if (c.includes('tech') || c.includes('software') || c.includes('microsoft') || c.includes('google')) sectors.add('tech');
    });

    const isDetected = sectors.size >= 2;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `Professional history spans ${sectors.size} distinct industry sectors.` : 'Career history is focused within a single industry.',
        anchors: isDetected ? [
            { type: 'SECTOR_COUNT', value: sectors.size },
            { type: 'DETECTED_SECTORS', value: Array.from(sectors) }
        ] : []
    };
}

function detectHighDomainFluency(cv, stats) {
    const isDetected = (stats.domain_depth_score || 0) >= 5;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.75 : 0,
        reasoning: isDetected ? 'Candidate uses advanced, sector-specific language across multiple roles.' : 'Sector-specific language use is standard.',
        anchors: isDetected ? [
            { type: 'DOMAIN_DEPTH_SCORE', value: stats.domain_depth_score }
        ] : []
    };
}

function detectRegulatorySpecialist(cv, stats) {
    const regAeus = (cv.roles || []).flatMap(r => r.base_aeus || []).filter(a => 
        (a.raw_text || '').toLowerCase().includes('regulation') || 
        (a.raw_text || '').toLowerCase().includes('compliance') ||
        (a.raw_text || '').toLowerCase().includes('rbi') ||
        (a.raw_text || '').toLowerCase().includes('sebi')
    );
    const isDetected = regAeus.length >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in working through complex regulatory environments and compliance frameworks.' : 'Limited explicit regulatory experience detected.',
        anchors: [{ type: 'REGULATORY_AEU_COUNT', value: regAeus.length }]
    };
}

function detectNicheTechnicalDepth(cv, stats) {
    const isDetected = (cv.skills?.skills || []).some(s => 
        (s.skill_name || '').toLowerCase().includes('patent') || 
        (s.skill_name || '').toLowerCase().includes('research paper') ||
        (s.skill_name || '').toLowerCase().includes('algorithm')
    );
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Found evidence of deep, niche technical expertise or intellectual property contribution.' : 'No niche technical depth signals found.',
        anchors: []
    };
}

function detectCrossFunctionalBridge(cv, stats) {
    const isDetected = stats.role_count >= 3 && (cv.skills?.skills || []).some(s => s.category === 'technical') && (cv.skills?.skills || []).some(s => s.category === 'functional');
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Possesses a rare blend of technical depth and functional/business strategy experience.' : 'Skill profile is primarily focused on a single category.',
        anchors: []
    };
}

function detectStrategyToExecutionLink(cv, stats) {
    const isDetected = (cv.roles || []).some(r => r.base_aeus?.some(a => (a.raw_text || '').toLowerCase().includes('strategy'))) && 
                       (cv.roles || []).some(r => r.base_aeus?.some(a => (a.raw_text || '').toLowerCase().includes('implement') || (a.raw_text || '').toLowerCase().includes('executed')));
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated ability to both formulate high-level strategy and lead its operational implementation.' : 'Limited evidence of end-to-end strategy-to-execution linkage.',
        anchors: []
    };
}

function detectMultiDomainExpert(cv, stats) {
    const sectors = new Set((cv.roles || []).flatMap(r => r.role_flags || []).filter(f => f.startsWith('sector_')));
    const isDetected = sectors.size >= 3;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `Recognized expert with deep multi-domain experience across ${sectors.size} different industry sectors.` : 'Career history is focused within 1-2 sectors.',
        anchors: [{ type: 'SECTOR_COUNT', value: sectors.size }]
    };
}

function detectGlobalPerspective(cv, stats) {
    const locations = new Set((cv.roles || []).map(r => r.role_metadata?.location).filter(l => l));
    const countries = new Set();
    locations.forEach(l => {
        if (l.toLowerCase().includes('india')) countries.add('india');
        if (l.toLowerCase().includes('usa') || l.toLowerCase().includes('us')) countries.add('usa');
        if (l.toLowerCase().includes('uk') || l.toLowerCase().includes('london')) countries.add('uk');
        if (l.toLowerCase().includes('singapore')) countries.add('singapore');
        if (l.toLowerCase().includes('uae') || l.toLowerCase().includes('dubai')) countries.add('uae');
    });

    const isDetected = countries.size >= 2;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? `Professional history spans ${countries.size} countries, indicating a strong global perspective.` : 'Professional history is primarily focused within a single country.',
        anchors: isDetected ? [{ type: 'COUNTRY_COUNT', value: countries.size }] : []
    };
}

function detectNicheDomainSpecialist(cv, stats) {
    const roles = cv.roles || [];
    if (roles.length < 3) return { detected: false, confidence: 0 };

    const firstSector = (roles[0].role_metadata?.company || '').toLowerCase();
    let sectorMatchCount = 0;
    
    roles.forEach(r => {
        const comp = (r.role_metadata?.company || '').toLowerCase();
        if (comp.includes('bank') && firstSector.includes('bank')) sectorMatchCount++;
        else if (comp.includes('pharma') && firstSector.includes('pharma')) sectorMatchCount++;
        else if (comp.includes('consult') && firstSector.includes('consult')) sectorMatchCount++;
    });

    const isDetected = (sectorMatchCount / roles.length) >= 0.7;
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Candidate has spent over 70% of their career specializing in a single niche domain.' : 'Career history shows sector diversification.',
        anchors: []
    };
}

module.exports = {
    detectDomainDepth,
    detectCrossIndustryExposure,
    detectHighDomainFluency,
    detectRegulatorySpecialist,
    detectNicheTechnicalDepth,
    detectCrossFunctionalBridge,
    detectStrategyToExecutionLink,
    detectMultiDomainExpert,
    detectGlobalPerspective,
    detectNicheDomainSpecialist
};
