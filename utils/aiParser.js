const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_CHARS = 15000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// const AEU_SCHEMA_PROMPT = `
// Act as a Precision CV Extraction Engine for Hawksyn. Your objective is ONLY to extract and structure data. DO NOT analyze, judge, or evaluate the candidate.

// DEFINITION: 
// An Atomic Evidence Unit (AEU) is a single, verifiable, standalone fact.

// STRICT INSTRUCTIONS:
// 1. EXTRACTION ONLY: Your job is to mirror the CV data into a structured format. Do not add external opinions.
// 2. ATOMICITY: Each AEU must represent ONLY ONE fact (e.g., one specific responsibility, one skill, one date).
// 3. SENIORITY SIGNALS: Explicitly extract signals of seniority (e.g., "Led a team of 5", "Managed $1M budget", "7+ years experience", "VP level").
// 4. INFERENCES: If a fact is not explicitly stated but logical (e.g., inferring 'Senior' from 10 years experience), mark it with "isInferred": true. Otherwise, "isInferred": false.
// 5. CONFIDENCE: Provide a "confidenceScore" (0.0 to 1.0) for every AEU based on how explicitly it is stated in the text.
// 6. PILLS: Categorize every AEU into one of three pillars: Identity, Work, or Composition.

// OUTPUT STRUCTURE:
// {
//   "aeuList": [
//     { 
//       "id": "aeu-1", 
//       "pillar": "work", 
//       "fact": "Role: Senior Developer at TechCorp (2019-2023)", 
//       "isInferred": false, 
//       "confidenceScore": 1.0,
//       "senioritySignal": true
//     },
//     { 
//       "id": "aeu-2", 
//       "pillar": "composition", 
//       "fact": "Expertise in distributed systems architecture", 
//       "isInferred": true, 
//       "confidenceScore": 0.8,
//       "senioritySignal": false
//     }
//   ],
//   "structured": {
//     "identity": { "fullName": "", "email": "", "phone": "", "dob": "" },
//     "work": {
//       "experience": [{ "title": "", "company": "", "duration": "", "description": "", "senioritySignals": [] }],
//       "projects": [{ "name": "", "description": "" }]
//     },
//     "composition": {
//       "education": [{ "degree": "", "institution": "", "duration": "" }],
//       "skills": { "technical": [], "soft": [] },
//       "senioritySummary": ""
//     }
//   }
// }

// CRITICAL: The aeuList must contain EVERY detail from the CV broken down into atomic units.
// `;
const AEU_SCHEMA_PROMPT = `Act as a High-Speed CV Extractor.
Goal: Complete extraction into structured JSON. Maintain <10s speed.

STRICT RULES:
1. SKILLS: Extract EVERY technical and soft skill. Do NOT truncate or skip the skills list.
2. EXPERIENCE: Titles must NOT be null. If a job title is missing in the experience section, infer it from the profile (e.g., "Android Developer").
3. MANDATORY INF: Include all 5 AEU_INF_... units (Seniority, Years, Status, Domain, Edu).
4. SPEED: Keep project descriptions to 1-2 concise sentences. Do NOT copy long paragraphs.
5. aeuList: Include unique facts for Identity, Work, Comp, and Inferred.
6. VALIDATION: Check if the text is clearly a CV/Resume (contains names, experience, education, or skills). If it is a DIFFERENT type of document (bank statement, book, invoice, story, etc.), set "isCv": false in the root. Otherwise true.
7. Return VALID JSON ONLY.

STRICT OUTPUT FORMAT:
{
  "aeuList": [
    { "id": "AEU_IDENTITY_001", "pillar": "identity", "fact": "Name: [Name]", "isInferred": false, "confidenceScore": 1.0 },
    { "id": "AEU_INF_001", "pillar": "inferred", "fact": "Seniority Level: [Level]", "isInferred": true, "inferenceReason": "Reason", "confidenceScore": 0.8 },
    { "id": "AEU_INF_002", "pillar": "inferred", "fact": "Total Experience Years: [Num]", "isInferred": false, "confidenceScore": 1.0 },
    { "id": "AEU_INF_003", "pillar": "inferred", "fact": "Employment Status: [Status]", "isInferred": true, "confidenceScore": 0.9 },
    { "id": "AEU_INF_004", "pillar": "inferred", "fact": "Domain Indicator: [Domain]", "isInferred": true, "confidenceScore": 0.9 },
    { "id": "AEU_INF_005", "pillar": "inferred", "fact": "Highest Education Level: [Level]", "isInferred": false, "confidenceScore": 1.0 }
  ],
  "structured": {
    "identity": { "fullName": "", "email": "", "phone": "", "location": "", "currentRoleTitle": "" },
    "work": {
      "experience": [ { "title": "", "company": "", "duration": "", "description": "" } ],
      "projects": [ { "name": "", "techStack": [], "description": "" } ]
    },
    "composition": {
      "education": [ { "degree": "", "institution": "", "startYear": "", "endYear": "" } ],
      "skills": { "technical": [], "soft": [], "languagesSpoken": [] },
      "certifications": [],
      "training": [ { "courseName": "", "institution": "", "duration": "" } ],
      "senioritySummary": ""
    },
    "inferred": { "seniorityLevel": "", "totalExperienceYears": 0, "employmentStatus": "", "companySize": "", "domainIndicator": "", "highestEducationLevel": "", "seniorityConfidence": 0.9, "senioritySummary": "" }
  },
  "isCv": true
}
Return VALID JSON ONLY.`;

