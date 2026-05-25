const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const langdetect = require('langdetect');

async function runLayer2(buffer, ext, pageCount) {
    let rawText = '';
    
    if (ext === 'pdf') {
        try {
            const pdfData = await pdfParse(buffer);
            rawText = pdfData.text || '';
            
            // Password protected PDF check
            if (rawText.trim().length === 0 && pdfData.info && pdfData.info.EncryptFilterName) {
                return { pass: false, ruleId: 'RJ_INT_005', layer: 'L2' };
            }
        } catch (err) {
            if (err.message && err.message.toLowerCase().includes('encrypted')) {
                return { pass: false, ruleId: 'RJ_INT_005', layer: 'L2' };
            }
            return { pass: false, ruleId: 'RJ_INT_003', layer: 'L2' };
        }
    } else {
        try {
            const result = await mammoth.extractRawText({ buffer });
            rawText = result.value || '';
        } catch (err) {
            return { pass: false, ruleId: 'RJ_INT_004', layer: 'L2' };
        }
    }
    
    rawText = rawText.trim();
    
    // Scanned image PDF — no text
    if (ext === 'pdf' && rawText.length === 0) {
        return { pass: false, ruleId: 'RJ_TXT_001', layer: 'L2' };
    }
    
    // Character per page ratio
    if (ext === 'pdf' && pageCount > 0) {
        const charPerPage = rawText.length / pageCount;
        if (charPerPage < 200) {
            return { pass: false, ruleId: 'RJ_TXT_004', layer: 'L2' };
        }
    }
    
    // Minimum character count
    if (rawText.length < 500) {
        return { pass: false, ruleId: 'RJ_TXT_003', layer: 'L2' };
    }
    
    // Maximum token count
    const estimatedTokens = Math.floor(rawText.length / 4);
    if (estimatedTokens > 25000) {
        return { pass: false, ruleId: 'RJ_TXT_006', layer: 'L2' };
    }
    
    // ─────────────────────────────────────────────
    // LANGUAGE DETECTION — RJ_LNG_001 / LNG_002 / LNG_003
    // ─────────────────────────────────────────────

    // Step 1: Clean text before language detection
    // Remove: PDF artifacts, code syntax, currency symbols, special chars
    // Keep: actual English words and sentences only
    const cleanTextForLang = rawText
      .replace(/\(cid:[0-9]+\)/g, ' ')          // remove PDF cid artifacts
      .replace(/[^\x00-\x7F]/g, ' ')            // remove all non-ASCII (₹ etc)
      .replace(/[<>{}[\]|\\\/=+*&^%$#@!`~]/g, ' ') // remove code syntax chars
      .replace(/\b\w+[<>]\w*\b/g, ' ')          // remove generic types like DataStream<String>
      .replace(/\s+/g, ' ')
      .trim();

    // Step 2: Use first 3000 chars of clean text for detection
    // Avoids being skewed by dense skill lists or code blocks at end of CV
    const textSample = cleanTextForLang.slice(0, 3000);

    // Step 3: RJ_LNG_001 — primary language check
    // Only reject if we have enough clean text to be confident
    if (textSample.length > 100) {
      try {
        const langdetect = require('langdetect');
        const detected = langdetect.detectOne(textSample);

        if (detected && detected !== 'en') {
          return {
            pass: false,
            ruleId: 'RJ_LNG_001',
            layer: 'L2'
          };
        }
      } catch (e) {
        // langdetect failed — do not block on detection failure
        // log warning and continue
        console.warn('langdetect failed, skipping language check:', e.message);
      }
    }

    // Step 4: RJ_LNG_003 — Non-Latin SCRIPT check
    // Only count actual non-Latin scripts — NOT symbols, currency, or code chars
    // Checks: Devanagari, Tamil, Telugu, Kannada, Malayalam, Bengali, Arabic, Chinese, Japanese, Korean
    const nonLatinScriptCount = rawText.split('').filter(c => {
      const code = c.charCodeAt(0);
      return (
        (code >= 0x0900 && code <= 0x097F) ||  // Devanagari (Hindi)
        (code >= 0x0B80 && code <= 0x0BFF) ||  // Tamil
        (code >= 0x0C00 && code <= 0x0C7F) ||  // Telugu
        (code >= 0x0C80 && code <= 0x0CFF) ||  // Kannada
        (code >= 0x0D00 && code <= 0x0D7F) ||  // Malayalam
        (code >= 0x0980 && code <= 0x09FF) ||  // Bengali
        (code >= 0x0600 && code <= 0x06FF) ||  // Arabic
        (code >= 0x4E00 && code <= 0x9FFF) ||  // Chinese
        (code >= 0x3040 && code <= 0x309F) ||  // Hiragana
        (code >= 0xAC00 && code <= 0xD7AF)     // Korean
      );
    }).length;

    const totalChars = rawText.replace(/\s/g, '').length;
    const nonLatinRatio = totalChars > 0 ? nonLatinScriptCount / totalChars : 0;

    // Threshold: 20% actual non-Latin script characters
    if (nonLatinRatio > 0.20) {
      return {
        pass: false,
        ruleId: 'RJ_LNG_003',
        layer: 'L2'
      };
    }

    // Step 5: RJ_LNG_002 — Mixed language check
    // Use clean text only (no symbols, no code, no artifacts)
    // Threshold raised to 50% — 30% was too strict for Indian CVs with:
    // domain terms, regulatory body names, South Indian names
    if (cleanTextForLang.length > 200) {
      try {
        const langdetect = require('langdetect');
        const allDetections = langdetect.detect(cleanTextForLang.slice(0, 5000));

        if (allDetections && allDetections.length > 0) {
          const englishScore = allDetections.find(d => d.lang === 'en')?.prob || 0;
          const nonEnglishRatio = 1 - englishScore;

          // Only reject if non-English probability is very high (> 50%)
          if (nonEnglishRatio > 0.50) {
            return {
              pass: false,
              ruleId: 'RJ_LNG_002',
              layer: 'L2'
            };
          }
        }
      } catch (e) {
        // Detection failed — do not block
        console.warn('langdetect mixed check failed, skipping:', e.message);
      }
    }

    // All language checks passed
    // ─────────────────────────────────────────────

    return { pass: true, rawText, charCount: rawText.length };
}

module.exports = { runLayer2 };
