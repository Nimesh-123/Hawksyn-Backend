const { db } = require('../../models/index.model.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RESPONSE = require('../../../utils/response.js');

// Expert Login
exports.expertLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return RESPONSE.error(res, 400, 1002, 'Email and password are required');
        }

        // Find expert in RiskAuditorRegistry
        const expert = await db.RiskAuditorRegistry.findOne({ email });

        if (!expert) {
            return RESPONSE.error(res, 401, 1005, 'Invalid email or password');
        }

        // Check password
        const isMatch = await bcrypt.compare(password, expert.password);
        if (!isMatch) {
            return RESPONSE.error(res, 401, 1005, 'Invalid email or password');
        }

        // Check if active
        if (!expert.isActive) {
            return RESPONSE.error(res, 403, 1005, 'Expert account is inactive. Please contact Admin.');
        }

        // Generate Tokens
        const accessToken = jwt.sign(
            { id: expert._id, email: expert.email, role: 'expert' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );

        const refreshToken = jwt.sign(
            { id: expert._id, email: expert.email, role: 'expert' }, 
            process.env.JWT_SECRET_REFRESH || 'refresh_secret', 
            { expiresIn: '365d' }
        );

        expert.refreshToken = refreshToken;
        await expert.save();

        const expertResponse = expert.toObject();
        delete expertResponse.password;
        delete expertResponse.refreshToken;

        return RESPONSE.success(res, 200, 1006, { 
            message: 'Expert logged in successfully',
            expert: expertResponse, 
            accessToken, 
            refreshToken 
        });

    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

// Get Expert Profile
exports.getExpertProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const expert = await db.RiskAuditorRegistry.findById(id).select('-password -refreshToken');
        
        if (!expert) {
            return RESPONSE.error(res, 404, 1005, 'Expert profile not found');
        }

        return RESPONSE.success(res, 200, 1001, { expert });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
