const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { generateJSON } = require('../src/services/aiProvider');
const { aiSemaphore } = require('./concurrency');
const { getPrompt } = require('./promptConfig');

const MAX_CHARS = 100000;
const DUAL_THRESHOLD = 15000; // Switch to Gemini for speed & budget on large files


/**
 * Map consolidated result to Hawksyn Standardized Format
 */
const mapConsolidatedToHawksyn = (result, duration, modelUsed) => {
    const aeuList = (result.base_aeus || []).map(b => ({
        id: b.aue_id,
        pillar: 'work',
        fact: `${b.action} at ${b.company}`,
        isInferred: b.flags?.includes('inferred') || false,
        confidenceScore: b.evidence_strength === 'strong' ? 1.0 : (b.evidence_strength === 'moderate' ? 0.8 : 0.6),
        raw_text: b.raw_text,
        normalized_text: b.normalized_text
    }));

    // Add inferences to aeuList
    (result.inference_aeus || []).forEach(i => {
        aeuList.push({
            id: i.iaeu_id,
            pillar: 'inferred',
            fact: `${i.title}: ${i.inferred_claim}`,
            isInferred: true,
            confidenceScore: i.confidence === 'high' ? 1.0 : (i.confidence === 'medium' ? 0.7 : 0.4),
            inferenceReason: i.logic
        });
    });

    // Group Base AEUs by company to reconstruct experience
    const experienceMap = {};
    (result.base_aeus || []).forEach(b => {
        const key = `${b.company}_${b.role}`;
        if (!experienceMap[key]) {
            experienceMap[key] = {
                title: b.role,
                company: b.company,
                duration: `${b.timeframe?.start || ''} - ${b.timeframe?.end || ''}`,
                description: []
            };
        }
        experienceMap[key].description.push(b.normalized_text || b.action);
    });

    const experience = Object.values(experienceMap).map(e => ({
        ...e,
        description: e.description.length > 0 ? '• ' + e.description.join('\n• ') : ""
    }));

    // Extract skills
    const technicalSkills = new Set();
    const softSkills = new Set();
    (result.skill_mappings || []).forEach(s => {
        if (s.primary_skill) technicalSkills.add(s.primary_skill);
        (s.secondary_skills || []).forEach(ss => technicalSkills.add(ss));
    });

    return {
        aeuList,
        structured: {
            identity: result.identity || { fullName: result.candidate_id || "Unknown" },
            work: {
                experience: experience,
                projects: result.projects || []
            },
            composition: {
                education: result.education || [],
                skills: {
                    technical: Array.from(technicalSkills),
                    soft: result.soft_skills || []
                },
                languagesSpoken: result.languages || [],
                certifications: result.certifications || [],
                senioritySummary: (result.inference_aeus || []).find(i => i.type === 'seniority')?.inferred_claim || ""
            },
            inferred: {
                seniorityLevel: (result.inference_aeus || []).find(i => i.type === 'seniority')?.title || "",
                totalExperienceYears: result.total_experience_years || 0,
                employmentStatus: result.employment_status || "",
                domainIndicator: result.domain_indicator || "",
                highestEducationLevel: result.highest_education_level || "",
                seniorityConfidence: 0.8,
                senioritySummary: (result.inference_aeus || []).find(i => i.type === 'seniority')?.inferred_claim || ""
            }
        },
        parsingDuration: `${duration}s`,
        modelUsed: modelUsed,
        isCv: true,
        flags: { isInputTruncated: false, isOutputTruncated: false }
    };
};

/**
 * Merge dual-specialist results into a single standardized object
 */
