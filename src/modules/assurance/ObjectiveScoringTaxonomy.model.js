const mongoose = require('mongoose');

const ObjectiveScoringTaxonomySchema = new mongoose.Schema({
    schemaId: { type: String, required: true, unique: true },
    schemaName: { type: String },
    caseId: { type: String, required: true },
    sectionId: { type: String, required: true },
    pcrPromptId: { type: String },
    
    // Output & Rendering
    primaryOutputType: { type: String, enum: ['PROSE', 'TABLE', 'CHART', 'MIXED', 'TIMELINE', 'CASCADE', 'LIST', 'GRID', 'HIDDEN'], default: 'PROSE' },
    chartType: { type: String, default: 'NONE' },
    chartLibrary: { type: String, default: 'none' },
    
    // Weightage
    intentWeightRC: { type: String, default: 'NEUTRAL' }, // Risk Category
    intentWeightSP: { type: String, default: 'NEUTRAL' }, // Skill/Performance
    intentWeightER: { type: String, default: 'NEUTRAL' }, // Evidence/Reliability
    
    // The "Contract"
    llmJsonContract: { type: String },
    
    // Frontend Layout
    frontendRenderSpec: { type: String },
    wordLimit: { type: Number, default: 250 },
    fallbackOutputType: { type: String, default: 'PROSE' },
    
    // Metadata
    scientificReference: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    collection: 'objective_scoring_taxonomy'
});

module.exports = mongoose.model('ObjectiveScoringTaxonomy', ObjectiveScoringTaxonomySchema);
