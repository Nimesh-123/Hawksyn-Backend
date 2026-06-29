const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Isolate these instances specifically for HIP
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Isolated AI Provider for Hawksyn Intelligence Profile (HIP)
 * Defaults to Gemini, explicitly calls claude-sonnet-4-6 if requested.
 */
async function generateJSON(prompt, systemPrompt, options = {}) {
    const startTime = Date.now();
    const { model, maxTokens } = options;

    // 1. Attempt Claude if requested
    if (model && model.toLowerCase().includes('claude')) {
        try {
            const claudeModel = 'claude-sonnet-4-6'; // The specific model requested by user
            console.log(`[HIP-AI] ⚡ Attempting isolated Anthropic (${claudeModel})...`);

            let safePrompt = prompt;
            if (!safePrompt || safePrompt.trim() === '') {
                safePrompt = "Please generate the JSON output according to the system prompt instructions.";
            }

            const message = await anthropic.messages.create({
                model: claudeModel,
                max_tokens: maxTokens || 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: safePrompt }]
            });

            const raw = message.content[0].text;
            const data = parseCleanJSON(raw, `Anthropic-${claudeModel}`);
            const duration = (Date.now() - startTime) / 1000;

            return {
                data,
                provider: `Anthropic-${claudeModel}`,
                duration: `${duration}s`
            };
        } catch (claudeErr) {
            console.warn(`[HIP-AI] ⚠️ Claude failed (${claudeErr.message}). Falling back to Gemini...`);
            // Flow will continue to Gemini block
        }
    }

    // 2. Default / Fallback to Gemini
    try {
        console.log(`[HIP-AI] 🤖 Attempting isolated Gemini (gemini-2.5-flash)...`);
        const genModel = gemini.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: maxTokens || 4000,
                responseMimeType: "application/json"
            }
        });

        const fullPrompt = `${systemPrompt}\n\nUser Request:\n${prompt}`;
        const result = await genModel.generateContent(fullPrompt);
        const response = await result.response;
        const raw = response.text();

        const data = parseCleanJSON(raw, 'Gemini-2.5-Flash');
        const duration = (Date.now() - startTime) / 1000;

        return {
            data,
            provider: 'Gemini-2.5-Flash',
            duration: `${duration}s`
        };
    } catch (geminiErr) {
        console.error(`[HIP-AI] ❌ CRITICAL: Gemini also failed for this section.`, geminiErr.message);
        throw new Error(`AI Pipeline Failed: Both Claude & Gemini rejected the prompt. Reason: ${geminiErr.message}`);
    }
}

/**
 * Helper to strip markdown and parse JSON
 */
function parseCleanJSON(raw, providerName) {
    try {
        let startObj = raw.indexOf('{');
        let startArr = raw.indexOf('[');
        let start = -1;
        let end = -1;

        if (startObj !== -1 && startArr !== -1) {
            start = Math.min(startObj, startArr);
            end = start === startObj ? raw.lastIndexOf('}') : raw.lastIndexOf(']');
        } else if (startObj !== -1) {
            start = startObj;
            end = raw.lastIndexOf('}');
        } else if (startArr !== -1) {
            start = startArr;
            end = raw.lastIndexOf(']');
        }

        if (start === -1 || end === -1) {
            console.error(`[HIP-AI] ❌ RAW OUTPUT (${providerName}):\n${raw}\n----------------`);
            try {
                fs.appendFileSync('ai_failures.log', `\n\n--- FAILED ${providerName} ---\n${raw}\n------------------`);
            } catch (e) { }
            throw new Error('No JSON block found in response');
        }

        const jsonBlock = raw.substring(start, end + 1);
        // Replace trailing commas before closing braces/brackets
        const cleanJson = jsonBlock.replace(/,\s*([\]}])/g, '$1');

        const parsed = JSON.parse(cleanJson);
        console.log(`[HIP-AI] ✅ Success via ${providerName}`);
        return parsed;
    } catch (err) {
        console.error(`[HIP-AI] ❌ Failed to parse JSON from ${providerName}`);
        throw new Error(`Invalid JSON: ${err.message}`);
    }
}

module.exports = {
    generateJSON
};