const mergeParallelResults = (bgResult, skillsResult, duration, modelUsed) => {
    // Determine overall isCv status
    // Identity & Work AEUs (from Identity/Work prompt)
    const aeuList = (bgResult.base_aeus || []).map(b => ({
        id: b.aue_id,
        pillar: 'work',
        fact: `${b.action} at ${b.company}`,
        isInferred: b.flags?.includes('inferred') || false,
        confidenceScore: b.evidence_strength === 'strong' ? 1.0 : (b.evidence_strength === 'moderate' ? 0.8 : 0.6),
        raw_text: b.raw_text,
        normalized_text: b.normalized_text
    }));

    // Inferences (from Identity/Work prompt)
    (bgResult.inference_aeus || []).forEach(i => {
        aeuList.push({
            id: i.iaeu_id,
            pillar: 'inferred',
            fact: `${i.title}: ${i.inferred_claim}`,
            isInferred: true,
            confidenceScore: i.confidence === 'high' ? 1.0 : (i.confidence === 'medium' ? 0.7 : 0.4),
            inferenceReason: i.logic
        });
    });

    // Reconstruct Experience
    const experienceMap = {};
    (bgResult.base_aeus || []).forEach(b => {
        const key = `${b.company}_${b.role}`;
        if (!experienceMap[key]) {
            experienceMap[key] = {
                title: b.role,
                company: b.company,
                duration: `${b.timeframe?.start || ''} - ${b.timeframe?.end || ''}`,
                description: []
            };
        }
        experienceMap[key].description.push(b.normalized_text || b.action);
    });

    const experience = Object.values(experienceMap).map(e => ({
        ...e,
        description: e.description.length > 0 ? '• ' + e.description.join('\n• ') : ""
    }));

    // Reconstruct Projects with Bullets if they are paragraphs
    const projects = (skillsResult.projects || []).map(p => {
        if (p.description && typeof p.description === 'string' && p.description.includes('\n')) {
            // Already has newlines, might be bulleted or just paragraphs. 
            // Ensure every newline starts with a bullet if it doesn't already.
            p.description = p.description.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) return trimmed;
                return '• ' + trimmed;
            }).join('\n');
        } else if (p.description && typeof p.description === 'string' && p.description.length > 100) {
            // Long single paragraph, try to split by sentences or just prefix with one bullet
            if (!p.description.trim().startsWith('•')) {
                p.description = '• ' + p.description.trim();
            }
        }
        return p;
    });

    // Skills extraction (from Skills prompt)
    const technicalSkills = new Set();
    (skillsResult.skill_mappings || []).forEach(s => {
        if (s.primary_skill) technicalSkills.add(s.primary_skill);
        (s.secondary_skills || []).forEach(ss => technicalSkills.add(ss));
    });

    // Extract global inferences from Background Specialist
    let seniorityInference = (bgResult.inference_aeus || []).find(i => 
        i.type?.toLowerCase() === 'seniority' || 
        i.title?.toLowerCase().includes('seniority')
    );

    // Smart Fallback: If no explicit seniority type, look for keywords in any inference
    if (!seniorityInference) {
        seniorityInference = (bgResult.inference_aeus || []).find(i => 
            /senior|junior|mid-level|lead|principal/i.test(i.title || i.inferred_claim || "")
        );
    }

    return {
        aeuList,
        structured: {
            identity: bgResult.identity || {},
            work: {
                experience: experience,
                projects: projects
            },
            composition: {
                education: skillsResult.education || [],
                skills: {
                    technical: Array.from(technicalSkills),
                    soft: skillsResult.soft_skills || []
                },
                languagesSpoken: skillsResult.languages || [],
                certifications: skillsResult.certifications || [],
                senioritySummary: seniorityInference?.inferred_claim || seniorityInference?.fact || bgResult.seniority_summary || ""
            },
            inferred: {
                seniorityLevel: seniorityInference?.title || (seniorityInference?.inferred_claim ? seniorityInference.inferred_claim.split(':')[0] : "") || bgResult.seniority_level || "",
                totalExperienceYears: bgResult.total_experience_years || 0,
                employmentStatus: bgResult.employment_status || "",
                domainIndicator: skillsResult.domain_indicator || "",
                highestEducationLevel: skillsResult.highest_education_level || "",
                seniorityConfidence: 0.9,
                senioritySummary: seniorityInference?.inferred_claim || seniorityInference?.fact || bgResult.seniority_summary || ""
            }
        },
        parsingDuration: `${duration}s`,
        modelUsed: modelUsed,
        isCv: true,
        flags: { isInputTruncated: false, isOutputTruncated: false }
    };
};

