const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportContentController');

/**
 * @swagger
 * /content/faq:
 *   get:
 *     summary: Get list of FAQs
 *     tags: ["15. Support & Legal"]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/faq', supportController.getFAQs);

/**
 * @swagger
 * /legal/content:
 *   get:
 *     summary: Get Legal documents (Terms, Privacy, etc.)
 *     tags: ["15. Support & Legal"]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [TERMS, PRIVACY, REFUND, DISCLAIMER]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/legal/content', supportController.getLegalContent);

module.exports = router;
