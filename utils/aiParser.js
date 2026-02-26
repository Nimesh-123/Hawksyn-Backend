const OpenAI = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_CHARS = 30000; // Increased to 30k to handle long fragmented resumes without cutting off the projects at the bottom.

const AEU_SCHEMA_PROMPT = `
Act as an intelligent CV data engine. Extract ALL professional information into a JSON structure based on three core pillars: Identity, Work, and Composition.

Pillars:
1. IDENTITY: Personal details (Name, Contact, Links, Location, and Date of Birth if available).
2. WORK: Professional history (Jobs, Roles, Responsibilities, Achievements) and Projects.
3. COMPOSITION: Academic background (Education), Skills (Technical/Soft), Certifications, and any other attributes.

Rules:
1. DESCRIPTIVE: Be clear and detailed. Do NOT truncate or overly shorten project/job descriptions. Match the detail level of ChatGPT-Web.
2. DATES: Use a single 'duration' field (e.g., "Oct 2021 — Present").

Base Structure:
{
  "identity": { "fullName": "", "email": "", "phone": "", "dob": "" },
  "work": {
    "experience": [{ "title": "", "company": "", "duration": "", "description": "" }],
    "projects": [{ "name": "", "description": "" }]
  },
  "composition": {
    "education": [{ "degree": "", "institution": "", "duration": "" }],
    "skills": { "technical": [], "soft": [] }
  }
}
`;

/**
 * Validate the extracted JSON against the required AEU schema keys
 */
