const express = require('express');
const router = express.Router();
const adminConfigController = require('./adminConfig.controller.js');
const { authenticate, authorize } = require('../../../middleware/authorization/authorization');

// All routes here require admin authentication
router.use(authenticate);
router.use(authorize('admin', 'sub_admin'));

/**
 * @route   GET /api/v1/admin/config/prompts
 * @desc    Get all active prompt configurations
 * @access  Admin
 */
router.get('/prompts', adminConfigController.getAllPromptConfigs);

/**
 * @route   GET /api/v1/admin/config/prompt/:promptId
 * @desc    Get a specific prompt configuration
 * @access  Admin
 */
router.get('/prompt/:promptId', adminConfigController.getPromptConfig);

/**
 * @route   POST /api/v1/admin/config/prompt
 * @desc    Update or create a prompt configuration
 * @access  Admin
 */
router.post('/prompt', adminConfigController.upsertPromptConfig);

/**
 * @route   GET /api/v1/admin/config/system
 * @desc    Get global system settings
 * @access  Admin
 */
router.get('/system', adminConfigController.getSystemSettings);

/**
 * @route   POST /api/v1/admin/config/system
 * @desc    Update global system settings
 * @access  Admin
 */
router.post('/system', adminConfigController.updateSystemSettings);

module.exports = router;
