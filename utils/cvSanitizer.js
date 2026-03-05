/**
 * Post-processing sanitizer for Gemini parsed CV data.
 * Fills in missing fields and standardizes the AEU structure.
 * Target format: Hiten Vora example (Detailed)
 */
function sanitizeParsedData(parsedData) {
    if (!parsedData || typeof parsedData !== 'object') return parsedData;

    // 0. Ensure basic structure exists
    if (!parsedData.aeuList) parsedData.aeuList = [];
    if (!parsedData.structured) parsedData.structured = {};

    // Remove unwanted fields as per user request (Step 286)
    delete parsedData.missingFields;
    delete parsedData.assumptionsLog;

    const aeuList = parsedData.aeuList;
    const structured = parsedData.structured;

    // Ensure pillars exist
    if (!structured.identity) structured.identity = {};
    if (!structured.work) structured.work = {};
    if (!structured.composition) structured.composition = {};

    const identity = structured.identity;
    const work = structured.work;
    const composition = structured.composition;

    if (!composition.skills) composition.skills = {};
    const skills = composition.skills;

    // Helper to find AEU by ID (Case-Insensitive)
    const findAeu = (id) => aeuList.find(a => (a.id || "").toUpperCase() === id.toUpperCase());

    // Helper to get value from AEU safely
    const getVal = (id) => {
        const aeu = findAeu(id);
        if (!aeu || !aeu.fact) return "UNKNOWN";

        // If it's "Key: Value", extract value.
        if (aeu.fact.includes(':')) {
            const parts = aeu.fact.split(':');
            return parts[1] ? parts[1].trim() : parts[0].trim();
        }
        return aeu.fact.trim();
    };

    // PROBLEM 1 — senioritySummary
    const inf001 = findAeu('AEU_INF_001');
    if (!composition.senioritySummary || composition.senioritySummary === "" || composition.senioritySummary === "Seniority level could not be determined from CV.") {
        if (inf001) {
            const fact = inf001.fact || "";
            const reason = inf001.inferenceReason || "";
            composition.senioritySummary = fact.includes(':')
                ? `${fact}${reason ? ". " + reason : ""}`
                : `Seniority Level: ${fact}${reason ? ". " + reason : ""}`;
            composition.senioritySummary = composition.senioritySummary.trim();
        }
    }

    // PROBLEM 2 — noWorkExperience and experienceSource
    const experience = Array.isArray(work.experience) ? work.experience : [];
    const projects = Array.isArray(work.projects) ? work.projects : [];

    if (work.noWorkExperience === undefined || work.noWorkExperience === null) {
        work.noWorkExperience = experience.length === 0;
    }

    if (!work.experienceSource || work.experienceSource === "") {
        const hasExp = experience.length > 0;
        const hasProj = projects.length > 0;
        if (hasExp && hasProj) work.experienceSource = "both";
        else if (hasExp) work.experienceSource = "employment";
        else if (hasProj) work.experienceSource = "projects_only";
        else work.experienceSource = "none";
    }

    // PROBLEM 5 — structured.inferred section (Ensuring population)
    if (!structured.inferred || Object.keys(structured.inferred).length === 0 || structured.inferred.seniorityLevel === "UNKNOWN") {
        let expYears = 0;
        const rawYears = getVal('AEU_INF_002');
        if (rawYears !== "UNKNOWN") {
            const match = rawYears.match(/\d+(\.\d+)?/);
            if (match) expYears = parseFloat(match[0]);
        }

        structured.inferred = {
            seniorityLevel: getVal('AEU_INF_001'),
            totalExperienceYears: expYears,
            employmentStatus: getVal('AEU_INF_003'),
            domainIndicator: getVal('AEU_INF_004'),
            highestEducationLevel: getVal('AEU_INF_005'),
            seniorityConfidence: inf001 ? (inf001.confidenceScore || 0) : 0,
            senioritySummary: composition.senioritySummary
        };
    }

    // PROBLEM 6 — languagesSpoken array (Sync with AEU list)
    if (!Array.isArray(skills.languagesSpoken) || skills.languagesSpoken.length === 0) {
        skills.languagesSpoken = aeuList
            .filter(aeu => {
                const f = (aeu.fact || "").trim();
                return f.toLowerCase().startsWith('language:');
            })
            .map(aeu => {
                const parts = aeu.fact.split(':');
                return parts[1] ? parts[1].trim() : "";
            })
            .filter(Boolean);
    }

    // Sync Technical/Soft Skills from AEU if they are empty
    if (!Array.isArray(skills.technical) || skills.technical.length === 0) {
        skills.technical = aeuList
            .filter(a => (a.fact || "").startsWith('Skill:') && !(a.fact || "").includes('Soft Skill:'))
            .map(a => a.fact.split(':')[1]?.trim())
            .filter(Boolean);
    }
    if (!Array.isArray(skills.soft) || skills.soft.length === 0) {
        skills.soft = aeuList
            .filter(a => (a.fact || "").startsWith('Soft Skill:'))
            .map(a => a.fact.split(':')[1]?.trim())
            .filter(Boolean);
    }

    // Ensure Education is detailed
    if (Array.isArray(composition.education)) {
        composition.education = composition.education.map(e => ({
            degree: e.degree || "",
            institution: e.institution || "",
            duration: e.duration || e.dates || (e.startYear && e.endYear ? `${e.startYear} - ${e.endYear}` : ""),
            startYear: e.startYear || "",
            endYear: e.endYear || ""
        }));
    }

    // Ensure Identity Keys exist
    if (!identity.fullName || identity.fullName === "") {
        const nameAeu = aeuList.find(a => (a.fact || "").startsWith('Name:'));
        if (nameAeu) identity.fullName = nameAeu.fact.split(':')[1].trim();
    }
    if (!identity.email) identity.email = getVal('AEU_IDENTITY_002') !== "UNKNOWN" ? getVal('AEU_IDENTITY_002') : "";

    return parsedData;
}

module.exports = { sanitizeParsedData };
