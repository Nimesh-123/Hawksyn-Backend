const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        mPin: { type: String }, // Hashed 4-digit PIN
        wrongPinCount: { type: Number, default: 0 },
        isEmailVerified: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        isBlocked: { type: Boolean, default: false },
        isHost: { type: Boolean, default: false },
        role: { type: String, default: 'user' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
