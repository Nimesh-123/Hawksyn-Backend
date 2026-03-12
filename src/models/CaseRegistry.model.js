const mongoose = require('mongoose');

const CaseRegistrySchema = new mongoose.Schema({
    caseId: { type: String, required: true, unique: true },
    caseName: { type: String, required: true },
    caseCategory: { type: String, required: true },
    caseDescription: { type: String },
    launchStage: { type: String },
    defaultCurrency: { type: String },
    minPrice: { type: Number },
    maxPrice: { type: Number },
    documentRequired: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    logoSvg: { type: String, default: null }
}, {
    timestamps: true,
    collection: 'case_registry'
});

module.exports = mongoose.model('CaseRegistry', CaseRegistrySchema);
