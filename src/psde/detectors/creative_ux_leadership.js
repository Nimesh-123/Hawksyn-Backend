/**
 * Creative & UX Leadership Detectors (Batch 29)
 */

function detectDesignOpsLead(cv, stats) {
    const keywords = [
        'design ops', 'design operations', 'scaling design teams', 'design toolchain',
        'figma management', 'design system governance', 'creative workflow',
        'design resource management'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in the operational scaling of design organizations, including toolchain management and design system governance.' : 'No significant Design Ops signals detected.',
        anchors: []
    };
}

function detectCreativeDirectorDigital(cv, stats) {
    const keywords = [
        'creative director', 'brand vision', 'visual storytelling', 'cross-medium creative',
        'creative strategy', 'art direction', 'multimedia leadership', 'brand identity architect'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record of leading large-scale brand vision and creative strategy across digital and traditional mediums.' : 'Limited evidence of creative leadership.',
        anchors: []
    };
}

function detectUserResearchSpecialist(cv, stats) {
    const keywords = [
        'user research', 'usability testing', 'qualitative research', 'quantitative user data',
        'persona modeling', 'user labs', 'ethnographic research', 'ux research leader'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in deep user research methodologies, persona development, and leading data-backed product design.' : 'No significant user research signals detected.',
        anchors: []
    };
}

function detectServiceDesignArchitect(cv, stats) {
    const keywords = [
        'service design', 'customer journey map', 'omni-channel strategy', 'blueprint design',
        'multi-touchpoint journey', 'end-to-end service experience', 'service transformation'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in architecting complex, multi-touchpoint service experiences across digital and physical domains.' : 'No significant service design signals found.',
        anchors: []
    };
}

function detectInclusiveDesignChampion(cv, stats) {
    const keywords = [
        'inclusive design', 'accessibility', 'wcag', 'a11y', 'universal design',
        'disability inclusion', 'accessible ux', 'compliance design'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated mastery in accessibility standards (WCAG) and the creation of inclusive, universally accessible digital products.' : 'Limited evidence of inclusive design specialization.',
        anchors: []
    };
}

module.exports = {
    detectDesignOpsLead,
    detectCreativeDirectorDigital,
    detectUserResearchSpecialist,
    detectServiceDesignArchitect,
    detectInclusiveDesignChampion
};
