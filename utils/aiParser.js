const OpenAI = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const AEU_SCHEMA_PROMPT = `
Extract data from CV into structured JSON. Rules:
1. Return ONLY valid JSON. No markdown.
2. Use null for missing fields. Do not hallucinate.
3. Format:
{
  "personal": { "fullName": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "" },
  "education": [{ "degree": "", "institution": "", "startDate": "", "endDate": "" }],
  "experience": [{ "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "" }],
  "skills": { "languages": [], "frameworks": [], "tools": [], "other": [] },
  "projects": [{ "name": "", "description": "", "technologies": [] }],
  "meta": { "sourceFile": "", "parsedAt": "", "modelUsed": "" }
}
`;

/**
 * Validate the extracted JSON against the required AEU schema keys
 */
const validateAEUSchema = (data) => {
    if (!data || typeof data !== 'object') return false;
    const requiredKeys = ['personal', 'education', 'experience', 'skills', 'projects', 'meta'];
    return requiredKeys.every(key => Object.prototype.hasOwnProperty.call(data, key));
};

/**
 * Extract text from PDF buffer
 */
const extractTextFromPDF = async (buffer) => {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        console.error("PDF Parsing Error:", error);
        throw new Error("Failed to parse PDF text: " + error.message);
    }
};

/**
 * OpenAI Parser (Primary)
 */
const parseWithOpenAI = async (buffer, fileName) => {
    const startTime = Date.now();
    try {
        console.log("[AI Parser] Using OpenAI (Primary)...");
        const text = await extractTextFromPDF(buffer);

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a specialized CV data extractor. Return ONLY valid JSON matching the schema." },
                { role: "user", content: `${AEU_SCHEMA_PROMPT}\n\nResume Content:\n${text}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[AI Parser] OpenAI finished in ${duration}s`);

        const result = JSON.parse(response.choices[0].message.content);
        result.meta = {
            sourceFile: fileName,
            parsedAt: new Date().toISOString(),
            modelUsed: "gpt-4o-mini",
            parsingDuration: `${duration}s`
        };

        if (validateAEUSchema(result)) return result;
        throw new Error("Invalid AEU Schema from OpenAI");
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`[AI Parser] OpenAI Error after ${duration}s:`, error.message);
        return null;
    }
};

/**
 * Claude Parser (Fallback)
 */
const parseWithClaude = async (buffer, fileName) => {
    const startTime = Date.now();
    try {
        console.log("[AI Parser] Using Claude (Fallback)...");
        const base64PDF = buffer.toString('base64');

        const response = await anthropic.beta.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            temperature: 0,
            betas: ["pdfs-2024-09-25"],
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: {
                                type: "base64",
                                media_type: "application/pdf",
                                data: base64PDF,
                            },
                        },
                        {
                            type: "text",
                            text: AEU_SCHEMA_PROMPT
                        }
                    ],
                }
            ],
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[AI Parser] Claude finished in ${duration}s`);

        const rawText = response.content.find(c => c.type === 'text').text;
        const result = JSON.parse(rawText);

        result.meta = {
            sourceFile: fileName,
            parsedAt: new Date().toISOString(),
            modelUsed: "claude-3-5-sonnet",
            parsingDuration: `${duration}s`
        };

        if (validateAEUSchema(result)) return result;
        throw new Error("Invalid AEU Schema from Claude");
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`[AI Parser] Claude Error after ${duration}s:`, error.message);
        return null;
    }
};

/**
 * Gemini Parser (Bulk / Cheap)
 */
const parseWithGemini = async (buffer, fileName) => {
    const startTime = Date.now();
    try {
        console.log("[AI Parser] Using Gemini (Bulk/Cheap)...");
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = AEU_SCHEMA_PROMPT;
        const pdfPart = {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType: "application/pdf"
            }
        };

        const result = await model.generateContent([prompt, pdfPart]);
        const response = await result.response;
        let text = response.text().trim();

        if (text.startsWith('```')) {
            text = text.replace(/```json|```/g, '').trim();
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[AI Parser] Gemini finished in ${duration}s`);

        const jsonData = JSON.parse(text);
        jsonData.meta = {
            sourceFile: fileName,
            parsedAt: new Date().toISOString(),
            modelUsed: "gemini-1.5-flash",
            parsingDuration: `${duration}s`
        };

        if (validateAEUSchema(jsonData)) return jsonData;
        throw new Error("Invalid AEU Schema from Gemini");
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`[AI Parser] Gemini Error after ${duration}s:`, error.message);
        return null;
    }
};

/**
 * Smart Router Logic
 */
const smartCVParser = async (buffer, fileName, bulkMode = false) => {
    const totalStartTime = Date.now();
    let result = null;

    console.log(`[AI Parser] Starting extraction. bulkMode: ${bulkMode}`);
    const isBulk = bulkMode === true || bulkMode === "true";

    // 1. If bulkMode is true, try Gemini first
    if (isBulk) {
        result = await parseWithGemini(buffer, fileName);
    }

    // 2. If result is still null (standard mode OR Gemini failed in bulkMode)
    if (!result) {
        // 2a. Try OpenAI (Primary)
        result = await parseWithOpenAI(buffer, fileName);

        if (!result) {
            // 2b. Try Claude (Fallback)
            console.warn("[AI Parser] OpenAI failed. Retrying with Claude...");
            result = await parseWithClaude(buffer, fileName);
        }

        if (!result) {
            // 2c. Final Fallback to Gemini
            console.warn("[AI Parser] Claude failed. Final attempt with Gemini...");
            result = await parseWithGemini(buffer, fileName);
        }
    }

    const totalDuration = (Date.now() - totalStartTime) / 1000;
    console.log(`[AI Parser] TOTAL Extraction Time: ${totalDuration}s`);

    if (!result) {
        console.error(`[AI Parser] All extraction models failed after ${totalDuration}s`);
        return null;
    }

    if (result && result.meta) {
        result.meta.totalPipelineDuration = `${totalDuration}s`;
    }

    return result;
};

module.exports = { smartCVParser };