/**
 * Standardize output format (Supports both old flat and new AEU-centric output)
 */
const standardizeAeuResponse = (jsonData, duration, modelUsed) => {
    const rawStructured = jsonData.structured || jsonData;
    const standardized = {
        aeuList: Array.isArray(jsonData.aeuList) ? jsonData.aeuList : [],
        structured: {
            identity: rawStructured.identity || rawStructured.personal || {},
            work: {
                experience: rawStructured.work?.experience || rawStructured.experience || [],
                projects: rawStructured.work?.projects || rawStructured.projects || []
            },
            composition: {
                education: Array.isArray(rawStructured.composition?.education || rawStructured.education)
                    ? (rawStructured.composition?.education || rawStructured.education)
                    : [],
                skills: {
                    technical: Array.isArray(rawStructured.composition?.skills?.technical || rawStructured.skills?.technical)
                        ? (rawStructured.composition?.skills?.technical || rawStructured.skills?.technical)
                        : [],
                    soft: Array.isArray(rawStructured.composition?.skills?.soft || rawStructured.skills?.soft)
                        ? (rawStructured.composition?.skills?.soft || rawStructured.skills?.soft)
                        : [],
                    languagesSpoken: Array.isArray(rawStructured.composition?.skills?.languagesSpoken || rawStructured.skills?.languagesSpoken || rawStructured.composition?.languagesSpoken || rawStructured.languagesSpoken)
                        ? (rawStructured.composition?.skills?.languagesSpoken || rawStructured.skills?.languagesSpoken || rawStructured.composition?.languagesSpoken || rawStructured.languagesSpoken)
                        : []
                },
                certifications: Array.isArray(rawStructured.composition?.certifications || rawStructured.certifications)
                    ? (rawStructured.composition?.certifications || rawStructured.certifications)
                    : [],
                senioritySummary: rawStructured.composition?.senioritySummary || rawStructured.senioritySummary || ""
            }
        },
        parsingDuration: `${duration}s`,
        modelUsed: modelUsed,
        isCv: jsonData.isCv !== undefined ? jsonData.isCv : true // Default to true if not explicitly false
    };

    // Extra polish: ensure identity fields are top-level if nested in response
    if (rawStructured.fullName && !standardized.structured.identity.fullName) standardized.structured.identity.fullName = rawStructured.fullName;
    if (rawStructured.email && !standardized.structured.identity.email) standardized.structured.identity.email = rawStructured.email;

    // STEP: Finalize (Age, Timing, etc.)
    const finalIdentity = standardized.structured.identity || {};
    if (finalIdentity.dob) {
        const birthDate = new Date(finalIdentity.dob);
        if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            finalIdentity.age = age > 0 ? age : null;
        }
    }
    standardized.structured.identity = { ...standardized.structured.identity, ...finalIdentity };

    return standardized;
};

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
    console.time("File_Extraction");
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
        console.timeEnd("File_Extraction");
        return result;
    } catch (error) {
        try { console.timeEnd("File_Extraction"); } catch (e) { }
        console.error("File Extraction Error:", error);
        throw new Error("Failed to extract text: " + error.message);
    }
};