/**
 * Handle individual part extraction
 */
async function extractPart(text, config, forceProvider = null) {
    try {
        const { promptText, modelFamily, temperature, maxTokens } = config;
        const result = await generateJSON(`Resume Content:\n${text}`, promptText, {
            model: modelFamily,
            temperature,
            maxTokens,
            forceProvider
        });
        return result;
    } catch (err) {
        console.error("[AI Extraction] Part Failure:", err.message);
        throw err;
    }
}

/**
 * Clean CV text for better parsing efficiency
 */
function cleanCVText(text) {
    if (!text) return "";
    return text
        .replace(/\s+/g, " ")
        .replace(/Page \d+/gi, "")
        .trim();
}

/**
 * Extract text from file (PDF or DOCX)
 */
const extractTextFromFile = async (buffer, mimetype) => {
    try {
        let result = "";
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            result = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const { value } = await mammoth.extractRawText({ buffer });
            result = value;
        } else {
            throw new Error(`Unsupported file type: ${mimetype}`);
        }
        return result;
    } catch (error) {
        console.error("File Extraction Error:", error);
        throw new Error("Failed to extract text: " + error.message);
    }
};

/**
 * Neural Text Healer: Collapses noise and fixes whitespace
 */
const neuralHealer = (text) => {
    if (!text) return "";
    return text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") 
        .replace(/\s{2,}/g, " ") 
        .trim();
};

/**
 * Smart Router Logic - Updated for Dual-Parallel Hybrid Processing
 */
