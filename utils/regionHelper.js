// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — Region & Currency Helper
// File: utils/regionHelper.js
// ═══════════════════════════════════════════════════════════════════

const geoip = require('geoip-lite');

/**
 * Detects country and currency from IP address
 * @param {string} ip - User's current IP address
 * @returns {object} { country: 'IN', currency: 'INR', gateway: 'RAZORPAY' }
 */
exports.detectRegionFromIP = (ip) => {
    // 1. IP Clean up (handle local dev cases)
    let cleanIp = ip;
    if (ip === '::1' || ip === '127.0.0.1' || ip.includes('::ffff:')) {
        // Mock a real IP for local development (defaults to India)
        cleanIp = '122.161.48.0';
    }

    // 2. Geolocation Lookup
    const geo = geoip.lookup(cleanIp);
    const countryCode = geo ? geo.country : 'IN'; // Default to India if not found

    // 3. Mapping Country to Currency/Gateway
    // Note: This can be expanded for more countries (US, GB, AE, etc.)
    let currency = 'USD';
    let gateway = 'STRIPE';

    if (countryCode === 'IN') {
        currency = 'INR';
        gateway = 'RAZORPAY';
    }

    return {
        countryCode,
        currency,
        gateway
    };
};