/**
 * Neural Text Healer: Collapses noise and fixes whitespace for cleaner AI context.
 */
const neuralHealer = (text) => {
    if (!text) return "";
    return text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Strip binary garbage
        .replace(/\s{2,}/g, " ") // Collapse excessive spaces
        .trim();
};

const TURBO_SCHEMA_PROMPT = `CV to AEU JSON. 
Facts must be atomic. IDs: AEU_IDENTITY_001, AEU_WORK_001, etc.
Output only JSON.`;

/**
 * OpenAI Parser (Smart-Speed: Dual-Engine vs Single-Pass)
 */
const parseWithOpenAI = async (text, fileName) => {
    console.time("OpenAI_Model_Time");
    const startTime = Date.now();
    try {
        const cleanText = neuralHealer(text).slice(0, MAX_CHARS);
        const charCount = cleanText.length;

        let resultData;
        let modelType = "";

        if (charCount < 5000) {
            console.log(`[AI Parser] Using Hyper-Speed (Instant Pass): ${charCount} chars...`);
            modelType = "gpt-4o-mini (Turbo)";
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: TURBO_SCHEMA_PROMPT + "\n\n" + AEU_SCHEMA_PROMPT },
                    { role: "user", content: `Text:\n${cleanText}` }
                ],
                response_format: { type: "json_object" }, // Ensures valid JSON structure
                temperature: 0,
                max_tokens: 1500, // Increased to prevent truncation errors
            });

            try {
                resultData = JSON.parse(response.choices[0].message.content.trim());
            } catch (jsonErr) {
                console.error("[AI Parser] Turbo JSON Parse Error. Retrying with loose mode.");
                // Loose recovery if JSON mode fails for some reason
                let content = response.choices[0].message.content.trim();
                if (content.startsWith("```json")) content = content.replace(/```json|```/g, "").trim();
                resultData = JSON.parse(content);
            }
        } else {
            console.log(`[AI Parser] Using Accuracy-Mode: Dual-Specialist (${charCount} chars)...`);
            modelType = "gpt-4o (Dual-Specialist)";
            const [backgroundPart, projectsPart] = await Promise.all([
                // Specialist 1: Identity & Background
                openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: AEU_SCHEMA_PROMPT },
                        { role: "user", content: `Focus: IDENTITY, EXPERIENCE, SKILLS. Extract Name, Contact, and ALL Job Experience entries. Transcription:\n${cleanText}` }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                }),
                // Specialist 2: Projects Only (Exhaustive)
                openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: AEU_SCHEMA_PROMPT },
                        { role: "user", content: `Focus: ALL PROJECTS. Search for every project listed in the CV. Extract EVERY SINGLE ONE. Transcription:\n${cleanText}` }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0,
                })
            ]);

            const bgJson = JSON.parse(backgroundPart.choices[0].message.content);
            const projJson = JSON.parse(projectsPart.choices[0].message.content);

            resultData = {
                identity: bgJson.identity || {},
                work: {
                    experience: bgJson.work?.experience || bgJson.experience || [],
                    projects: projJson.work?.projects || projJson.projects || []
                },
                composition: bgJson.composition || {
                    education: bgJson.education || [],
                    skills: bgJson.skills || {},
                    languages: bgJson.languages || []
                }
            };
        }

        const duration = (Date.now() - startTime) / 1000;
        const result = standardizeAeuResponse(resultData, duration, modelType);

        console.timeEnd("OpenAI_Model_Time");
        return result;
    } catch (error) {
        console.error("[AI Parser] OpenAI Error:", error.message);
        return null;
    }
};