const smartCVParser = async (buffer, fileName, mimetype) => {
    const totalStartTime = Date.now();
    
    try {
        // 1. Text Extraction
        const rawText = await extractTextFromFile(buffer, mimetype);
        const cleanedText = neuralHealer(cleanCVText(rawText));
        const trimmedText = cleanedText.length > MAX_CHARS ? cleanedText.slice(0, MAX_CHARS) : cleanedText;

        const charCount = trimmedText.length;
        const isBigFile = charCount >= DUAL_THRESHOLD;
        const forcedProvider = null; // Always try Claude first (Primary)

        console.log(`[AI Parser] Processing ${fileName} (${charCount} chars) | Strategy: Unified Claude-Primary...`);

        try {
            // 1. Fetch Parallel Strategy Configs (Primary for Speed)
            const identityConfig = await getPrompt('IDENTITY_WORK_PROMPT', {
                promptText: `You are a deterministic CV intelligence engine. Output ONLY raw JSON.

Your task:
1) Extract Identity details.
2) Generate Base AEUs (Max 30-40 most impactful actions). Be concise.
3) MANDATORY: Generate Strategic Inferences (I-AEUs) with type: "seniority", "domain", etc.

STRICT RULES:
- Output ONLY valid JSON. 
- No markdown code blocks.
- No text before or after the JSON.
- For Work Experience descriptions, use Bullet Points (•) for each achievement.
- If the output is too long, prioritize quality over quantity.`,
                modelFamily: 'claude-haiku-4-5-20251001',
                maxTokens: 4000
            });

            const skillsConfig = await getPrompt('SKILLS_PROJECTS_PROMPT', {
                promptText: `You are a deterministic CV intelligence engine focused on Skills, Education, and Projects.

Your task:
1) Extract Education, Projects, and Certifications.
2) Perform Skill Mapping (Primary/Secondary skills) based on the content.
3) IMPORTANT: Perform "Shadow Skill Inference" — if a skill/tool is clearly demonstrated in a project or work description but NOT listed in the skills section, you MUST infer it and add it to the skill_mappings.

-------------------------------------
SECTION 2 — SKILL MAPPING RULES
-------------------------------------
1. Map EACH experience/project action to:
   - 1 primary skill (mandatory)
   - up to 3 secondary skills (optional)
2. "Shadow Skill" Clause: If an action uses a specific stack (e.g., "Built UI with Redux"), add the underlying skills (e.g., "React", "JavaScript", "State Management") even if the user didn't explicitly list them in their skills section.
3. Assign confidence: high | medium | low based on how clearly the skill is demonstrated.
4. For Project descriptions, always use Bullet Points (•) to list key features or tech implementations.

[FOLLOW OTHER RULES FOR JSON STRUCTURE]`,
                modelFamily: 'claude-haiku-4-5-20251001',
                temperature: 0.7,
                maxTokens: 4000
            });

            console.log(`[AI Parser] Parallel Prompts Check -> Identity: ${!!identityConfig.promptText}, Skills: ${!!skillsConfig.promptText}`);

            // 2. Execute Parallel Strategy
            if (identityConfig.promptText && skillsConfig.promptText) {
                console.log(`[AI Parser] Using Dual Specialist Strategy (Parallel) for speed...`);
                const startParallel = Date.now();
                
                const [bgResponse, skillsResponse] = await Promise.all([
                    extractPart(trimmedText, identityConfig, forcedProvider).then(res => {
                        console.log(`[AI Parser] Identity/Work Call Finished in ${(Date.now() - startParallel)/1000}s`);
                        return res;
                    }),
                    extractPart(trimmedText, skillsConfig, forcedProvider).then(res => {
                        console.log(`[AI Parser] Skills/Projects Call Finished in ${(Date.now() - startParallel)/1000}s`);
                        return res;
                    })
                ]);

                const totalDuration = (Date.now() - totalStartTime) / 1000;
                const modelLabel = `Unified Parallel (${bgResponse.provider || 'AI'} + ${skillsResponse.provider || 'AI'})`;
                
                const standardized = mergeParallelResults(bgResponse.data, skillsResponse.data, totalDuration, modelLabel);

                // Metadata & Usage
                standardized.tokenUsage = {
                    promptTokens: (bgResponse.usage?.promptTokens || 0) + (skillsResponse.usage?.promptTokens || 0),
                    completionTokens: (bgResponse.usage?.completionTokens || 0) + (skillsResponse.usage?.completionTokens || 0),
                    totalTokens: (bgResponse.usage?.totalTokens || 0) + (skillsResponse.usage?.totalTokens || 0)
                };
                standardized.totalPipelineDuration = `${totalDuration}s`;
                standardized.flags.isInputTruncated = rawText.length > MAX_CHARS;

                return standardized;
            }

            // 3. Fallback to Consolidated Strategy if parallel prompts are missing
            const consolidatedConfig = await getPrompt('CV_PARSER_CONSOLIDATED', {
                promptText: null,
                modelFamily: 'claude-3-5-haiku-latest',
                maxTokens: 4000
            });
            
            if (consolidatedConfig && consolidatedConfig.promptText) {
                console.log(`[AI Parser] Using Consolidated Prompt Strategy (Fallback)...`);
                const response = await extractPart(trimmedText, consolidatedConfig, forcedProvider);
                const totalDuration = (Date.now() - totalStartTime) / 1000;
                const modelLabel = `Consolidated Chain (${response.provider || 'Primary'})`;
                
                const standardized = mapConsolidatedToHawksyn(response.data, totalDuration, modelLabel);
                
                standardized.tokenUsage = response.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
                standardized.totalPipelineDuration = `${totalDuration}s`;
                standardized.flags.isInputTruncated = rawText.length > MAX_CHARS;
                
                return standardized;
            }

            throw new Error("No active parsing prompts found in configuration.");

        } catch (innerError) {
            console.error("[AI Parser] ❌ Internal Error:", innerError.message);
            throw innerError;
        }

    } catch (error) {
        console.error("[AI Parser] ❌ Pipeline Crash:", error.message);
        return null;
    }
};

module.exports = {
    smartCVParser,
    extractTextFromFile,
    cleanCVText,
    neuralHealer
};
