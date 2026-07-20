const { db } = require('../../models/index.model');
const Handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');

class HipService {
    async generateHipProfile(userId) {
        try {
            console.log(`[HIP-Service] Starting profile generation for User: ${userId}`);
            
            // 1. Fetch User, UserProfile (for CV data), and PSDEResult
            const user = await db.User.findById(userId);
            if (!user) throw new Error(`User ${userId} not found`);

            const userProfile = await db.UserProfile.findOne({ userId });
            const cvData = userProfile?.confirmedProfile || userProfile?.originalParsedData || {};

            // PSDE candidate_id is stored as the userId in this pre-payment flow
            // Use .lean() to bypass strict schema validation and fetch unmapped fields like base_aeus and header
            const psdeResult = await db.PSDEResult.findOne({ candidate_id: userId }).lean();
            if (!psdeResult) throw new Error(`PSDE Result not found for User ${userId}`);

            // Helper to clean extracted CV data
            const cleanDomain = cvData.domain || 'Professional Domain';
            const rarityPercentile = psdeResult.top_fired?.find(f => f.dimension_id === 'DIM_08_RARITY')?.anchor_confidence || 10; // Mock percentile
            
            const psdeName = psdeResult.consolidator_output?.identity?.fullName || psdeResult.header?.name;
            const cvName = cvData?.structured?.identity?.fullName || cvData?.structured?.identity?.name || cvData?.identity?.name || cvData?.personal_info?.name || cvData?.candidateName;
            const resolvedName = user.fullName || user.name || cvName || psdeName || 'Unknown Candidate';

            const profileContext = {
                profile: {
                    full_name: resolvedName,
                    first_name: resolvedName.split(' ')[0],
                    last_name: resolvedName.split(' ').slice(1).join(' '),
                    gender_pronoun: 'they/them', // Usually fetched from user config
                    current_title: cvData?.structured?.identity?.currentRoleTitle || cvData?.structured?.identity?.headline_title || cvData?.identity?.headline_title || cvData.currentTitle || 'Professional',
                    years_experience: Math.round(cvData?.structured?.inferred?.totalExperienceYears) || Math.round(cvData?.inferred?.totalExperienceYears) || cvData.yearsOfExperience || 5,
                    primary_domain: cvData?.structured?.inferred?.industry || cvData?.inferred?.industry || cleanDomain,
                    rarity_percentile: rarityPercentile,
                    linkedin_url: cvData?.structured?.identity?.social_links?.linkedin || cvData?.identity?.social_links?.linkedin || cvData.linkedinUrl || '',
                    location_city: cvData?.structured?.identity?.location?.primary_city || cvData?.identity?.location || cvData.location || 'Global'
                }
            };

            // 2. Determine Seniority Band
            let band_code = 'MS';
            if (profileContext.profile.years_experience <= 2) band_code = 'FR';
            else if (profileContext.profile.years_experience <= 5) band_code = 'JR';
            else if (profileContext.profile.years_experience <= 10) band_code = 'MS';
            else if (profileContext.profile.years_experience <= 14) band_code = 'SR';
            else band_code = 'LD';

            // 3. Fetch Deterministic Content from HipContentMap
            console.log(`[HIP-Service] Fetching static content for band: ${band_code}`);
            const allContentForBand = await db.HipContentMap.find({ band_code }).lean();

            if (!allContentForBand.length) {
                console.warn(`[HIP-Service] ⚠️ No content found in HipContentMap for band ${band_code}. Run seeder.`);
            }

            // 4. Map PSDE signals to Sections (Deterministic Logic)
            // In a full implementation, you would map specific psdeResult.archetype_results to C1S1, C1S2 etc.
            // For now, we will deterministically assign signal levels based on the overall PSDE detection rate.
            const detectionRate = psdeResult.total_detected / (psdeResult.total_evaluated || 330);
            const defaultSignal = detectionRate > 0.4 ? 'STRONG' : (detectionRate > 0.2 ? 'MODERATE' : 'GAP');

            const sectionsData = {};
            const faqEntities = [];

            // Group content by section
            const sectionsGrouped = allContentForBand.reduce((acc, doc) => {
                if (!acc[doc.section_id]) acc[doc.section_id] = {};
                acc[doc.section_id][doc.signal_level] = doc;
                return acc;
            }, {});

            const rawSectionsData = {};
            for (const sectionId in sectionsGrouped) {
                let chosenSignal = defaultSignal; 
                const sectionContent = sectionsGrouped[sectionId][chosenSignal] || sectionsGrouped[sectionId]['MODERATE'] || Object.values(sectionsGrouped[sectionId])[0];

                if (sectionContent) {
                    const sectionKey = sectionContent.section_id; // It's already in C1S1 format from the DB
                    rawSectionsData[sectionKey] = {
                        chapter_id: sectionContent.chapter_id,
                        section_name: sectionContent.section_name,
                        signal_level: sectionContent.signal_level,
                        prose: sectionContent.headline + ' — ' + sectionContent.content_block,
                        cards: [
                            {
                                title: sectionContent.headline,
                                description: sectionContent.content_block,
                                label: sectionContent.signal_level
                            }
                        ],
                        chips: sectionContent.capability_titles ? sectionContent.capability_titles.split(',') : [],
                        _degraded: false
                    };

                    // Add to FAQ
                    if (faqEntities.length < 10) {
                        faqEntities.push({
                            "@type": "Question",
                            "name": `What is the assessment for ${sectionContent.section_name}?`,
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": sectionContent.content_block
                            }
                        });
                    }
                }
            }

            // Map the new deterministic keys (C*S*) back to the legacy (S01-S24) format 
            // that the Handlebars templates and UI_CHAPTER_MAP in hip.controller.js expect.
            const compatibilityMap = {
                "C1S1": "S01",
                "C2S1": "S02",
                "C2S2": "S03",
                "C2S3": "S04",
                "C3S1": "S05",
                "C3S2": "S06",
                "C3S3": "S07",
                "C4S1": "S08",
                "C4S2": "S09",
                "C4S3": "S10",
                "C1S2": "S11",
                "C5S1": "S12", 
                "C5S2": "S13",
                "C5S3": "S14",
                "C6S1": "S15",
                "C6S2": "S16",
                "C6S3": "S17",
                "C6S4": "S18",
                "C7S1": "S19",
                "C7S2": "S20",
                "C7S3": "S21",
                "C7S4": "S22",
                "C8S1": "S23",
                "C8S2": "S24",
                "C3S4": "S25" 
            };

            for (const [key, data] of Object.entries(rawSectionsData)) {
                const legacyKey = compatibilityMap[key] || key;
                sectionsData[legacyKey] = data;
            }

            console.log(`[HIP-Service] ✅ Sections mapped deterministically from DB.`);

            const safeName = resolvedName.replace(/\s+/g, '-');
            const slug = `${safeName}-${uuidv4().split('-')[0]}`.toLowerCase();
            const canonicalUrl = `https://hawksyn.com/profile/${slug}`;

            const totalDetected = psdeResult.total_detected || (psdeResult.base_aeus || psdeResult.archetype_results || []).length || 0;
            let rawDesc = `${profileContext.profile.full_name} is a ${profileContext.profile.primary_domain} professional ranked in the top ${profileContext.profile.rarity_percentile}% on Hawksyn — verified across ${totalDetected} signals with ${profileContext.profile.years_experience} years of experience.`;
            let metaDesc = rawDesc;
            if (metaDesc.length > 160) {
                metaDesc = metaDesc.slice(0, 160);
                metaDesc = metaDesc.substring(0, metaDesc.lastIndexOf(' ')) + '...';
            }

            const jsonLdPerson = {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": profileContext.profile.full_name,
                "jobTitle": profileContext.profile.current_title,
                "url": canonicalUrl
            };
            
            if (profileContext.profile.linkedin_url) {
                jsonLdPerson.sameAs = profileContext.profile.linkedin_url;
            }
            
            const education = cvData?.composition?.education || cvData?.structured?.composition?.education;
            if (education && Array.isArray(education) && education.length > 0) {
                jsonLdPerson.alumniOf = education.map(e => ({ "@type": "EducationalOrganization", "name": e.institution }));
            }
            
            const technicalSkills = cvData?.composition?.skills?.technical || cvData?.structured?.composition?.skills?.technical;
            if (technicalSkills && Array.isArray(technicalSkills) && technicalSkills.length > 0) {
                jsonLdPerson.knowsAbout = technicalSkills.slice(0, 5);
            }

            const seoMetadata = {
                title: `${profileContext.profile.full_name} | ${profileContext.profile.current_title} | Hawksyn`,
                metaDescription: metaDesc,
                canonicalUrl,
                ogImageUrl: `https://cdn.hawksyn.com/profiles/${slug}/og.jpg`,
                rarityScore: profileContext.profile.rarity_percentile,
                jsonLdPerson: jsonLdPerson,
                jsonLdFaq: {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": faqEntities
                }
            };

            // 5. Save to HipProfile
            const profile = await db.HipProfile.findOneAndUpdate(
                { userId },
                {
                    $set: {
                        userId: user._id,
                        profileSlug: slug,
                        seoMetadata,
                        sectionsData,
                        status: 'PUBLISHED',
                        publishedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );

            console.log(`[HIP-Service] 🎉 Profile generated completely: ${slug}`);
            return profile;

        } catch (error) {
            console.error('[HIP-Service] Critical Generation Error:', error);
            throw error;
        }
    }
}

module.exports = new HipService();