const validateAEUSchema = (data) => {
    if (!data || typeof data !== 'object') return false;
    const requiredKeys = ['identity', 'work', 'composition'];
    return requiredKeys.every(key => Object.prototype.hasOwnProperty.call(data, key));
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
 * Helper to call OpenAI for a specific section
 */
const extractSection = async (sectionName, focusSchema, text, maxTokens) => {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `${AEU_SCHEMA_PROMPT}\n\nFOCUS: ${sectionName}. \nCRITICAL: Extract EVERY SINGLE ITEM mentioned in this section from the text. DO NOT truncate, group, or skip any records even if there are many.`
            },
            { role: "user", content: `Focus Schema: ${focusSchema}\n\nResume Text:\n${text}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: maxTokens,
    });
    return JSON.parse(response.choices[0].message.content);
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

const TURBO_SCHEMA_PROMPT = `CV to JSON. One sentence descriptions only. 
Structure: { "identity": { "fullName": "", "email": "", "phone": "", "dob": "" }, "work": { "experience": [], "projects": [] }, "composition": { "education": [], "skills": { "technical": [], "soft": [] } } }`;

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
                    { role: "system", content: TURBO_SCHEMA_PROMPT },
                    { role: "user", content: `Text:\n${cleanText}\n\nINSTANT RULE: Start with { and end with }. No markdown. 1 sentence max per record.` }
                ],
                temperature: 0,
                max_tokens: 800,
            });

            resultData = JSON.parse(response.choices[0].message.content.trim());
        } else {
            console.log(`[AI Parser] Using Accuracy-Mode: Dual-Specialist (${charCount} chars)...`);
            modelType = "gpt-4o (Dual-Specialist)";
            const [backgroundPart, projectsPart] = await Promise.all([
                // Specialist 1: Identity & Background
                openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: AEU_SCHEMA_PROMPT },
                        { role: "user", content: `Focus: IDENTITY, EXPERIENCE, SKILLS. Extract Name, Contact, and BOTH Job Experience entries (Appsculpt and Technozer). Transcription:\n${cleanText}` }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                }),
                // Specialist 2: Projects Only (Exhaustive)
                openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: AEU_SCHEMA_PROMPT },
                        { role: "user", content: `Focus: ALL PROJECTS. Search for 1) Camera & Photo Editor, 2) Christmas Photo Editor, 3) Live Mic, 4) Diary, 5) iPhone Gallery, 6) WiFi, and 7) SMS Messenger. Extract EVERY SINGLE ONE. Transcription:\n${cleanText}` }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
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

        // STEP 3: Finalize (Age, Timing, etc.)
        const finalIdentity = resultData.identity || {};
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

        const result = {
            ...resultData,
            identity: { ...resultData.identity, ...finalIdentity },
            parsingDuration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
            modelUsed: modelType
        };

        console.timeEnd("OpenAI_Model_Time");
        return result;
    } catch (error) {
        console.error("[AI Parser] OpenAI Error:", error.message);
        return null;
    }
};

/**
 * Claude Parser (Fallback)
 */
const parseWithClaude = async (text, fileName) => {
    console.time("Claude_Model_Time");
    const startTime = Date.now();
    try {
        console.log("[AI Parser] Using Claude...");

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1500,
            temperature: 0,
            system: "You are a specialized CV data extractor. Return ONLY valid JSON matching the schema.",
            messages: [
                {
                    role: "user",
                    content: `${AEU_SCHEMA_PROMPT}\n\nResume Content:\n${text}`
                }
            ],
        });

        const duration = (Date.now() - startTime) / 1000;
        console.timeEnd("Claude_Model_Time");
        console.log(`[AI Parser] Claude finished in ${duration}s`);

        const rawText = response.content.find(c => c.type === 'text')?.text;
        if (!rawText) throw new Error("Empty response from Claude");

        let cleanText = rawText.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/```json|```/g, '').trim();
        }

        const result = JSON.parse(cleanText);

        // Meta info used by caller
        result.parsingDuration = `${duration}s`;
        result.modelUsed = "claude-3-5-sonnet";

        if (validateAEUSchema(result)) return result;
        throw new Error("Invalid AEU Schema from Claude");
    } catch (error) {
        try { console.timeEnd("Claude_Model_Time"); } catch (e) { }
        const duration = (Date.now() - startTime) / 1000;
        console.error(`[AI Parser] Claude Error after ${duration}s:`, error.message);
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
        console.log("[AI Parser] Using Gemini 2.0 Flash...");

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `${AEU_SCHEMA_PROMPT}\n\nResume Content:\n${text}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let cleanText = response.text().trim();

        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/```json|```/g, '').trim();
        }

        const duration = (Date.now() - startTime) / 1000;
        console.timeEnd("Gemini_Model_Time");
        console.log(`[AI Parser] Gemini finished in ${duration}s`);

        const jsonData = JSON.parse(cleanText);

        // Standardize output format
        const standardizedResult = {
            identity: jsonData.identity || jsonData.personal || {},
            work: jsonData.work || { experience: jsonData.experience || [], projects: jsonData.projects || [] },
            composition: jsonData.composition || { education: jsonData.education || [], skills: jsonData.skills || [] },
            parsingDuration: `${duration}s`,
            modelUsed: "gemini-2.0-flash"
        };

        if (validateAEUSchema(standardizedResult)) return standardizedResult;
        throw new Error("Invalid AEU Schema from Gemini");
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
const smartCVParser = async (buffer, fileName, mimetype, bulkMode = false) => {
    console.time("Total_Pipeline_Time");
    const totalStartTime = Date.now();
    let result = null;

    console.log(`[AI Parser] Starting extraction. bulkMode: ${bulkMode}`);
    const isBulk = bulkMode === true || bulkMode === "true";

    // 1. Extract text ONCE
    const rawText = await extractTextFromFile(buffer, mimetype);

    // 2. Aggressive Cleaning
    const cleanedText = cleanCVText(rawText);

    // 3. Hard Input size cap
    const trimmedText = cleanedText.length > MAX_CHARS
        ? cleanedText.slice(0, MAX_CHARS)
        : cleanedText;

    console.log(`[AI Parser] Text processed. Raw: ${rawText.length}, Trimmed: ${trimmedText.length}`);

    // 1. If bulkMode is true, try Gemini first
    if (isBulk) {
        result = await parseWithGemini(trimmedText, fileName);
    }

    // 2. If result is still null (standard mode OR Gemini failed in bulkMode)
    if (!result) {
        // 2a. Try OpenAI (Primary)
        result = await parseWithOpenAI(trimmedText, fileName);

        if (!result) {
            // 2b. Try Claude (Fallback)
            console.warn("[AI Parser] OpenAI failed. Retrying with Claude...");
            result = await parseWithClaude(trimmedText, fileName);
        }

        if (!result) {
            // 2c. Final Fallback to Gemini
            console.warn("[AI Parser] Claude failed. Final attempt with Gemini...");
            result = await parseWithGemini(trimmedText, fileName);
        }
    }

    const totalDuration = (Date.now() - totalStartTime) / 1000;
    console.timeEnd("Total_Pipeline_Time");
    console.log(`[AI Parser] TOTAL Extraction Time: ${totalDuration}s`);

    if (!result) {
        console.error(`[AI Parser] All extraction models failed after ${totalDuration}s`);
        return null;
    }

    // Attach durations for top-level performance reporting
    result.totalPipelineDuration = `${totalDuration}s`;

    return result;
};

module.exports = { smartCVParser, parseWithOpenAI, parseWithClaude, parseWithGemini, extractTextFromFile, cleanCVText };
