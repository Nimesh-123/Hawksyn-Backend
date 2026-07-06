const Suggestion = require('./suggestion.model.js');
const RESPONSE = require('../../../utils/response.js');

// ==========================================
// USER APIs
// ==========================================

/**
 * @desc    Submit a new idea to the suggestion box
 * @route   POST /api/v1/user/suggestions
 * @access  Private
 */
exports.createSuggestion = async (req, res) => {
    try {
        const { category, idea } = req.body;
        const userId = req.user.id;

        if (!idea || idea.trim().length === 0) {
            return RESPONSE.error(res, 400, 1003, "Idea cannot be empty");
        }

        if (idea.length > 300) {
            return RESPONSE.error(res, 400, 1003, "Idea must be 300 characters or less");
        }

        const suggestion = await Suggestion.create({
            user: userId,
            category,
            idea,
            status: 'Pending',
            is_public: false
        });

        return RESPONSE.success(res, 201, 1001, {
            message: "Suggestion submitted successfully",
            suggestion
        });
    } catch (err) {
        console.error("Error in createSuggestion:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * @desc    Get community suggestions board
 * @route   GET /api/v1/user/suggestions
 * @access  Private
 */
exports.getCommunitySuggestions = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch all public suggestions AND the user's own pending suggestions
        const suggestions = await Suggestion.find({
            $or: [
                { is_public: true },
                { user: userId }
            ]
        })
        .sort({ status: -1, createdAt: -1 }) // Sort by status (Delivered first) and then newest
        .lean();

        // Add `isYours` flag
        const mappedSuggestions = suggestions.map(suggestion => {
            return {
                ...suggestion,
                isYours: suggestion.user.toString() === userId.toString()
            };
        });

        return RESPONSE.success(res, 200, 1001, {
            message: "Community suggestions fetched successfully",
            suggestions: mappedSuggestions
        });
    } catch (err) {
        console.error("Error in getCommunitySuggestions:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * @desc    Get suggestion details
 * @route   GET /api/v1/user/suggestions/:id
 * @access  Private
 */
exports.getSuggestionDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const suggestion = await Suggestion.findById(id).lean();

        if (!suggestion) {
            return RESPONSE.error(res, 404, 3001, "Suggestion not found");
        }

        // Check if the user is authorized to see it
        // A user can see it if it's public OR if they created it
        if (!suggestion.is_public && suggestion.user.toString() !== userId.toString()) {
            return RESPONSE.error(res, 403, 1005, "You do not have permission to view this suggestion");
        }

        suggestion.isYours = suggestion.user.toString() === userId.toString();

        return RESPONSE.success(res, 200, 1001, {
            message: "Suggestion details fetched successfully",
            suggestion
        });
    } catch (err) {
        console.error("Error in getSuggestionDetails:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// ==========================================
// ADMIN APIs
// ==========================================

/**
 * @desc    Get all suggestions for admin review
 * @route   GET /api/v1/admin/suggestions
 * @access  Private (Admin)
 */
exports.getAdminSuggestions = async (req, res) => {
    try {
        const { status, is_public, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (status) query.status = status;
        if (is_public !== undefined) query.is_public = is_public === 'true';

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const suggestions = await Suggestion.find(query)
            .populate('user', 'firstName lastName email username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Suggestion.countDocuments(query);

        return RESPONSE.success(res, 200, 1001, {
            message: "Admin suggestions fetched successfully",
            suggestions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error in getAdminSuggestions:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * @desc    Update a suggestion (status, visibility, release metadata)
 * @route   PUT /api/v1/admin/suggestions/:id
 * @access  Private (Admin)
 */
exports.updateSuggestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, is_public, shipped_version } = req.body;

        const suggestion = await Suggestion.findById(id);
        if (!suggestion) {
            return RESPONSE.error(res, 404, 3001, "Suggestion not found");
        }

        if (status) suggestion.status = status;
        if (is_public !== undefined) suggestion.is_public = is_public;
        
        if (status === 'Delivered') {
            suggestion.shipped_version = shipped_version || suggestion.shipped_version;
            suggestion.shipped_date = new Date();
        }

        await suggestion.save();

        return RESPONSE.success(res, 200, 1001, {
            message: "Suggestion updated successfully",
            suggestion
        });
    } catch (err) {
        console.error("Error in updateSuggestionStatus:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * @desc    Delete/Reject a suggestion
 * @route   DELETE /api/v1/admin/suggestions/:id
 * @access  Private (Admin)
 */
exports.deleteSuggestion = async (req, res) => {
    try {
        const { id } = req.params;

        const suggestion = await Suggestion.findByIdAndDelete(id);
        if (!suggestion) {
            return RESPONSE.error(res, 404, 3001, "Suggestion not found");
        }

        return RESPONSE.success(res, 200, 1001, {
            message: "Suggestion deleted successfully"
        });
    } catch (err) {
        console.error("Error in deleteSuggestion:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
