// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Centralized AI Provider
// File: src/services/aiProvider.js
// 
// Logic: Claude Haiku (Primary) → Gemini (Fallback 1) → Claude Sonnet (Fallback 2) → OpenAI (Fallback 3)
// ═══════════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Universal JSON LLM Caller
 * Returns parsed JSON from whichever provider succeeds.
 * 
 * @param {string} prompt - The prompt to send
 * @param {string} systemPrompt - Optional system prompt
 * @param {string|null} [forceProvider=null] - Explicitly choose 'Gemini' or 'Anthropic'
 * @returns {Promise<Object>} - Parsed JSON response including duration & usage
 */
async function generateJSON(prompt, systemPrompt = 'You are a JSON-only responder. Return only valid JSON. No markdown. No explanation.', forceProvider = null) {
    const startTime = Date.now();

    // --- Step 0: FORCED PROVIDER (Optional) ---
    if (forceProvider === 'Gemini') {
        try {
            console.log('[AI-Provider] ⚡ FORCED: Attempting Gemini (Gemini-2.0-Flash)...');
            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const raw = response.text();

            const data = parseCleanJSON(raw, 'Gemini');
            const duration = (Date.now() - startTime) / 1000;
            return {
                data,
                usage: {
                    promptTokens: response.usageMetadata?.promptTokenCount || 0,
                    completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: response.usageMetadata?.totalTokenCount || 0
                },
                provider: 'Gemini',
                duration: `${duration}s`
            };
        } catch (err) {
            console.warn(`[AI-Provider] ⚠️ Forced Gemini failed: ${err.message}. Falling back to default chain.`);
        }
    }

    // --- Step 1: ANTHROPIC HAIKU (Primary - Claude-3-5-Haiku) ---
    try {
        console.log('[AI-Provider] 🤖 Attempting Anthropic (Claude-3-5-Haiku) [High-Speed]...');
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        });

        const raw = message.content[0].text;
        const data = parseCleanJSON(raw, 'Anthropic-Haiku');
        const duration = (Date.now() - startTime) / 1000;
        return {
            data,
            usage: {
                promptTokens: message.usage?.input_tokens || 0,
                completionTokens: message.usage?.output_tokens || 0,
                totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
            },
            provider: 'Anthropic-Haiku',
            duration: `${duration}s`
        };
    } catch (err) {
        console.warn(`[AI-Provider] ⚠️ Anthropic Haiku failed: ${err.message}. Falling back to Gemini.`);

        // --- Step 2: GEMINI (Fallback 1) ---
        try {
            console.log('[AI-Provider] 🤖 Attempting Gemini (Gemini-2.0-Flash)...');
            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const raw = response.text();

            const data = parseCleanJSON(raw, 'Gemini');
            const duration = (Date.now() - startTime) / 1000;
            return {
                data,
                usage: {
                    promptTokens: response.usageMetadata?.promptTokenCount || 0,
                    completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: response.usageMetadata?.totalTokenCount || 0
                },
                provider: 'Gemini',
                duration: `${duration}s`
            };
        } catch (geminiErr) {
            console.warn(`[AI-Provider] ⚠️ Gemini failed: ${geminiErr.message}. Falling back to Anthropic Sonnet.`);

            // --- Step 3: ANTHROPIC SONNET (Fallback 2) ---
            try {
                console.log('[AI-Provider] 🤖 Attempting Anthropic (Claude-3-5-Sonnet) [High Accuracy]...');
                const message = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 8192,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }]
                });

                const raw = message.content[0].text;
                const data = parseCleanJSON(raw, 'Anthropic-Sonnet');
                const duration = (Date.now() - startTime) / 1000;
                return {
                    data,
                    usage: {
                        promptTokens: message.usage?.input_tokens || 0,
                        completionTokens: message.usage?.output_tokens || 0,
                        totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
                    },
                    provider: 'Anthropic-Sonnet',
                    duration: `${duration}s`
                };
            } catch (sonnetErr) {
                console.warn(`[AI-Provider] ⚠️ Anthropic Sonnet failed: ${sonnetErr.message}`);

                // --- Step 4: OPENAI (Fallback 3) ---
                try {
                    console.log('[AI-Provider] 🤖 Attempting OpenAI (GPT-4o)...');
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        temperature: 0.2,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: "json_object" }
                    });

                    const raw = response.choices[0].message.content || '';
                    const data = parseCleanJSON(raw, 'OpenAI');
                    const duration = (Date.now() - startTime) / 1000;
                    return {
                        data,
                        usage: {
                            promptTokens: response.usage?.prompt_tokens || 0,
                            completionTokens: response.usage?.completion_tokens || 0,
                            totalTokens: response.usage?.total_tokens || 0
                        },
                        provider: 'OpenAI',
                        duration: `${duration}s`
                    };
                } catch (openaiErr) {
                    console.error('[AI-Provider] ❌ CRITICAL: All AI providers failed.');
                    throw new Error('All AI providers (Haiku, Gemini, Sonnet, OpenAI) failed to fulfill the request.');
                }
            }
        }
    }
}

