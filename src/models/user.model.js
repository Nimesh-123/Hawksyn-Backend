const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        fullName: { type: String, trim: true },
        avatar: { type: String }, // User profile picture from Google/Social
        googleId: { type: String }, // Unique identifier for Google login
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        mPin: { type: String }, // Hashed 4-digit PIN
        wrongPinCount: { type: Number, default: 0 },
        isEmailVerified: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        isBlocked: { type: Boolean, default: false },
        mPinSet: { type: Boolean, default: false },
        role: { type: String, enum: ['user', 'admin', 'expert'], default: 'user' },
        
        // Multi-region Support (Auto-detected from IP)
        countryCode: { type: String, default: 'IN' }, 
        preferredCurrency: { type: String, default: 'INR' },
        
        refreshToken: { type: String } // Solution 1: Refresh Token support
    },
    { timestamps: true }
);
userSchema.index({ isDeleted: 1 });
userSchema.index({ isBlocked: 1 });

// ✅ PARTIAL UNIQUE INDEX: Allows multiple users with the same email 
// if they are deleted, but only one "Active" (non-deleted) user.
// This solves the reactivation/fresh-start data issue without losing history.
userSchema.index(
    { email: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { isDeleted: false } 
    }
);

module.exports = mongoose.model('User', userSchema);
