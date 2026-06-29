const { db } = require('../../models/index.model.js');
const clockService = require('../../services/clockService.js');
const { createAuditLog } = require('../../../utils/auditLogger.js');
const { UserProfile } = db;




const deepMerge = (target, source) => {
    if (!source || !target) return target;
    for (const key in source) {
        const sourceVal = source[key];
        const targetVal = target[key];

        if (sourceVal instanceof Object && !Array.isArray(sourceVal)) {
            if (!(key in target)) target[key] = {};
            deepMerge(target[key], sourceVal);
        } else {

            if (Array.isArray(sourceVal) && sourceVal.length === 0 && Array.isArray(targetVal) && targetVal.length > 0) continue;
            target[key] = sourceVal;
        }
    }
    return target;
};


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



exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [profile, user] = await Promise.all([
            UserProfile.findOne({ userId }),
            db.User.findById(userId)
        ]);

        const cvDoc = (profile && profile.lastCvUploadId) ? await db.DocumentUploads.findById(profile.lastCvUploadId) : null;

        if (!profile) return res.status(404).json({ success: false, message: "Please upload your CV first" });

        const p = profile.confirmedProfile || profile.originalParsedData.structured;
        const aeuList = profile.originalParsedData.aeuList || [];

        let mappedExperience = p.work?.experience || [];
        if (mappedExperience.length === 0 && Array.isArray(profile.originalParsedData?.roles)) {
            mappedExperience = profile.originalParsedData.roles.map(r => ({
                title: r.role_metadata?.title || 'Unknown Role',
                company: r.role_metadata?.company || 'Unknown Company',
                duration: `${r.role_metadata?.start_date || ''} - ${r.role_metadata?.end_date || 'Present'}`,
                description: (r.base_aeus || []).map(ae => ae.raw_text || '').join('\n')
            }));
        }

        // Clean User Facing Response (Identical to Original)
        const cleanResponse = {
            isConfirmed: profile.isConfirmed,
            confirmedAt: profile.confirmedAt,
            mPinSet: user ? user.mPinSet : false,
            
            // --- NEW: Account info for "My Account" screen ---
            authStatus: {
                isEmailVerified: user ? user.isEmailVerified : false,
                isPhoneVerified: user ? user.isPhoneVerified : false,
                whatsappNumber: user ? user.whatsappNumber : "",
                email: user ? user.email : "",
                profilePhoto: user ? ((user.profilePhoto || user.avatar)?.includes('amazonaws.com') ? `${process.env.API_URL || 'http://localhost:3002/api/v1'}/user/profile-photo/${user._id}` : (user.profilePhoto || user.avatar)) : null
            },
            cvFile: cvDoc ? {
                fileName: cvDoc.file_name_original || cvDoc.fileName,
                fileSizeBytes: cvDoc.file_size_bytes,
                cvUrl: cvDoc.cvUrl || profile.cvUrl,
                uploadedAt: cvDoc.uploadedAt
            } : null,
            // -------------------------------------------------

            personalInfo: {
                fullName: p.identity?.fullName || p.identity?.name || "",
                email: p.identity?.email || "",
                phone: p.identity?.phone || "",
                location: typeof p.identity?.location === 'object' ? [p.identity.location.primary_city, p.identity.location.state].filter(Boolean).join(', ') : (p.identity?.location || ""),
                currentRoleTitle: p.identity?.currentRoleTitle || p.identity?.headline_title || "",
                linkedinUrl: p.identity?.linkedinUrl || p.identity?.social_links?.linkedin || "",
                githubUrl: p.identity?.githubUrl || p.identity?.social_links?.github || ""
            },
            experience: mappedExperience,
            projects: p.work?.projects || [],
            skills: {
                technical: p.composition?.skills?.technical || [],
                soft: p.composition?.skills?.soft || [],
                languagesSpoken: p.composition?.languagesSpoken || []
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
                .filter(aeu => aeu.isInferred === true && aeu.fact)
                .map(aeu => {
                    const parts = aeu.fact.split(':');
                    return {
                        field: parts[0] ? parts[0].trim() : "Assumption",
                        assumedValue: parts[1] ? parts[1].trim() : "N/A",
                        label: "Assumed from CV",
                        reason: aeu.inferenceReason || ""
                    };
                })
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

        const existingProfile = userProfile.confirmedProfile || userProfile.originalParsedData?.structured || {};
        const mergedProfile = JSON.parse(JSON.stringify(existingProfile));
        deepMerge(mergedProfile, profile);

        const builtOverrideMap = {
            fieldsChanged: [],
            assumptionsConfirmed: [],
            assumptionsCorrected: [],
            changeDetails: []
        };

        compareFields(userProfile.originalParsedData?.structured || {}, mergedProfile, builtOverrideMap);

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

        await createAuditLog(req, 'PROFILE_UPDATED', req.user.id, {
            fieldsChanged: builtOverrideMap.fieldsChanged,
            assumptionsConfirmed: builtOverrideMap.assumptionsConfirmed.length,
            assumptionsCorrected: builtOverrideMap.assumptionsCorrected.length
        });

        // --- NEW: Profile Conflict Notification (#13) ---
        if (builtOverrideMap.fieldsChanged.length > 0) {
            try {
                const completedRun = await db.Runs.findOne({ userId: req.user.id, status: 'REPORT_COMPLETE' }).sort({ completedAt: -1 });
                if (completedRun) {
                    const notificationService = require('../../services/notificationService');
                    const user = await db.User.findById(req.user.id);
                    await notificationService.notifyProfileConflict(completedRun.runId, user);
                }
            } catch (err) {
                console.error('[Profile-Notify] Conflict alert failed:', err.message);
            }
        }


        const activeRun = await db.Runs.findOne({ userId: req.user.id, status: { $ne: 'REPORT_COMPLETE' } });
        if (activeRun) {
            // Update the data snapshot but PRESERVE the current pipeline status
            await db.Runs.updateOne(
                { runId: activeRun.runId },
                { $set: { 'cvSnapshot.parsedData': mergedProfile } }
            );



            const rasId = `RAS_PROFILE_${activeRun.runId}`;
            await db.Ras.findOneAndUpdate(
                { rasId },
                {
                    $set: {
                        runId: activeRun.runId,
                        stepNo: 2,
                        artifactType: 'PROFILE_CONFIRMED',
                        artifactVersion: 1,
                        artifactJson: mergedProfile,
                        status: 'FINAL'
                    }
                },
                { upsert: true }
            );


            // Step 2 Notification
            const notificationService = require('../../services/notificationService');
            const user = await db.User.findById(req.user.id);
            if (user) await notificationService.notifyIntakeProgress(activeRun.runId, user);

            // Removed clockService.recalibrateForUser(req.user.id, mergedProfile);
            // Clock generation is now triggered by WhatsApp mobile verification (Activate Skill Clocks)
        }

        return res.status(200).json({
            success: true,
            data: { isConfirmed: true, confirmedAt: userProfile.confirmedAt, message: "Profile confirmed successfully. Proceeding to intake assessment." }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getHomeStatus = async (req, res) => {
    try {
        // Handle unauthenticated users
        if (!req.user || !req.user.id) {
            return res.status(200).json({
                success: true,
                data: {
                    overallProgress: 0,
                    cards: {
                        discoverYourself: 'ACTIVE',
                        skillClocks: 'LOCKED',
                        buildHip: 'LOCKED'
                    }
                }
            });
        }

        const userId = req.user.id;

        // 1. Check Discover Yourself (Card 1)
        const profile = await db.UserProfile.findOne({ userId }).lean();
        const isDiscoverComplete = !!(profile && profile.isConfirmed);

        // 2. Check Skill Clocks (Card 2)
        const user = await db.User.findById(userId).lean();
        const clocks = await db.UserClocks.findOne({ userId }).lean();
        const isClocksComplete = !!(user && user.isPhoneVerified && clocks && clocks.generationStatus === 'COMPLETED');

        // 3. Check HIP (Card 3)
        const hip = await db.HipProfile.findOne({ userId }).lean();
        const isHipComplete = !!(user && hip && hip.publishedAt);

        // Determine Statuses
        const status = {
            discoverYourself: 'ACTIVE',
            skillClocks: 'LOCKED',
            buildHip: 'LOCKED'
        };

        let overallProgress = 0;

        if (isDiscoverComplete) {
            status.discoverYourself = 'COMPLETED';
            status.skillClocks = 'ACTIVE';
            overallProgress = 1;

            if (isClocksComplete) {
                status.skillClocks = 'COMPLETED';
                status.buildHip = 'ACTIVE';
                overallProgress = 2;

                if (isHipComplete) {
                    status.buildHip = 'COMPLETED';
                    overallProgress = 3;
                }
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                overallProgress,
                cards: status
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
