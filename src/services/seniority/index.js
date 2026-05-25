/**
 * Seniority Intelligence Engine
 * Maps job titles to numeric hierarchy and calculates growth trajectories
 */

const TITLE_HIERARCHY = {
    'intern': 0,
    'trainee': 0,
    'analyst': 1,
    'engineer': 1,
    'associate': 2,
    'senior analyst': 2,
    'consultant': 3,
    'senior engineer': 3,
    'senior associate': 3,
    'lead': 4,
    'senior consultant': 4,
    'assistant manager': 4,
    'manager': 5,
    'project leader': 6,
    'case team leader': 6,
    'senior manager': 6,
    'associate director': 6,
    'director': 7,
    'principal': 7,
    'associate principal': 7,
    'vice president': 8,
    'vp': 8,
    'avp': 8,
    'senior vice president': 9,
    'svp': 9,
    'executive director': 9,
    'cxo': 10,
    'chief': 10,
    'founder': 10,
    'head': 8,
    'partner': 10
};

function normalizeTitle(title) {
    if (!title) return '';
    let t = title.toLowerCase()
        .replace(/assistant vice president/g, 'avp')
        .replace(/senior vice president/g, 'svp')
        .replace(/sr\./g, 'senior')
        .replace(/sr /g, 'senior ')
        .trim();
    return t;
}

function calculateSeniorityScore(title) {
    const normalized = normalizeTitle(title);
    
    // Exact match search
    for (const [key, score] of Object.entries(TITLE_HIERARCHY)) {
        if (normalized === key) return score;
    }
    
    // Keyword containment search (ordered by priority - highest first)
    const priorityOrder = ['cxo', 'chief', 'founder', 'partner', 'svp', 'vp', 'avp', 'director', 'principal', 'project leader', 'manager', 'lead', 'consultant', 'associate', 'analyst', 'intern'];
    for (const key of priorityOrder) {
        if (normalized.includes(key)) return TITLE_HIERARCHY[key];
    }

    return 1; // Default fallback to Analyst level
}

function buildSenioritySequence(roles) {
    // Expects roles to be in chronological order (oldest first) as per repairChronology output
    return roles.map(r => calculateSeniorityScore(r.role_metadata?.title));
}

function detectPromotionTrajectory(sequence) {
    if (sequence.length < 2) {
        return { growth_velocity: 0, avg_seniority_delta: 0, max_seniority_jump: 0 };
    }

    const deltas = [];
    for (let i = 1; i < sequence.length; i++) {
        deltas.push(sequence[i] - sequence[i - 1]);
    }

    const totalGrowth = sequence[sequence.length - 1] - sequence[0];
    const growthVelocity = parseFloat((totalGrowth / sequence.length).toFixed(2));
    const avgDelta = parseFloat((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2));
    const maxJump = Math.max(...deltas, 0);

    return {
        growth_velocity: growthVelocity,
        avg_seniority_delta: avgDelta,
        max_seniority_jump: maxJump
    };
}

module.exports = {
    normalizeTitle,
    calculateSeniorityScore,
    buildSenioritySequence,
    detectPromotionTrajectory
};
