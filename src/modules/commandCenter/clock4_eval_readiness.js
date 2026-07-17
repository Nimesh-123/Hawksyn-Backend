// src/modules/commandCenter/clock4_eval_readiness.js
const { detected, confidence, detected_count, get_detected_contributors } = require('./helpers');

function calculateClock4(psdeArray, psdeResults) {
    const gap_periods = psdeResults?.gap_periods || [];
    const EXPLAINED_GAP_ARCHETYPES = [
        "ARCH_029_001","ARCH_029_002","ARCH_029_003","ARCH_029_004","ARCH_029_005",
        "ARCH_029_006","ARCH_029_007","ARCH_029_008","ARCH_029_009","ARCH_029_010"
    ];
    const has_explained_gap = detected_count(psdeArray, EXPLAINED_GAP_ARCHETYPES) > 0;
    
    const unexplained = gap_periods.filter(g => g.gap_months > 6 && !has_explained_gap);
    
    let D1 = 25;
    if (unexplained.length === 1 && unexplained[0].gap_months <= 12) D1 = 18;
    else if (unexplained.length === 1 && unexplained[0].gap_months > 12) D1 = 10;
    else if (unexplained.length >= 2) D1 = 5;

    if (detected(psdeArray, "ARCH_013_003")) D1 -= 5;
    D1 = Math.max(0, D1);

    const roles = psdeResults?.roles || [];
    let scope_count = 0;
    for (const role of roles) {
        let has_scope = false;
        if (role.team_size != null || role.direct_reports != null) has_scope = true;
        const aeus = role.base_aeus || [];
        if (aeus.some(a => ["team_size","budget_amount","mandate","cross_functional"].includes(a.anchor_type))) has_scope = true;
        if (has_scope) scope_count++;
    }
    const role_count = Math.max(1, roles.length);
    const scope_ratio = scope_count / role_count;

    let D2 = 25;
    if (scope_ratio < 0.25) D2 = 0;
    else if (scope_ratio < 0.50) D2 = 10;
    else if (scope_ratio < 0.75) D2 = 18;

    if (detected(psdeArray, "ARCH_003_006")) D2 -= 4;
    D2 = Math.max(0, D2);

    let outcome_count = 0;
    for (const role of roles) {
        const aeus = role.base_aeus || [];
        const has_outcome = aeus.some(a => 
            a.metric_name != null || 
            ["outcome","result","delivery"].includes(a.impact_type) || 
            ["strong","moderate"].includes(a.evidence_quality)
        );
        if (has_outcome) outcome_count++;
    }
    const outcome_ratio = outcome_count / role_count;

    let D3 = 25;
    if (outcome_ratio < 0.25) D3 = 0;
    else if (outcome_ratio < 0.50) D3 = 10;
    else if (outcome_ratio < 0.75) D3 = 18;

    if (detected(psdeArray, "ARCH_004_004")) D3 -= 5;
    
    // Check current role outcome
    const current_role = roles[0];
    if (current_role) {
        const aeus = current_role.base_aeus || [];
        const has_outcome = aeus.some(a => 
            a.metric_name != null || 
            ["outcome","result","delivery"].includes(a.impact_type) || 
            ["strong","moderate"].includes(a.evidence_quality)
        );
        if (!has_outcome) D3 -= 8;
    }
    D3 = Math.max(0, D3);

    let context_count = 0;
    for (const role of roles) {
        if (role.company_industry_tag != null || (role.company_type && role.company_type !== "unknown")) {
            context_count++;
        }
    }
    const context_ratio = context_count / role_count;

    let D4 = 25;
    if (context_ratio < 0.25) D4 = 0;
    else if (context_ratio < 0.50) D4 = 10;
    else if (context_ratio < 0.75) D4 = 18;

    if (detected(psdeArray, "ARCH_008_001")) D4 += 4;
    if (detected(psdeArray, "ARCH_018_004")) D4 -= 5;
    D4 = Math.max(0, Math.min(25, D4));

    let finalScore = D1 + D2 + D3 + D4;
    
    // Penalties
    if (detected(psdeArray, "ARCH_029_002") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_003") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_004") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_005") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_006") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_007") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_008") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_029_009") && D2 < 15 && D3 < 15) finalScore -= 10;
    if (detected(psdeArray, "ARCH_008_008")) finalScore -= 5;
    if (detected(psdeArray, "ARCH_008_003")) finalScore -= 5;

    finalScore = Math.max(0, Math.min(100, finalScore));

    let condition = "ER_FB";
    if (finalScore >= 85) condition = "ER_01";
    else if (finalScore >= 70) condition = "ER_02";
    else if (finalScore >= 50) condition = "ER_03";
    else if (finalScore >= 30) condition = "ER_04";
    else condition = "ER_05";

    const possibleContributors = [
        ...EXPLAINED_GAP_ARCHETYPES, "ARCH_013_003", "ARCH_003_006",
        "ARCH_004_004", "ARCH_008_001", "ARCH_018_004", "ARCH_008_008", "ARCH_008_003"
    ];
    const contributors = get_detected_contributors(psdeArray, possibleContributors);

    return { score: finalScore, condition_id: condition, contributors, D1, D2, D3, D4 };
}

module.exports = { calculateClock4 };
