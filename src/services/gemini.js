const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log('✅ [Gemini Service] Loaded successfully with 2026 models (2.0/2.5)');

// Safety settings — BLOCK_NONE on all categories
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

async function callGemini(modelName, promptText, userInput, maxTokens, returnRaw = false) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    safetySettings: SAFETY_SETTINGS
  });

  // Force the token limit in the generationConfig inside the call
  const generationConfig = {
    temperature: 0.1, // Slightly higher than 0 to prevent "stuck" loops
    maxOutputTokens: maxTokens,
  };

  // Add a system-level instruction to the prompt itself to prevent truncation
  const finalPrompt = `
  IMPORTANT: Your output limit is ${maxTokens} tokens. 
  DO NOT cut off your response. 
  Complete the full JSON or text required.
  
  ${promptText}
  
  INPUT:
  ${userInput}
  `;

  let raw = "";
  let usage = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  try {
    const generatePromise = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        generationConfig
    });
    
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 60000)
    );
    
    const result = await Promise.race([generatePromise, timeoutPromise]);
    
    const response = await result.response;
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    
    usage = response.usageMetadata || usage;
    
    raw = response.text();
    console.log(`    Model: ${modelName} | Raw length: ${raw.length} | Finish: ${finishReason} | Tokens: ${usage.totalTokenCount}`);

    if (finishReason === 'SAFETY') {
      throw new Error('Gemini blocked response due to SAFETY filter');
    }

  } catch (err) {
    if (!raw && err.response) {
        try { raw = err.response.text(); } catch(e) {}
    }
    const finalErr = new Error(err.message);
    finalErr.raw = raw || "";
    throw finalErr;
  }

  const data = returnRaw ? raw : safeParseJSON(raw, modelName);
  return { data, usage };
}

function safeParseJSON(raw, modelName = '') {
  if (!raw || raw.trim().length === 0) {
    throw new Error(`Empty response from ${modelName}`);
  }

  let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e1) {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const sliced = clean.slice(firstBrace, lastBrace + 1);
        return JSON.parse(sliced);
      } catch (e2) {
         // Final fallback for truncated JSON: try to close it
         try {
            return JSON.parse(sliced + '"}');
         } catch(e3) {
            try { return JSON.parse(sliced + '}'); } catch(e4) {}
         }
      }
    }
    const err = new Error(`JSON parse failed: ${e1.message}`);
    err.raw = raw;
    throw err;
  }
}

async function callWithRetry(modelName, promptText, userInput, maxTokens, returnRaw = false, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await callGemini(modelName, promptText, userInput, maxTokens, returnRaw);
    } catch (err) {
      if (err.message.includes('SAFETY')) throw err;
      
      if (attempt < retries) {
        // Exponential backoff for 429s or other transient errors
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`    Attempt ${attempt} failed: ${err.message}`);
        if (err.raw) {
            console.log(`    [DEBUG] Raw preview (Last 200 chars): "${err.raw.substring(err.raw.length - 200)}"`);
        }
        console.log(`    Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw new Error('ESCALATE_TO_HUMAN');
}

async function callGeminiFlash(promptText, userInput, maxTokens = 8000) {
  return callWithRetry('gemini-2.0-flash', promptText, userInput, maxTokens, false);
}

async function callGeminiPro(promptText, userInput, maxTokens = 8000) {
  return callWithRetry('gemini-2.0-flash', promptText, userInput, maxTokens, false);
}

async function callGeminiFlashRaw(promptText, userInput, maxTokens = 16000) {
  return callWithRetry('gemini-2.0-flash', promptText, userInput, maxTokens, true);
}

module.exports = { callGeminiFlash, callGeminiPro, callGeminiFlashRaw };
