/**
 * Hawksyn AI Cost Calculator
 * Standardized pricing for LLM providers used in audit logs.
 * Prices are in USD per 1 Million Tokens.
 */

const PRICING_MAP = {
    'Anthropic-Haiku': { input: 0.25, output: 1.25 },
    'Anthropic-Sonnet': { input: 3.00, output: 15.00 },
    'Gemini': { input: 0.15, output: 0.60 },
    'OpenAI': { input: 2.50, output: 10.00 },
    'Default': { input: 1.00, output: 4.00 }
};
const USD_TO_INR_RATE = 83.5;

/**
 * Calculate cost for an AI call
 * @param {string} provider - Provider string (e.g., 'Anthropic-Haiku', 'Gemini')
 * @param {object} usage - { promptTokens, completionTokens }
 * @returns {number} - Cost in USD
 */
exports.calculateAICost = (provider = 'Default', usage = {}) => {
    if (!usage || !usage.promptTokens) return 0;

    // Standardize provider name to match map
    let key = 'Default';
    if (provider.includes('Haiku')) key = 'Anthropic-Haiku';
    else if (provider.includes('Sonnet')) key = 'Anthropic-Sonnet';
    else if (provider.includes('Gemini')) key = 'Gemini';
    else if (provider.includes('OpenAI') || provider.includes('gpt')) key = 'OpenAI';

    const rates = PRICING_MAP[key] || PRICING_MAP['Default'];
    
    const inputCost = (usage.promptTokens / 1000000) * rates.input;
    const outputCost = (usage.completionTokens / 1000000) * rates.output;

    return parseFloat((inputCost + outputCost).toFixed(6));
};

/**
 * Helper to extract tokens from various metadata formats
 */
exports.extractUsage = (metadata) => {
    if (!metadata) return { promptTokens: 0, completionTokens: 0 };
    
    // Check nested structures
    const usage = metadata.tokenUsage || metadata.usage || metadata;
    
    return {
        promptTokens: usage.promptTokens || usage.input_tokens || usage.promptTokenCount || usage.total_tokens_input || 0,
        completionTokens: usage.completionTokens || usage.output_tokens || usage.candidatesTokenCount || usage.total_tokens_output || 0
    };
};

/**
 * Convert USD to local currency
 */
exports.convertToLocalCurrency = (usdAmount, currency = 'USD') => {
    if (currency === 'INR') {
        return {
            amount: parseFloat((usdAmount * USD_TO_INR_RATE).toFixed(4)),
            currency: 'INR',
            rate: USD_TO_INR_RATE
        };
    }
    return {
        amount: usdAmount,
        currency: 'USD',
        rate: 1
    };
};
