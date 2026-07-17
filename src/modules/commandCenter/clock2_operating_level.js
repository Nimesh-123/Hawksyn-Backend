// src/modules/commandCenter/clock2_operating_level.js
const { detected, confidence, detected_count, get_detected_contributors } = require('./helpers');

/**
 * Calculates the score, condition, gap_state and contributors for Clock 2 (Operating Level)
 */
function calculateClock2(psdeArray, psdeProfile) {
    const seniority = psdeProfile?.seniority_rank || 0;
    const team_size = psdeProfile?.team_size_evidence;
    const direct_reports = psdeProfile?.direct_reports_evidence;
    const has_budget = psdeProfile?.budget_evidence || false;
    const has_pl = psdeProfile?.pl_evidence || false;

    let base_level = 2; // Default

    // L6 — Executive
    if (detected(psdeArray, "ARCH_016_004") || (has_pl && seniority >= 5)) {
        base_level = 6;
    }
    // L5 — Senior Leadership / VP
    else if ((detected(psdeArray, "ARCH_007_003") && (team_size || 0) >= 30) ||
             (seniority >= 5 && detected(psdeArray, "ARCH_001_011")) ||
             (detected(psdeArray, "ARCH_005_013") && seniority >= 4 && detected(psdeArray, "ARCH_021_002"))) {
        base_level = 5;
    }
    // L4 — Director / Senior Manager
    else if ((detected(psdeArray, "ARCH_021_002") && detected(psdeArray, "ARCH_003_007") && (team_size || 0) >= 8) ||
             (detected(psdeArray, "ARCH_003_013") && detected(psdeArray, "ARCH_016_001")) ||
             (detected(psdeArray, "ARCH_003_011") && detected(psdeArray, "ARCH_021_002"))) {
        base_level = 4;
    }
    // L3 — Manager / Team Lead
    else if ((detected(psdeArray, "ARCH_016_001") && (team_size || 0) >= 2) ||
             (detected(psdeArray, "ARCH_003_002") && (team_size != null || direct_reports != null)) ||
             detected(psdeArray, "ARCH_010_003") ||
             detected(psdeArray, "ARCH_003_012")) {
        base_level = 3;
    }
    // L2 — Senior Individual Contributor
    else if (detected(psdeArray, "ARCH_010_002") ||
             (detected(psdeArray, "ARCH_003_012") && team_size == null && direct_reports == null)) {
        base_level = 2;
    }
    // L1 — Individual Contributor
    else if (detected(psdeArray, "ARCH_010_001") ||
             detected(psdeArray, "ARCH_003_001") ||
             detected_count(psdeArray, ["ARCH_016_001","ARCH_003_002","ARCH_010_003","ARCH_003_012"]) === 0) {
        base_level = 1;
    }

    // Penalties
    let penalty = 0;
    if (detected(psdeArray, "ARCH_003_005")) penalty += 2;
    if (detected(psdeArray, "ARCH_007_002")) penalty += 1;
    if (detected(psdeArray, "ARCH_003_004")) penalty += 1;
    if (detected(psdeArray, "ARCH_007_007")) penalty += 1;
    if (detected(psdeArray, "ARCH_010_004")) penalty += 1;

    let assigned_level = Math.max(1, Math.min(6, base_level - penalty));

    // Score
    const LEVEL_SCORE_BASE = {1: 10, 2: 25, 3: 45, 4: 65, 5: 82, 6: 95};
    let score = LEVEL_SCORE_BASE[assigned_level];

    const pos_confidence_signals = ["ARCH_016_001","ARCH_003_002","ARCH_021_002","ARCH_003_013","ARCH_007_003","ARCH_010_003"];
    let strong_count = 0;
    for (const a of pos_confidence_signals) {
        if (confidence(psdeArray, a) >= 0.80) strong_count++;
    }
    if (strong_count >= 3) {
        score = Math.min(100, score + 5);
    } else if (strong_count === 0 && penalty > 0) {
        score = Math.max(0, score - 5);
    }

    // Gap State
    const title_implied_level = psdeProfile?.headline_seniority_rank || 0;
    const context_flag = detected(psdeArray, "ARCH_007_006");
    let gap_state = "ALIGNED";

    if (title_implied_level === 0) {
        gap_state = "UNKNOWN";
    } else if (assigned_level > title_implied_level || detected_count(psdeArray, ["ARCH_007_003", "ARCH_003_012", "ARCH_003_013"]) > 0) {
        gap_state = "UNDER-TITLED";
    } else if (assigned_level < title_implied_level || detected_count(psdeArray, ["ARCH_007_002", "ARCH_003_004", "ARCH_003_005", "ARCH_007_007"]) > 0) {
        gap_state = "OVER-TITLED";
    } else if (context_flag) {
        gap_state = "CONTEXT";
    }

    const LEVEL_TO_CONDITION = {1:"OL_L1",2:"OL_L2",3:"OL_L3",4:"OL_L4",5:"OL_L5",6:"OL_L6"};
    const condition = LEVEL_TO_CONDITION[assigned_level] || "OL_FB";

    // Contributors
    const possibleContributors = [
        "ARCH_016_004","ARCH_005_013","ARCH_007_003","ARCH_007_001",
        "ARCH_003_013","ARCH_021_002","ARCH_003_007","ARCH_016_001",
        "ARCH_003_002","ARCH_010_003","ARCH_003_012","ARCH_003_011",
        "ARCH_010_002","ARCH_010_001","ARCH_003_001","ARCH_007_002",
        "ARCH_003_004","ARCH_003_005","ARCH_007_007","ARCH_010_004","ARCH_007_006"
    ];
    const contributors = get_detected_contributors(psdeArray, possibleContributors);

    return {
        level: assigned_level,
        score: score,
        condition_id: condition,
        gap_state: gap_state,
        contributors: contributors
    };
}

module.exports = { calculateClock2 };
