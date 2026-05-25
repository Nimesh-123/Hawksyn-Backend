const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
    {
        username: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['admin', 'sub_admin'], default: 'sub_admin' },
        refreshToken: { type: String },
        twoFactorSecret: { type: String, default: null },
        isTwoFactorEnabled: { type: Boolean, default: false },
        twoFactorBackupCodes: { type: [String], default: [] }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
