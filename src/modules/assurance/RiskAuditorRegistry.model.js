const mongoose = require('mongoose');

const RiskAuditorRegistrySchema = new mongoose.Schema({
    auditorId: { type: String, required: true, unique: true },
    auditorName: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Restore Required
    password: { type: String, required: true },           // Restore Required
    refreshToken: { type: String },
    caseCategories: { type: [String], default: [] },

    
    // --- Professional Profile ---
    designation: { type: String, trim: true },
    currentOrganization: { type: String, trim: true },
    experienceYears: { type: Number },
    industryExpertise: { type: [String], default: [] }, // e.g. ["FinTech", "SaaS"]
    specializations: { type: [String], default: [] },    // e.g. ["Career Transition"]
    profileNote: { type: String, maxLength: 120 },      // Trust building bio
    
    // --- Payout Info ---
    upiId: { type: String, trim: true },
    bankDetails: {
        accountName: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String }
    },

    // --- Performance & Limits ---
    maxCaseload: { type: Number, default: 3 }, // Daily quota
    dailyCaseloadCount: { type: Number, default: 0 }, // Tracking cases taken today
    currentCaseload: { type: Number, default: 0 }, // Total active cases
    slaCommitmentHours: { type: Number, default: 48 }, // e.g. 48 hours
    
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['PENDING_SETUP', 'ACTIVE', 'INACTIVE'], default: 'PENDING_SETUP' },
    fcmToken: { type: String, default: null },

    // --- Legal ---
    isTermsAccepted: { type: Boolean, default: false },
    acceptedAt: { type: Date },
    
    // Legacy fields
    professionalBackground: { type: String },
    ratingScore: { type: Number, default: 0 }
}, {
    timestamps: true,
    collection: 'risk_auditor_registry'
});

module.exports = mongoose.model('RiskAuditorRegistry', RiskAuditorRegistrySchema);
