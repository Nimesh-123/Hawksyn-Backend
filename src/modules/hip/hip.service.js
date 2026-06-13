const { db } = require('../../models/index.model');
const hipAiProvider = require('./hip.aiProvider');
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

            // 2. Fetch Prompts and Rules
            const sectionPrompts = await db.HipSectionPrompt.find({ isActive: true });
            if (!sectionPrompts.length) throw new Error('No active HipSectionPrompts found in DB');

            const rules = await db.HipGuardrailRule.find({ isActive: true });
            const rulesMap = {};
            rules.forEach(r => { rulesMap[r.ruleId] = r.instruction; });

            const sectionsData = {};
            
            // Build a Set of valid anchor IDs from psdeResult for validation
            const validAnchorIds = new Set();
            const allAeusForValidation = psdeResult.base_aeus || psdeResult.archetype_results || [];
            for (const aeu of allAeusForValidation) {
                // Top-level id field (e.g. R1_AEU1, IAEU_CAP_1)
                if (aeu.id) validAnchorIds.add(aeu.id);
                // Nested evidence_anchors array if it exists
                if (Array.isArray(aeu.evidence_anchors)) {
                    for (const anchor of aeu.evidence_anchors) {
                        if (anchor.anchor_id) validAnchorIds.add(anchor.anchor_id);
                        if (anchor.id) validAnchorIds.add(anchor.id);
                    }
                }
                // archetype_id as fallback identifier
                if (aeu.archetype_id) validAnchorIds.add(aeu.archetype_id);
            }
            // Also add any top-level archetype anchor IDs from top_fired
            if (Array.isArray(psdeResult.top_fired)) {
                for (const tf of psdeResult.top_fired) {
                    if (tf.anchor_id) validAnchorIds.add(tf.anchor_id);
                    if (tf.id) validAnchorIds.add(tf.id);
                }
            }
            // If validAnchorIds is still empty after all attempts, log a warning
            // and disable anchor validation for this run to avoid degrading all sections
            const skipAnchorValidation = validAnchorIds.size === 0;
            if (skipAnchorValidation) {
                console.warn('[HIP-Service] ⚠️ Could not build validAnchorIds — anchor validation disabled for this run.');
            }

            function sanitiseSectionOutput(data) {
                if (!data) return data;
                // Strip any XML/HTML-like tags the LLM may have leaked into prose
                const stripTags = (str) => {
                    if (typeof str !== 'string') return str;
                    let clean = str.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ');
                    // Clean up empty fragments left by stripped tags
                    clean = clean.replace(/\s+at\s+\./g, '.').replace(/\bat\s+\./g, '.').trim();
                    return clean;
                };
                
                if (data.prose) data.prose = stripTags(data.prose);
                if (Array.isArray(data.cards)) {
                    data.cards = data.cards.map(card => ({
                        ...card,
                        title: stripTags(card.title),
                        description: stripTags(card.description),
                        label: stripTags(card.label),
                    }));
                }
                if (Array.isArray(data.chips)) {
                    data.chips = data.chips.map(stripTags).filter(c => c && c.trim().length > 0);
                }
                return data;
            }

            // 3. Process Each Section
            // We do this sequentially to avoid rate limiting, but could use Promise.all with concurrency limit
            for (const spec of sectionPrompts) {
                console.log(`[HIP-Service] Generating section: ${spec.sectionId} - ${spec.sectionName}`);
                
                try {
                    let relevantAeus = [];
                    const allAeus = psdeResult.base_aeus || psdeResult.archetype_results || [];
                    
                    if (spec.aeuSelector && (
                        (spec.aeuSelector.dimensionIds && spec.aeuSelector.dimensionIds.length > 0) || 
                        (spec.aeuSelector.archetypeIds && spec.aeuSelector.archetypeIds.length > 0)
                    )) {
                        relevantAeus = allAeus.filter(a => {
                            const matchDim = spec.aeuSelector.dimensionIds && spec.aeuSelector.dimensionIds.includes(a.dimension_id);
                            const matchArch = spec.aeuSelector.archetypeIds && spec.aeuSelector.archetypeIds.includes(a.archetype_id);
                            return matchDim || matchArch;
                        });
                        
                        if (spec.aeuSelector.limit) {
                            relevantAeus = relevantAeus.slice(0, spec.aeuSelector.limit);
                        }
                    } else {
                        // Fall back to top-10 by confidence
                        relevantAeus = allAeus
                            .filter(a => a.evidence_strength === 'strong' || a.evidence_strength === 'moderate' || a.detection_state === 'detected')
                            .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
                            .slice(0, 10);
                    }

                    const templateData = {
                        ...profileContext,
                        psde_aeus: relevantAeus,
                        rarity_aeu: psdeResult.top_fired?.find(a => a.dimension_id === 'DIM_08_RARITY'),
                        supporting_aeus: relevantAeus.slice(0, 5),
                        consolidator_output: psdeResult.consolidator_output || {}
                    };

                    // Pattern C: build col_1, col_2, col_3 from relevantAeus
                    // Only runs for S08 or any section with pattern containing 'C'
                    if (spec.pattern && spec.pattern.toLowerCase().includes('c')) {
                        
                        // Pull anchors that carry numeric scale data
                        // Look across all PSDE anchors for team_size, budget, tenure type fields
                        const scaleAnchors = [];
                        
                        const allAeusFlat = psdeResult.base_aeus || psdeResult.archetype_results || [];
                        
                        for (const aeu of allAeusFlat) {
                            if (!Array.isArray(aeu.evidence_anchors)) continue;
                            for (const anchor of aeu.evidence_anchors) {
                                const t = (anchor.anchor_type || '').toLowerCase();
                                if (
                                    t.includes('team') || t.includes('headcount') ||
                                    t.includes('budget') || t.includes('revenue') ||
                                    t.includes('tenure') || t.includes('years') ||
                                    t.includes('numeric') || t.includes('scale') ||
                                    t.includes('size') || t.includes('count')
                                ) {
                                    if (anchor.anchor_value && anchor.anchor_value !== null) {
                                        scaleAnchors.push(anchor);
                                    }
                                }
                            }
                        }

                        // Also check top-level AEU fields directly
                        for (const aeu of allAeusFlat) {
                            if (aeu.anchor_type && aeu.anchor_value !== null && aeu.anchor_value !== undefined) {
                                const t = (aeu.anchor_type || '').toLowerCase();
                                if (
                                    t.includes('team') || t.includes('headcount') ||
                                    t.includes('budget') || t.includes('revenue') ||
                                    t.includes('tenure') || t.includes('years') ||
                                    t.includes('numeric') || t.includes('scale')
                                ) {
                                    scaleAnchors.push({
                                        anchor_id: aeu.id || aeu.anchor_id,
                                        anchor_type: aeu.anchor_type,
                                        anchor_value: aeu.anchor_value,
                                        verbatim_quote: aeu.raw_text || aeu.verbatim_quote || ''
                                    });
                                }
                            }
                        }

                        const nullCol = { 
                            anchor_id: null, 
                            anchor_type: null, 
                            anchor_value: null, 
                            verbatim_quote: null 
                        };

                        templateData.col_1 = scaleAnchors[0] || nullCol;
                        templateData.col_2 = scaleAnchors[1] || nullCol;
                        templateData.col_3 = scaleAnchors[2] || nullCol;

                        // If no scale anchors found at all, skip S08 entirely
                        if (!scaleAnchors[0]) {
                            console.warn(`[HIP-Service] ⚠️ S08: No scale anchors found in PSDE result — skipping section`);
                            sectionsData[spec.sectionId] = {
                                columns: [],
                                evidence_anchors_used: [],
                                _skipped: true,
                                _reason: 'No scale anchors available in PSDE output'
                            };
                            continue; // skip to next section in the loop
                        }
                    }

                    // Pre-process the template to escape LLM instructions like {{plain English}}
                    // We escape any {{ that is NOT followed by our known data keys (#each, profile, this, etc)
                    const escapedTemplateStr = spec.userPromptTemplate.replace(
                        /\{\{(?!\s*(#each|\/each|#if|\/if|profile|psde_aeus|this|rarity_aeu|supporting_aeus|@index|col_1|col_2|col_3))/g,
                        '\\{\{'
                    );

                    // Handlebars arrays require .[0] instead of [0]
                    const cleanArrayIndices = escapedTemplateStr.replace(/\[(\d+)\]/g, '.[$1]');

                    // Compile Handlebars User Prompt
                    const template = Handlebars.compile(cleanArrayIndices);
                    const finalUserPrompt = template(templateData);

                    // Compile System Prompt with Guardrails
                    let finalSystemPrompt = spec.systemPrompt + '\n\nSTRICT RULES TO FOLLOW:\n';
                    spec.activeGuardrails.forEach(ruleId => {
                        if (rulesMap[ruleId]) {
                            finalSystemPrompt += `- [${ruleId}] ${rulesMap[ruleId]}\n`;
                        }
                    });

                    // Call Local HIP LLM if not a special no-LLM pattern
                    let llmResponse = { data: {} };
                    if (spec.pattern && spec.pattern.includes('no LLM')) {
                        console.log(`[HIP-Service] ⏭️ Skipping LLM for ${spec.sectionId} (pattern: ${spec.pattern})`);
                        llmResponse = { 
                            data: { 
                                cards: [], 
                                columns: [], 
                                prose: '', 
                                chips: [], 
                                evidence_anchors_used: [],
                                _skipped: true
                            } 
                        };
                    } else {
                        let attempts = 0;
                        const maxAttempts = 2;
                        let success = false;
                        
                        while (attempts < maxAttempts && !success) {
                            attempts++;
                            try {
                                llmResponse = await hipAiProvider.generateJSON(finalUserPrompt, finalSystemPrompt, {
                                    model: spec.modelConfig?.modelFamily === 'Claude' ? 'Claude' : 'Gemini',
                                    maxTokens: Math.max(spec.modelConfig?.tokenCeiling || 4000, 4000)
                                });
                                
                                // Validate anchor IDs
                                if (!skipAnchorValidation && llmResponse.data && Array.isArray(llmResponse.data.evidence_anchors_used)) {
                                    for (const anchorId of llmResponse.data.evidence_anchors_used) {
                                        if (!validAnchorIds.has(anchorId)) {
                                            console.warn(`[HIP-Service] [GR_H_007] Invalid anchor ID: ${anchorId} — not in PSDE source. Flagging but not blocking.`);
                                            // Log to gr_log if available; do not throw — degrade only if critical
                                        }
                                    }
                                }

                                // After anchor validation, before storing
                                if (spec.pattern === 'C' || spec.sectionId === 'S08') {
                                    if (!llmResponse.data.columns || llmResponse.data.columns.length === 0) {
                                        throw new Error(`[S08] Pattern C returned empty columns — no scale data available`);
                                    }
                                }

                                success = true;
                            } catch (err) {
                                console.error(`[HIP-Service] ⚠️ Attempt ${attempts} failed for section ${spec.sectionId}:`, err.message);
                                if (attempts >= maxAttempts) {
                                    throw err;
                                }
                            }
                        }
                    }

                    sectionsData[spec.sectionId] = sanitiseSectionOutput(llmResponse.data);
                    console.log(`[HIP-Service] ✅ Section ${spec.sectionId} generated.`);
                    
                } catch (secErr) {
                    console.error(`[HIP-Service] ❌ Failed section ${spec.sectionId} after all attempts:`, secErr.message);
                    // Mark as degraded with safe shape
                    sectionsData[spec.sectionId] = { 
                        _degraded: true, 
                        cards: [], 
                        columns: [], 
                        prose: '', 
                        chips: [], 
                        evidence_anchors_used: [],
                        _error: true,
                        message: secErr.message
                    };
                }
            }

            // Build FAQ mainEntity — generate proper recruiter questions from section content
            let faqEntities = [];

            // Strategy 1: try to build from prose sections using profile context as question frame
            const faqSourceMap = [
                { section: 'S04', question: `What is ${profileContext.profile.full_name}'s career background?` },
                { section: 'S05', question: `How does ${profileContext.profile.full_name}'s title compare to their actual scope?` },
                { section: 'S11', question: `What are ${profileContext.profile.full_name}'s key professional strengths?` },
                { section: 'S13', question: `What domain expertise does ${profileContext.profile.full_name} hold?` },
                { section: 'S14', question: `What is ${profileContext.profile.full_name}'s specialist identity?` },
                { section: 'S15', question: `What does ${profileContext.profile.full_name}'s growth trajectory show?` },
                { section: 'S17', question: `What is the significance of ${profileContext.profile.full_name}'s employer history?` },
                { section: 'S21', question: `What trust signals does ${profileContext.profile.full_name}'s record show?` },
                { section: 'S23', question: `What market demand exists for ${profileContext.profile.full_name}'s profile?` },
                { section: 'S24', question: `What makes ${profileContext.profile.full_name} distinctive in their field?` },
            ];

            for (const { section, question } of faqSourceMap) {
                const sec = sectionsData[section];
                if (!sec || sec._degraded || sec._error) continue;
                
                let answer = '';
                if (sec.prose && sec.prose.trim().length > 20) {
                    // Trim prose to 120 words max for FAQPage
                    const words = sec.prose.trim().split(/\s+/);
                    answer = words.length > 120 ? words.slice(0, 120).join(' ') + '...' : sec.prose.trim();
                } else if (Array.isArray(sec.cards) && sec.cards.length > 0) {
                    answer = sec.cards[0].description || '';
                }
                
                if (answer && faqEntities.length < 10) {
                    faqEntities.push({
                        "@type": "Question",
                        "name": question,
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": answer.replace(/<[^>]+>/g, '').replace(/\s+at\s+\./g, '.').replace(/\bat\s+\./g, '.').trim()
                        }
                    });
                }
            }

            if (faqEntities.length === 0) {
                console.warn('[HIP-Service] ⚠️ Could not build any FAQ entities — all source sections empty or degraded.');
            }

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
