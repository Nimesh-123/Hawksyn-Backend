/**
 * Hardened Consolidation: Boomerang & Seniority
 */

function detectBoomerangPattern(roles) {
    const employerHistory = {};
    const boomerangs = [];

    roles.forEach((role, idx) => {
        const company = role.role_metadata?.company_canonical;
        if (!company) return;

        if (employerHistory[company]) {
            // Check if there was another employer in between
            const lastIdx = employerHistory[company].lastIdx;
            if (idx - lastIdx > 1) {
                boomerangs.push({
                    company,
                    gap_roles: idx - lastIdx - 1
                });
            }
        }
        employerHistory[company] = { lastIdx: idx };
    });

    return boomerangs.map(b => ({
        i_aeu_id: 'IAEU_BOOMERANG',
        type: 'behavior',
        category: 'boomerang_pattern',
        confidence: 'high',
        reason: `Returned to ${b.company} after ${b.gap_roles} roles elsewhere.`,
        logic: 'Detected exit and subsequent return to same parent company.',
        claim: `Demonstrates high institutional value with a return to ${b.company}.`
    }));
}

function calculateConsolidationStats(roles) {
    let leadershipSignals = 0;
    let metricsCount = 0;
    let domainTerms = new Set();
    let maxTeamSize = 0;

    roles.forEach(role => {
        (role.base_aeus || []).forEach(aeu => {
            if (aeu.evidence_type === 'leadership') leadershipSignals++;
            if (aeu.metrics?.value) metricsCount++;
            (aeu.domain_metadata?.domain_terms_found || []).forEach(t => domainTerms.add(t));
            if (aeu.team_context) {
                const teamSize = parseInt(aeu.team_context.team_size) || 0;
                const directReports = parseInt(aeu.team_context.direct_reports) || 0;
                maxTeamSize = Math.max(maxTeamSize, teamSize, directReports);
            }
        });
    });

    return {
        leadership_signal_count: leadershipSignals,
        metrics_density: roles.length > 0 ? parseFloat((metricsCount / roles.length).toFixed(2)) : 0,
        domain_depth_score: domainTerms.size,
        max_team_size: maxTeamSize
    };
}

module.exports = { detectBoomerangPattern, calculateConsolidationStats };