/**
 * Helper to strip markdown and parse JSON
 */
function parseCleanJSON(raw, providerName) {
    try {
        const clean = raw
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        const parsed = JSON.parse(clean);
        console.log(`[AI-Provider] ✅ Success via ${providerName}`);
        return parsed;
    } catch (err) {
        console.error(`[AI-Provider] ❌ Failed to parse JSON from ${providerName}`);
        throw new Error(`Invalid JSON response from ${providerName}: ${err.message}`);
    }
}

/**
 * Universal Text LLM Caller
 * Returns raw text from whichever provider succeeds.
 */
async function generateText(prompt, systemPrompt = 'You are a helpful assistant.', forceProvider = null) {
    const startTime = Date.now();

    // --- Step 0: FORCED PROVIDER (Optional) ---
    if (forceProvider === 'Gemini') {
        try {
            console.log('[AI-Provider] ⚡ FORCED: Attempting Gemini (Gemini-2.0-Flash) [Text]...');
            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const duration = (Date.now() - startTime) / 1000;
            return {
                content: response.text(),
                usage: {
                    promptTokens: response.usageMetadata?.promptTokenCount || 0,
                    completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: response.usageMetadata?.totalTokenCount || 0
                },
                provider: 'Gemini',
                duration: `${duration}s`
            };
        } catch (err) {
            console.warn(`[AI-Provider] ⚠️ Forced Gemini failed: ${err.message}. Falling back to default chain.`);
        }
    }

    // --- Step 1: ANTHROPIC HAIKU (Primary) ---
    try {
        console.log('[AI-Provider] 🤖 Attempting Anthropic (Claude-3-5-Haiku) [Text]...');
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        });
        const duration = (Date.now() - startTime) / 1000;
        return {
            content: message.content[0].text,
            usage: {
                promptTokens: message.usage?.input_tokens || 0,
                completionTokens: message.usage?.output_tokens || 0,
                totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
            },
            provider: 'Anthropic-Haiku',
            duration: `${duration}s`
        };
    } catch (err) {
        console.warn(`[AI-Provider] ⚠️ Anthropic Haiku failed: ${err.message}`);

        // --- Step 2: GEMINI (Fallback 1) ---
        try {
            console.log('[AI-Provider] 🤖 Attempting Gemini (Gemini-2.0-Flash) [Text]...');
            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const duration = (Date.now() - startTime) / 1000;
            return {
                content: response.text(),
                usage: {
                    promptTokens: response.usageMetadata?.promptTokenCount || 0,
                    completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: response.usageMetadata?.totalTokenCount || 0
                },
                provider: 'Gemini',
                duration: `${duration}s`
            };
        } catch (geminiErr) {
            console.warn(`[AI-Provider] ⚠️ Gemini failed: ${geminiErr.message}`);

            // --- Step 3: ANTHROPIC SONNET (Fallback 2) ---
            try {
                console.log('[AI-Provider] 🤖 Attempting Anthropic (Claude-3-5-Sonnet) [Text]...');
                const message = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }]
                });
                const duration = (Date.now() - startTime) / 1000;
                return {
                    content: message.content[0].text,
                    usage: {
                        promptTokens: message.usage?.input_tokens || 0,
                        completionTokens: message.usage?.output_tokens || 0,
                        totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
                    },
                    provider: 'Anthropic-Sonnet',
                    duration: `${duration}s`
                };
            } catch (sonnetErr) {
                console.warn(`[AI-Provider] ⚠️ Anthropic Sonnet failed: ${sonnetErr.message}`);

                // --- Step 4: OPENAI (Fallback 3) ---
                try {
                    console.log('[AI-Provider] 🤖 Attempting OpenAI (GPT-4o) [Text]...');
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        temperature: 0.2,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt }
                        ]
                    });
                    const duration = (Date.now() - startTime) / 1000;
                    return {
                        content: response.choices[0].message.content || '',
                        usage: {
                            promptTokens: response.usage?.prompt_tokens || 0,
                            completionTokens: response.usage?.completion_tokens || 0,
                            totalTokens: response.usage?.total_tokens || 0
                        },
                        provider: 'OpenAI',
                        duration: `${duration}s`
                    };
                } catch (openaiErr) {
                    console.error('[AI-Provider] ❌ CRITICAL: All AI providers failed.');
                    throw new Error('All AI providers (Haiku, Gemini, Sonnet, OpenAI) failed to fulfill the request.');
                }
            }
        }
    }
}

module.exports = {
    generateJSON,
    generateText
};
