const { db } = require('../../models/index.model.js');
const RESPONSE = require('../../../utils/response');

/**
 * FAQ CONTROLLERS
 */

// 1. Get All FAQs (User/Public)
exports.getFAQs = async (req, res) => {
    try {
        const { category } = req.query;
        let query = { isActive: true };
        if (category) query.category = category;

        const faqs = await db.FAQ.find(query).sort({ displayOrder: 1, createdAt: -1 });
        return res.status(200).json({ success: true, data: faqs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Create FAQ (Admin Only)
exports.createFAQ = async (req, res) => {
    try {
        const faq = await db.FAQ.create(req.body);
        return res.status(201).json({ success: true, data: faq, message: 'FAQ created successfully' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 3. Update FAQ (Admin Only)
exports.updateFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await db.FAQ.findByIdAndUpdate(id, req.body, { new: true });
        if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
        return res.status(200).json({ success: true, data: faq, message: 'FAQ updated successfully' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 4. Delete FAQ (Admin Only)
exports.deleteFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        await db.FAQ.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: 'FAQ deleted successfully' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * LEGAL CONTENT CONTROLLERS
 */

// 5. Get Legal Content (Public)
exports.getLegalContent = async (req, res) => {
    try {
        const { type } = req.query;
        let query = {};
        if (type) query.type = type.toUpperCase();

        const docs = await db.LegalContent.find(query);
        return res.status(200).json({ success: true, data: docs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Upsert Legal Content (Admin Only)
exports.upsertLegalContent = async (req, res) => {
    try {
        const { type, title, content, version } = req.body;
        const typeKey = type.toUpperCase();

        const doc = await db.LegalContent.findOneAndUpdate(
            { type: typeKey },
            { type: typeKey, title, content, version, lastUpdated: new Date() },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, data: doc, message: `${typeKey} updated successfully` });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
