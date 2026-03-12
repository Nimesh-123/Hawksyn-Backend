const express           = require('express');
const router            = express.Router();
const recordsController = require('../controllers/recordsController');
const auth              = require('../../middleware/auth');

/**
 * @swagger
 * /users/{userId}/records:
 *   get:
 *     summary: Get all run records for a user
 *     tags: [7. My Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:userId/records', auth, recordsController.getAllRecords);

/**
 * @swagger
 * /users/{userId}/records/{runId}:
 *   get:
 *     summary: Get full detail for a specific run
 *     tags: [7. My Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *       - in: path
 *         name: runId
 *         required: true
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:userId/records/:runId', auth, recordsController.getRunDetail);

module.exports = router;