/**
 * Gemini Parser (Bulk / Cheap)
 */
const parseWithGemini = async (text, fileName) => {
    console.time("Gemini_Model_Time");
    const startTime = Date.now();
    try {
        console.log("[AI Parser] Using Gemini 2.0 Flash for extraction...");

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.0,
                maxOutputTokens: 2000,
            }
        });

        const prompt = `${AEU_SCHEMA_PROMPT}\n\nResume Content:\n${text}\n\nCRITICAL: Return ONLY valid JSON matching the schema precisely.`;

        // ✅ Optimized Retry Logic for Paid Tier (Short wait)
        let result = null;
        let attempts = 0;
        const maxAttempts = 2; // Simple 1-time retry is usually enough for paid burst limits

        while (attempts < maxAttempts) {
            try {
                attempts++;
                result = await model.generateContent(prompt);
                break; // Success!
            } catch (err) {
                const isRateLimit = err.message?.includes('429') || err.message?.includes('Resource exhausted');
                if (isRateLimit && attempts < maxAttempts) {
                    const waitTime = 1000; // Just 1 second is enough for paid tier recovery
                    console.warn(`[AI Parser] Gemini 429 detected. Retrying in ${waitTime}ms...`);
                    await sleep(waitTime);
                    continue;
                }
                throw err;
            }
        }

        const response = await result.response;

        // Safety check for empty or blocked response
        if (!response) {
            throw new Error("Empty response from Gemini");
        }

        let cleanText = "";
        try {
            cleanText = response.text().trim();
        } catch (textErr) {
            console.error("[AI Parser] Gemini Response Error (possibly blocked):", textErr.message);
            // Fallback: check if there's a reason for failure
            const candidates = response.candidates || [];
            if (candidates.length > 0 && candidates[0].finishReason) {
                throw new Error(`Gemini failed to generate content. Reason: ${candidates[0].finishReason}`);
            }
            throw textErr;
        }

        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/```json|```/g, '').trim();
        }

        const duration = (Date.now() - startTime) / 1000;
        console.timeEnd("Gemini_Model_Time");
        console.log(`[AI Parser] Gemini finished in ${duration}s`);

        let jsonData;
        try {
            jsonData = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error("[AI Parser] Gemini returned invalid JSON. Content preview:", cleanText.substring(0, 100));
            throw new Error("Failed to parse Gemini JSON response");
        }

        return standardizeAeuResponse(jsonData, duration, "gemini-2.0-flash");
    } catch (error) {
        try { console.timeEnd("Gemini_Model_Time"); } catch (e) { }
        const duration = (Date.now() - startTime) / 1000;
        console.error(`[AI Parser] Gemini Error after ${duration}s:`, error.message);
        return null;
    }
};

/**
 * Smart Router Logic
 */
const smartCVParser = async (buffer, fileName, mimetype) => {
    console.time("Total_Pipeline_Time");
    const totalStartTime = Date.now();
    let result = null;

    console.log(`[AI Parser] Starting extraction...`);

    // 1. Extract text ONCE
    const rawText = await extractTextFromFile(buffer, mimetype);

    // Aggressive Cleaning
    const cleanedText = cleanCVText(rawText);
    const trimmedText = cleanedText.length > MAX_CHARS ? cleanedText.slice(0, MAX_CHARS) : cleanedText;

    // Use Gemini 2.0 Flash (Fastest + Highest priority for Hawksyn)
    result = await parseWithGemini(trimmedText, fileName);

    // If Gemini fails, fallback to OpenAI Hyper-Speed
    if (!result) {
        console.warn("[AI Parser] Gemini failed. Falling back to OpenAI Turbo...");
        result = await parseWithOpenAI(trimmedText, fileName);
    }

    const totalDuration = (Date.now() - totalStartTime) / 1000;
    if (result) result.totalPipelineDuration = `${totalDuration}s`;

    return result;
};

module.exports = { smartCVParser, parseWithOpenAI, parseWithGemini, extractTextFromFile, cleanCVText };
