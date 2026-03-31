const express = require('express');
const route = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const chatController = require('../controllers/chatController.js');

// 1. Storage setup for chat attachments
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/chat';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

/**
 * @swagger
 * /chat/upload:
 *   post:
 *     summary: Upload chat attachment (Image/Audio/File) - Max 1MB
 *     tags: ["7. Expert Support & Chat"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
route.post('/upload', upload.single('file'), chatController.uploadAttachment);

/**
 * @swagger
 * /chat/history/{runId}:
 *   get:
 *     summary: Get chat history for a run
 *     tags: ["7. Expert Support & Chat"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 */
route.get('/history/:runId', chatController.getChatHistory);

module.exports = route;
