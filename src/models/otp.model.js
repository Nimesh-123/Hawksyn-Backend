const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    otpHash: {
        type: String,
        required: true
    },
    failCount: {
        type: Number,
        default: 0
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: '5m' } // TTL index: documents expire 5 mins after this time
    }
}, { timestamps: true });

module.exports = mongoose.model('OTP', otpSchema);
