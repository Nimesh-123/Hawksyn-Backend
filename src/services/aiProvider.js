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

const { aiSemaphore } = require('../../utils/concurrency.js');
const modelFamily = 'claude-haiku-4-5-20251001';

/**
 * Universal JSON LLM Caller
 * Returns parsed JSON from whichever provider succeeds.
 * 
 * @param {string} prompt - The prompt to send
 * @param {string} systemPrompt - Optional system prompt
 * @param {object} options - Options including { model, temperature, maxTokens, forceProvider }
 * @returns {Promise<Object>} - Parsed JSON response including duration & usage
 */
async function generateJSON(prompt, systemPrompt = 'You are a JSON-only responder. Return only valid JSON. No markdown. No explanation.', options = {}) {
    await aiSemaphore.acquire();
    try {
        return await _executeGenerateJSON(prompt, systemPrompt, options);
    } finally {
        aiSemaphore.release();
    }
}

async function _executeGenerateJSON(prompt, systemPrompt, options = {}) {
    const startTime = Date.now();
    const { model, maxTokens, forceProvider } = options;

    // --- Step 0: Dynamic Model Selection (from Admin Config) ---
    if (model) {
        try {
            console.log(`[AI-Provider] ⚡ DYNAMIC: Attempting ${model}...`);
            
            if (model.includes('gpt')) {
                const response = await openai.chat.completions.create({
                    model: model,
                    max_tokens: maxTokens || 4000,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: "json_object" }
                });

                const raw = response.choices[0].message.content || '';
                const data = parseCleanJSON(raw, 'OpenAI-Dynamic');
                const duration = (Date.now() - startTime) / 1000;
                return {
                    data,
                    usage: {
                        promptTokens: response.usage?.prompt_tokens || 0,
                        completionTokens: response.usage?.completion_tokens || 0,
                        totalTokens: response.usage?.total_tokens || 0
                    },
                    provider: `OpenAI-${model}`,
                    duration: `${duration}s`
                };
            } else if (model.includes('claude')) {
                const message = await anthropic.messages.create({
                    model: model,
                    max_tokens: maxTokens || 4096,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }]
                });

                const raw = message.content[0].text;
                const data = parseCleanJSON(raw, 'Anthropic-Dynamic');
                const duration = (Date.now() - startTime) / 1000;
                return {
                    data,
                    usage: {
                        promptTokens: message.usage?.input_tokens || 0,
                        completionTokens: message.usage?.output_tokens || 0,
                        totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
                    },
                    provider: `Anthropic-${model}`,
                    duration: `${duration}s`
                };
            } else if (model.includes('gemini')) {
                const genModel = gemini.getGenerativeModel({ 
                    model: model,
                    generationConfig: {
                        maxOutputTokens: maxTokens || 4000
                    }
                });
                const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
                const result = await genModel.generateContent(fullPrompt);
                const response = await result.response;
                const raw = response.text();

                const data = parseCleanJSON(raw, 'Gemini-Dynamic');
                const duration = (Date.now() - startTime) / 1000;
                return {
                    data,
                    usage: {
                        promptTokens: response.usageMetadata?.promptTokenCount || 0,
                        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                        totalTokens: response.usageMetadata?.totalTokenCount || 0
                    },
                    provider: `Gemini-${model}`,
                    duration: `${duration}s`
                };
            }
        } catch (err) {
            const errorReport = `Time: ${new Date().toISOString()}\nModel: ${model}\nStatus: ${err.status}\nMessage: ${err.message}\nType: ${err.type}\nStack: ${err.stack}\n`;
            try {
                fs.writeFileSync(path.join(__dirname, '../../CLAUDE_ERROR.txt'), errorReport);
            } catch (fsErr) {}

            console.error(`[AI-Provider] ❌ Dynamic model ${model} failed! (Logged to CLAUDE_ERROR.txt)`);
            console.error(`[AI-Provider] Error Detail:`, err.status, err.message, err.type);
            
            // If it's a 404 (Model Not Found), we should definitely skip to Gemini
            console.warn(`[AI-Provider] ⚠️ Falling back to Gemini...`);
            try {
                const modelObj = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
                const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
                const result = await modelObj.generateContent(fullPrompt);
                const response = await result.response;
                const raw = response.text();

                const data = parseCleanJSON(raw, 'Gemini-Fallback');
                const duration = (Date.now() - startTime) / 1000;
                return {
                    data,
                    usage: {
                        promptTokens: response.usageMetadata?.promptTokenCount || 0,
                        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                        totalTokens: response.usageMetadata?.totalTokenCount || 0
                    },
                    provider: 'Gemini-Fallback',
                    duration: `${duration}s`
                };
            } catch (geminiErr) {
                console.error(`[AI-Provider] ❌ Fallback failed: ${geminiErr.message}`);
            }
        }
    }

    // --- Fallback Chain (Default) ---
    if (!forceProvider || forceProvider === 'Gemini') {
        try {
            console.log(`[AI-Provider] ⚡ ${forceProvider ? 'FORCED' : 'DEFAULT'}: Attempting Gemini (Gemini-2.0-Flash)...`);
            const modelObj = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
            const result = await modelObj.generateContent(fullPrompt);
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

    // Claude 3.5 Haiku (Primary)
    try {
        console.log(`[AI-Provider] 🤖 Attempting Anthropic (Claude-3.5-Haiku) [High-Speed]...`);
        const message = await anthropic.messages.create({
            model: modelFamily,
            max_tokens: 8192,
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
        console.warn(`[AI-Provider] ⚠️ Anthropic Haiku failed (${err.status || 'ERROR'}): ${err.message}. Falling back to Gemini.`);

        // Gemini Flash (Fallback 1)
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

            // Claude 3.5 Sonnet (Fallback 2)
            try {
                console.log('[AI-Provider] 🤖 Attempting Anthropic (Claude-3-5-Sonnet) [High Accuracy]...');
                const message = await anthropic.messages.create({
                    model: "claude-sonnet-4-6",
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

                // OpenAI GPT-4o (Fallback 3)
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
        // Find the first '{' and the last '}' to extract ONLY the JSON block
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        
        if (start === -1 || end === -1) {
            throw new Error('No JSON block found in response');
        }

        const jsonBlock = raw.substring(start, end + 1);
        
        // Remove trailing commas which often break JSON.parse
        const cleanJson = jsonBlock.replace(/,\s*([\]}])/g, '$1');

        const parsed = JSON.parse(cleanJson);
        console.log(`[AI-Provider] ✅ Success via ${providerName} (Cleaned)`);
        return parsed;
    } catch (err) {
        console.error(`[AI-Provider] ❌ Failed to parse JSON from ${providerName}`);
        // console.debug('Raw response was:', raw); // Useful for extreme debugging
        throw new Error(`Invalid JSON response from ${providerName}: ${err.message}`);
    }
}

/**
 * Universal Text LLM Caller
 * Returns raw text from whichever provider succeeds.
 */
async function generateText(prompt, systemPrompt = 'You are a helpful assistant.', forceProvider = null) {
    await aiSemaphore.acquire();
    try {
        return await _executeGenerateText(prompt, systemPrompt, forceProvider);
    } finally {
        aiSemaphore.release();
    }
}

async function _executeGenerateText(prompt, systemPrompt, forceProvider) {
    const startTime = Date.now();

    // --- Step 0: PRIMARY PROVIDER ---
    if (!forceProvider || forceProvider === 'Gemini') {
        try {
            console.log(`[AI-Provider] ⚡ ${forceProvider ? 'FORCED' : 'DEFAULT'}: Attempting Gemini (Gemini-2.0-Flash) [Text]...`);
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
        console.log(`[AI-Provider] 🤖 Attempting Anthropic (${modelFamily}) [Text]...`);
        const message = await anthropic.messages.create({
            model: modelFamily,
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
                    model: 'claude-sonnet-4-6',
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
