const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: false,
            trim: true,
            lowercase: true
        },
        whatsappNumber: {
            type: String,
            required: false,
            trim: true
        },
        otp: {
            type: String,
            required: true
        },
        isUsed: {
            type: Boolean,
            default: false    
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
