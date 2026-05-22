const mongoose = require('mongoose');

const DroMasterSchema = new mongoose.Schema({
    droId: { type: String, required: true, unique: true },
    riskTypeName: { type: String, required: true },
    riskDomain: { 
        type: String, 
        required: true,
        enum: ['CAREER', 'FINANCIAL', 'EDUCATION', 'ENTREPRENEURSHIP']
    },
    riskNature: { 
        type: String, 
        required: true,
        enum: ['STRUCTURAL', 'BEHAVIOURAL', 'FINANCIAL', 'COMPOUND']
    },
    riskDescription: { type: String, required: true },
    severityTier: { 
        type: String, 
        required: true,
        enum: ['CRITICAL', 'HIGH', 'MEDIUM']
    },
    isCompoundRisk: { type: Boolean, required: true, default: false },
    constituentRisksJson: { type: mongoose.Schema.Types.Mixed, default: null },
    
    // --- MOAT FIELDS ---
    detectionFingerprint: { type: String, required: true }, // [LOCKED]
    cooccurrencePatterns: { type: mongoose.Schema.Types.Mixed, default: null }, // [NULL AT LAUNCH]
    verdictCorrelation: { type: mongoose.Schema.Types.Mixed, default: null }, // [NULL AT LAUNCH]
    populationBenchmark: { type: mongoose.Schema.Types.Mixed, default: null }, // [NULL AT LAUNCH]
    // -------------------

    auditorExpertiseTag: { type: String, required: true },
    remediationHorizon: { 
        type: String, 
        required: true,
        enum: ['IMMEDIATE_30_DAYS', 'SHORT_90_DAYS', 'MEDIUM_180_DAYS']
    },
    reportProminence: { 
        type: String, 
        required: true,
        enum: ['TOP_BANNER', 'VERDICT_SECTION', 'ANALYSIS_SECTION']
    },
    userFacingLabel: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true }
}, {
    timestamps: true,
    collection: 'dro_master'
});

module.exports = mongoose.model('DroMaster', DroMasterSchema);
