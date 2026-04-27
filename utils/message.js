const MESSAGES = {
    // Basic
    1001: 'Success',
    1003: 'Missing required parameters',

    // Login & Account
    2001: 'Login successfully',
    2002: 'Account deleted successfully',
    2003: 'OTP sent successfully',
    2004: 'OTP verified successfully',
    2005: 'M-PIN set successfully',
    2006: 'Account blocked due to multiple failed attempts',

    // user
    3001: 'User not Found',
    3002: 'Invalid OTP',
    3003: 'OTP expired',
    3004: 'Invalid M-PIN',
    3005: 'M-PIN does not match',
    3006: 'Email already exists',
    3007: 'Account is deleted',
    3008: 'Account is blocked',

    // api error
    9999: 'Something went wrong !!',
    4444: 'Access denied for this route',
    1002: 'Invalid token',
    3009: 'Invalid CV Document',
    3010: 'Run not found',
    3011: 'Report not yet generated',
    3012: 'Resource not found',
    3013: 'This PIN is too common. Please choose a more secure one.'
};

const get_message = message_code => {
    if (isNaN(message_code)) {
        return message_code;
    }
    return message_code ? MESSAGES[message_code] : message_code;
};

module.exports = { get_message };
