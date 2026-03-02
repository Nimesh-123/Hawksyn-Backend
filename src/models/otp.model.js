const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
    {
        
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        otp: {
            type: String,
            required: true
        },
        isUsed: {
            type: Boolean,
            default: false    // ✅ Sirf ye rakhna zaruri hai
        },
        failCount: {
            type: Number,
            default: 0
        },
        expiresAt: {
            type: Date,
            required: true
        }
    },
    { timestamps: true }
);

// TTL index — auto delete after expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1 });

module.exports = mongoose.model('OTP', otpSchema);