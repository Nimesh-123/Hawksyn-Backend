const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminPlaybookController = require('./adminPlaybook.controller.js');
const caseController = require('../../controllers/caseController.js');


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
 * /admin/playbook/cases:
 *   get:
 *     summary: Get all cases (Admin view includes inactive)
 *     tags: ["10. Admin: Playbook Import"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cases
 */
router.get('/cases', caseController.getCases);

/**
 * @swagger
 * /admin/playbook/template/download:
 *   get:
 *     summary: Download multi-sheet Excel template (optionally pre-filled)
 *     tags: ["10. Admin: Playbook Import"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: caseId
 *         required: false
 *         schema:
 *           type: string
 *         description: "Optional: Case ID to pre-fill data for editing. Leave blank for a NEW CASE template."
 *     responses:
 *       200:
 *         description: Excel file buffer
 */
router.get('/template/download', adminPlaybookController.downloadPlaybookTemplate);



/**
 * @swagger
 * /admin/playbook/upload:
 *   post:
 *     summary: Upload and validate a multi-sheet Excel Playbook
 *     tags: ["10. Admin: Playbook Import"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
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
 *         description: Parsed data summary
 */
router.post('/upload', upload.single('file'), adminPlaybookController.uploadPlaybook);


/**
 * @swagger
 * /admin/playbook/import:
 *   post:
 *     summary: Confirm and commit validated data to MongoDB
 *     tags: ["10. Admin: Playbook Import"]
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
 *         description: Import completion
 *       500:
 *         description: Transaction failed
 */
router.post('/import', adminPlaybookController.confirmImport);

/**
 * @swagger
 * /admin/playbook/case/{caseId}/snapshot:
 *   get:
 *     summary: Get comprehensive snapshot of a case (intents, policies, stats)
 *     tags: ["10. Admin: Playbook Import"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Case ID to check
 *     responses:
 *       200:
 *         description: Case snapshot data
 */
router.get('/case/:caseId/snapshot', adminPlaybookController.getCaseSnapshot);

module.exports = router;
