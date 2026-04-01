const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { generateJSON } = require('../src/services/aiProvider');
const { aiSemaphore } = require('./concurrency');

const MAX_CHARS = 100000;
const DUAL_THRESHOLD = 15000; // Switch to Gemini for speed & budget on large files

// Specialist 1: Identity & Work History (Used for both Claude & Gemini)
const IDENTITY_WORK_PROMPT = `Act as an Identity & Career Specialist.
Goal: Extract full identity and complete work experience into structured JSON.

STRICT RULES:
1. EXPERIENCE: Titles must NOT be null. If a job title is missing, infer it from the profile (e.g., "Android Developer").
2. IDENTITY: Extract name, email, phone, location, and current role.
3. INFERRED: Must include Seniority Level, Total Years, and Employment Status.
4. VALIDATION: If this is NOT a CV/Resume (bank statement, invoice, etc.), set "isCv": false in the root.
5. Return VALID JSON ONLY.

JSON SCHEMA:
{
  "aeuList": [
    { "id": "AEU_IDENTITY_001", "pillar": "identity", "fact": "Name: [Name]", "isInferred": false, "confidenceScore": 1.0 },
    { "id": "AEU_INF_001", "pillar": "inferred", "fact": "Seniority Level: [Level]", "isInferred": true, "inferenceReason": "Reason", "confidenceScore": 0.8 },
    { "id": "AEU_INF_002", "pillar": "inferred", "fact": "Total Experience Years: [Num]", "isInferred": false, "confidenceScore": 1.0 },
    { "id": "AEU_INF_003", "pillar": "inferred", "fact": "Employment Status: [Status]", "isInferred": true, "confidenceScore": 0.9 }
  ],
  "structured": {
    "identity": { "fullName": "", "email": "", "phone": "", "location": "", "currentRoleTitle": "", "dateOfBirth": "", "linkedInProfile": "" },
    "work": {
      "experience": [ { "title": "", "company": "", "duration": "", "description": "" } ]
    },
    "inferred": { "seniorityLevel": "", "totalExperienceYears": 0, "employmentStatus": "", "seniorityConfidence": 0.9, "senioritySummary": "" }
  },
  "isCv": true
}`;

// Specialist 2: Skills, Education, & Projects (Used for both Claude & Gemini)
const SKILLS_PROJECTS_PROMPT = `Act as a Technical Skills & Project Specialist.
Goal: Extract exhaustive skills, complete education history, and projects.

STRICT RULES:
1. SKILLS: Extract EVERY technical and soft skill mentioned. DO NOT skip specialized or domain-specific skills.
2. EDUCATION: Extract degrees, institutions, and completion years.
3. PROJECTS: Extract project names, tech stacks, and descriptions. Keep descriptions to 1-2 concise sentences.
4. aeuList: Add facts for Domain Indicator and Highest Education Level.
5. Return VALID JSON ONLY.

JSON SCHEMA:
{
  "aeuList": [
    { "id": "AEU_INF_004", "pillar": "inferred", "fact": "Domain Indicator: [Domain]", "isInferred": true, "confidenceScore": 0.8 },
    { "id": "AEU_INF_005", "pillar": "inferred", "fact": "Highest Education Level: [Level]", "isInferred": false, "confidenceScore": 1.0 }
  ],
  "structured": {
    "work": {
      "projects": [ { "name": "", "techStack": [], "description": "" } ]
    },
    "composition": {
      "education": [ { "degree": "", "institution": "", "startYear": "", "endYear": "" } ],
      "skills": { "technical": [], "soft": [], "languagesSpoken": [] },
      "certifications": [],
      "training": [ { "courseName": "", "institution": "", "duration": "" } ]
    },
    "inferred": { "domainIndicator": "", "highestEducationLevel": "" }
  }
}`;

/**
 * Merge dual-specialist results into a single standardized object
 */
const mergeParallelResults = (bgResult, skillsResult, duration, modelUsed) => {
    // Determine overall isCv status
    const isCv = bgResult.isCv !== undefined ? bgResult.isCv : true;

    // Combine aeuLists
    const aeuList = [
        ...(Array.isArray(bgResult.aeuList) ? bgResult.aeuList : []),
        ...(Array.isArray(skillsResult.aeuList) ? skillsResult.aeuList : [])
    ];

    const standardized = {
        aeuList,
        structured: {
            identity: bgResult.structured?.identity || {},
            work: {
                experience: bgResult.structured?.work?.experience || [],
                projects: skillsResult.structured?.work?.projects || []
            },
            composition: {
                education: skillsResult.structured?.composition?.education || [],
                skills: {
                    technical: skillsResult.structured?.composition?.skills?.technical || [],
                    soft: skillsResult.structured?.composition?.skills?.soft || [],
                    languagesSpoken: skillsResult.structured?.composition?.skills?.languagesSpoken || []
                },
                certifications: skillsResult.structured?.composition?.certifications || [],
                senioritySummary: bgResult.structured?.composition?.senioritySummary || bgResult.structured?.inferred?.senioritySummary || ""
            },
            inferred: {
                seniorityLevel: bgResult.structured?.inferred?.seniorityLevel || "",
                totalExperienceYears: bgResult.structured?.inferred?.totalExperienceYears || 0,
                employmentStatus: bgResult.structured?.inferred?.employmentStatus || "",
                domainIndicator: skillsResult.structured?.inferred?.domainIndicator || "",
                highestEducationLevel: skillsResult.structured?.inferred?.highestEducationLevel || "",
                seniorityConfidence: bgResult.structured?.inferred?.seniorityConfidence || 0.9,
                senioritySummary: bgResult.structured?.inferred?.senioritySummary || ""
            }
        },
        parsingDuration: `${duration}s`,
        modelUsed: modelUsed,
        isCv: isCv,
        flags: {
            isInputTruncated: false,
            isOutputTruncated: false
        }
    };

    return standardized;
};

/**
 * Handle individual part extraction
 */
async function extractPart(text, prompt, forceProvider = null) {
    try {
        const result = await generateJSON(`Resume Content:\n${text}`, prompt, forceProvider);
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
        const forcedProvider = isBigFile ? 'Gemini' : null;

        console.log(`[AI Parser] Processing ${fileName} (${charCount} chars) | Strategy: ${isBigFile ? 'Parallel Gemini' : 'Parallel Claude'}...`);

        await aiSemaphore.acquire();
        try {
            // ALWAYS use Parallel logic now to beat the output-speed bottleneck
            const [bgResponse, skillsResponse] = await Promise.all([
                extractPart(trimmedText, IDENTITY_WORK_PROMPT, forcedProvider),
                extractPart(trimmedText, SKILLS_PROJECTS_PROMPT, forcedProvider)
            ]);

            const totalDuration = (Date.now() - totalStartTime) / 1000;
            const modelLabel = isBigFile ? `Gemini (Parallel)` : `Claude (Parallel)`;
            
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

        } finally {
            aiSemaphore.release();
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
