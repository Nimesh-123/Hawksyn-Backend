const mongoose = require('mongoose');

const hipProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    runId: { type: String, required: true }, // Links back to the PSDE execution run
    profileSlug: { type: String, required: true, unique: true, index: true }, // e.g., 'padma-iyengar-123'
    
    // Core Identity data pre-calculated for the HTML Head SEO tags
    seoMetadata: {
        title: { type: String },
        metaDescription: { type: String },
        canonicalUrl: { type: String },
        ogImageUrl: { type: String },
        rarityScore: { type: Number },
        jsonLdPerson: { type: mongoose.Schema.Types.Mixed }, // Raw JSON for the Person Schema
        jsonLdFaq: { type: mongoose.Schema.Types.Mixed }     // Raw JSON for the AIEO FAQ schema
    },

    // The generated content for all 25 sections (JSON mapped by sectionId)
    sectionsData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed // e.g., { "S01": { "cards": [...] }, "S04": { "prose": "..." } }
    },

    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' },
    generationStatus: { type: String, enum: ['PENDING', 'CAREER_SIGNALS', 'CLOCK_DATA', 'PROFILE_CARD', 'SECURE_PIN', 'COMPLETED'], default: 'PENDING' },
    publishedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('HipProfile', hipProfileSchema);
