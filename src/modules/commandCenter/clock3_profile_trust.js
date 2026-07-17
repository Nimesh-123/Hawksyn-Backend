// src/modules/commandCenter/clock3_profile_trust.js
const { detected, confidence, detected_count, get_detected_contributors } = require('./helpers');

function calculateClock3(psdeArray) {
    const TRUST_BUILDERS = ["ARCH_004_001","ARCH_004_010","ARCH_004_009","ARCH_013_001",
                            "ARCH_023_004","ARCH_027_001","ARCH_023_003","ARCH_005_001",
                            "ARCH_004_011"];

    const TRUST_DESTROYERS = ["ARCH_004_002","ARCH_004_003","ARCH_004_004","ARCH_004_005",
                              "ARCH_003_004","ARCH_003_005","ARCH_011_005","ARCH_013_002",
                              "ARCH_013_004","ARCH_013_007","ARCH_005_003","ARCH_005_005"];

    const MINOR_DESTROYERS = ["ARCH_004_005","ARCH_005_003","ARCH_005_005","ARCH_013_007"]; 
    const HEAVY_DESTROYERS = ["ARCH_003_004","ARCH_013_002","ARCH_013_004","ARCH_003_005","ARCH_011_005"]; 

    const builder_count = detected_count(psdeArray, TRUST_BUILDERS);
    const destroyer_count = detected_count(psdeArray, TRUST_DESTROYERS);
    const heavy_count = detected_count(psdeArray, HEAVY_DESTROYERS);
    const all_fired = builder_count + destroyer_count;

    if (all_fired === 0) {
        return { score: 0, condition_id: "PT_FB", contributors: [] };
    }

    let condition = "PT_03"; // Default

    const cap_at_pt05 = detected(psdeArray, "ARCH_013_002") || detected(psdeArray, "ARCH_013_004");

    if (detected(psdeArray, "ARCH_003_005")) {
        condition = "PT_06";
    } else if (detected(psdeArray, "ARCH_004_001") && detected(psdeArray, "ARCH_013_001") && heavy_count === 0 && destroyer_count === 0) {
        condition = "PT_01";
    } else if (detected(psdeArray, "ARCH_004_001") && detected_count(psdeArray, MINOR_DESTROYERS) <= 1 && heavy_count === 0) {
        condition = "PT_02";
    } else if (detected(psdeArray, "ARCH_013_004") && detected(psdeArray, "ARCH_011_005") && detected(psdeArray, "ARCH_004_003") && detected(psdeArray, "ARCH_004_002")) {
        condition = "PT_06";
    } else if (heavy_count >= 1) {
        condition = "PT_05";
    } else if ((detected(psdeArray, "ARCH_004_002") && detected(psdeArray, "ARCH_004_004")) || (destroyer_count >= 3 && builder_count === 0)) {
        condition = "PT_04";
    } else if (builder_count >= 1 && destroyer_count >= 1 && heavy_count === 0) {
        condition = "PT_03";
    } else if (destroyer_count > builder_count) {
        condition = "PT_04";
    }

    if (cap_at_pt05 && ["PT_01", "PT_02", "PT_03"].includes(condition)) {
        condition = "PT_05";
    }

    const BAND_MIN = {"PT_01":85,"PT_02":70,"PT_03":55,"PT_04":40,"PT_05":25,"PT_06":0};
    const BAND_MAX = {"PT_01":100,"PT_02":84,"PT_03":69,"PT_04":54,"PT_05":39,"PT_06":24};
    
    let score = BAND_MIN[condition] || 0;
    let boosters = 0;

    for (const arch of TRUST_BUILDERS) {
        const conf = confidence(psdeArray, arch);
        if (conf >= 0.85) boosters += 3;
        else if (conf >= 0.75) boosters += 2;
        else if (conf > 0) boosters += 1;
    }

    for (const arch of TRUST_DESTROYERS) {
        if (detected(psdeArray, arch)) boosters -= 1;
    }

    boosters = Math.max(0, boosters);
    score = Math.max(BAND_MIN[condition] || 0, Math.min(BAND_MAX[condition] || 100, score + boosters));

    const possibleContributors = [...TRUST_BUILDERS, ...TRUST_DESTROYERS];
    const contributors = get_detected_contributors(psdeArray, possibleContributors);

    return { score, condition_id: condition, contributors };
}

module.exports = { calculateClock3 };
