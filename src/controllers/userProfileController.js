const { db } = require('../models/index.model.js');
const { UserProfile } = db;

/**
 * --- INTERNAL HELPERS ---
 */

// Purane data aur naye user updates ko merge karne ke liye
const deepMerge = (target, source) => {
    if (!source || !target) return target;
    for (const key in source) {
        const sourceVal = source[key];
        const targetVal = target[key];

        if (sourceVal instanceof Object && !Array.isArray(sourceVal)) {
            if (!(key in target)) target[key] = {};
            deepMerge(target[key], sourceVal);
        } else {
            // Empty arrays ko ignore karte hain existing data bachane ke liye
            if (Array.isArray(sourceVal) && sourceVal.length === 0 && Array.isArray(targetVal) && targetVal.length > 0) continue;
            target[key] = sourceVal;
        }
    }
    return target;
};

// Original CV aur user-edited data ke beech ke changes track karne ke liye
const compareFields = (orig, edited, builtOverrideMap, path = '') => {
    if (!orig || !edited) return;
    for (const key in edited) {
        const currentPath = path ? `${path}.${key}` : key;
        const origVal = orig[key];
        const editVal = edited[key];

        if (typeof editVal === 'object' && editVal !== null && !Array.isArray(editVal)) {
            compareFields(origVal || {}, editVal, builtOverrideMap, currentPath);
        } else {
            const isDifferent = Array.isArray(editVal)
                ? JSON.stringify(origVal) !== JSON.stringify(editVal)
                : origVal !== editVal;

            if (isDifferent) {
                builtOverrideMap.fieldsChanged.push(currentPath);
                builtOverrideMap.changeDetails.push({
                    field: currentPath,
                    originalValue: origVal,
                    newValue: editVal,
                    changedAt: new Date()
                });
            }
        }
    }
};

/**
 * --- EXPORTED CONTROLLERS ---
 */

exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const profile = await UserProfile.findOne({ userId });

        if (!profile) return res.status(404).json({ success: false, message: "Please upload your CV first" });

        const p = profile.confirmedProfile || profile.originalParsedData.structured;
        const aeuList = profile.originalParsedData.aeuList || [];

        // Clean User Facing Response (Identical to Original)
        const cleanResponse = {
            isConfirmed: profile.isConfirmed,
            confirmedAt: profile.confirmedAt,
            personalInfo: {
                fullName: p.identity?.fullName || "",
                email: p.identity?.email || "",
                phone: p.identity?.phone || "",
                location: p.identity?.location || "",
                currentRoleTitle: p.identity?.currentRoleTitle || "",
                linkedinUrl: p.identity?.linkedinUrl || "",
                githubUrl: p.identity?.githubUrl || ""
            },
            experience: p.work?.experience || [],
            projects: p.work?.projects || [],
            skills: {
                technical: p.composition?.skills?.technical || [],
                soft: p.composition?.skills?.soft || [],
                languagesSpoken: p.composition?.skills?.languagesSpoken || []
            },
            education: p.composition?.education || [],
            certifications: p.composition?.certifications || [],
            seniority: {
                level: p.inferred?.seniorityLevel || "",
                totalExperienceYears: p.inferred?.totalExperienceYears || 0,
                summary: p.inferred?.senioritySummary || ""
            },
            employment: {
                status: p.inferred?.employmentStatus || "",
                domain: p.inferred?.domainIndicator || "",
                highestEducation: p.inferred?.highestEducationLevel || ""
            },
            assumptions: aeuList
                .filter(aeu => aeu.isInferred === true)
                .map(aeu => ({
                    field: aeu.fact.split(':')[0].trim(),
                    assumedValue: aeu.fact.split(':')[1].trim(),
                    label: "Assumed from CV",
                    reason: aeu.inferenceReason || ""
                }))
        };

        return res.status(200).json({ success: true, data: cleanResponse });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const { profile, assumptionsReview } = req.body;
        const userProfile = await UserProfile.findOne({ userId: req.user.id });

        if (!userProfile) return res.status(404).json({ success: false, message: "User profile not found" });

        const existingProfile = userProfile.confirmedProfile || userProfile.originalParsedData.structured;
        const mergedProfile = JSON.parse(JSON.stringify(existingProfile));
        deepMerge(mergedProfile, profile);

        const builtOverrideMap = {
            fieldsChanged: [],
            assumptionsConfirmed: [],
            assumptionsCorrected: [],
            changeDetails: []
        };

        compareFields(userProfile.originalParsedData.structured, mergedProfile, builtOverrideMap);

        if (Array.isArray(assumptionsReview)) {
            assumptionsReview.forEach(r => {
                if (r.action === "CONFIRMED") builtOverrideMap.assumptionsConfirmed.push(r.aeuId);
                else if (r.action === "CORRECTED") builtOverrideMap.assumptionsCorrected.push(r.aeuId);
            });
        }

        userProfile.confirmedProfile = mergedProfile;
        userProfile.overrideMap = builtOverrideMap;
        userProfile.isConfirmed = true;
        userProfile.confirmedAt = new Date();

        userProfile.markModified('confirmedProfile');
        userProfile.markModified('overrideMap');
        await userProfile.save();

        return res.status(200).json({
            success: true,
            data: { isConfirmed: true, confirmedAt: userProfile.confirmedAt, message: "Profile confirmed successfully." }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
