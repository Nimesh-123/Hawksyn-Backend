const Rating = require('./rating.model.js');
const RESPONSE = require('../../../utils/response.js');

// ==========================================
// USER APIs
// ==========================================

/**
 * @desc    Submit a new app rating
 * @route   POST /api/v1/user/ratings
 * @access  Private
 */
exports.submitRating = async (req, res) => {
    try {
        const userId = req.user.id;
        const { scan_accuracy, ease_of_use, overall_experience } = req.body;

        // Ensure at least one rating is provided
        if (!scan_accuracy && !ease_of_use && !overall_experience) {
            return RESPONSE.error(res, 400, 1003, "You must provide at least one rating category (scan_accuracy, ease_of_use, or overall_experience).");
        }

        // Validate values (if provided, must be between 1 and 5)
        const validateScore = (score) => {
            if (score !== undefined && score !== null) {
                if (typeof score !== 'number' || score < 1 || score > 5) {
                    return false;
                }
            }
            return true;
        };

        if (!validateScore(scan_accuracy) || !validateScore(ease_of_use) || !validateScore(overall_experience)) {
            return RESPONSE.error(res, 400, 1003, "Ratings must be a number between 1 and 5.");
        }

        // Check if user has already rated. If yes, update it. If no, create it.
        let rating = await Rating.findOne({ user: userId });

        if (rating) {
            if (scan_accuracy) rating.scan_accuracy = scan_accuracy;
            if (ease_of_use) rating.ease_of_use = ease_of_use;
            if (overall_experience) rating.overall_experience = overall_experience;
            await rating.save();
        } else {
            rating = await Rating.create({
                user: userId,
                scan_accuracy,
                ease_of_use,
                overall_experience
            });
        }

        return RESPONSE.success(res, 201, 1001, {
            message: "Rating submitted successfully.",
            rating
        });
    } catch (err) {
        console.error("Error in submitRating:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// ==========================================
// ADMIN APIs
// ==========================================

/**
 * @desc    Get all ratings (Admin)
 * @route   GET /api/v1/admin/ratings
 * @access  Private (Admin)
 */
exports.getAllRatings = async (req, res) => {
    try {
        const { page = 1, limit = 20, low_score_only } = req.query;
        
        let query = {};
        
        // Filter by low score if requested
        if (low_score_only === 'true') {
            query.overall_experience = { $lte: 3, $ne: null };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const ratings = await Rating.find(query)
            .populate('user', 'firstName lastName email username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Rating.countDocuments(query);

        return RESPONSE.success(res, 200, 1001, {
            message: "Ratings fetched successfully",
            ratings,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error in getAllRatings:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

/**
 * @desc    Get rating statistics (Admin Dashboard)
 * @route   GET /api/v1/admin/ratings/stats
 * @access  Private (Admin)
 */
exports.getRatingStats = async (req, res) => {
    try {
        const stats = await Rating.aggregate([
            {
                $group: {
                    _id: null,
                    totalRatings: { $sum: 1 },
                    avgScanAccuracy: { $avg: "$scan_accuracy" },
                    avgEaseOfUse: { $avg: "$ease_of_use" },
                    avgOverall: { $avg: "$overall_experience" },
                    lowScores: {
                        $sum: { $cond: [{ $lte: ["$overall_experience", 3] }, 1, 0] }
                    },
                    highScores: {
                        $sum: { $cond: [{ $gte: ["$overall_experience", 4] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalRatings: 0,
            avgScanAccuracy: 0,
            avgEaseOfUse: 0,
            avgOverall: 0,
            lowScores: 0,
            highScores: 0
        };

        // Remove the _id from the result object
        delete result._id;

        return RESPONSE.success(res, 200, 1001, {
            message: "Rating stats fetched successfully",
            stats: result
        });
    } catch (err) {
        console.error("Error in getRatingStats:", err);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
