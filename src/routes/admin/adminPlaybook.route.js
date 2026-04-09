const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminPlaybookController = require('../../controllers/adminPlaybook.controller.js');

// Multer storage configuration (memory buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed.'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
});

/**
 * @swagger
 * /admin/playbook/upload:
 *   post:
 *     summary: Upload and validate a multi-sheet Excel Playbook
 *     tags: ["9. Admin: Playbook Import"]
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
 *     responses:
 *       200:
 *         description: Parsed summary and preview
 *       400:
 *         description: Invalid file or missing data
 *       500:
 *         description: Parsing error
 */
router.post('/upload', upload.single('file'), adminPlaybookController.uploadPlaybook);

/**
 * @swagger
 * /admin/playbook/import:
 *   post:
 *     summary: Confirm and commit validated data to MongoDB
 *     tags: ["9. Admin: Playbook Import"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               uploadId:
 *                 type: string
 *               caseId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Import success
 *       404:
 *         description: Upload session expired
 *       500:
 *         description: Transaction failed
 */
router.post('/import', adminPlaybookController.confirmImport);

module.exports = router;
