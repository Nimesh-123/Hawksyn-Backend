const express = require('express');
const route = express.Router();
const testController = require('../../controllers/test.controller.js');
const upload = require('../../../middleware/multer.js');

/**
 * @swagger
 * /test/upload:
 *   post:
 *     summary: Test S3 File Upload
 *     tags: [Test]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Success
 */
route.post('/upload', upload.single('file'), testController.testUpload);

module.exports = route;
