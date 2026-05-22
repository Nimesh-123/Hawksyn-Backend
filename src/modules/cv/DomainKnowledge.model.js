const mongoose = require('mongoose');

const domainKnowledgeSchema = new mongoose.Schema({
    entry_id: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    term_canonical: { type: String, required: true },
    term_aliases: { type: String },
    metadata: { type: String },
    is_active: { type: Boolean, default: true },
    notes: { type: String }
}, { collection: 'domain_knowledge' });

domainKnowledgeSchema.index({ category: 1, term_canonical: 1 });
domainKnowledgeSchema.index({ is_active: 1 });

module.exports = mongoose.model('DomainKnowledge', domainKnowledgeSchema);
