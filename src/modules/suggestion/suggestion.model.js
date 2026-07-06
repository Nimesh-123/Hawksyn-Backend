const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        enum: ['Scan', 'HIP', 'Reports', 'Dashboard', 'Other', null],
        default: null
    },
    idea: {
        type: String,
        required: true,
        maxlength: 300,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Acknowledged', 'WIP', 'Delivered'],
        default: 'Pending'
    },
    is_public: {
        type: Boolean,
        default: false // Set to true by admin to display on community board
    },
    shipped_version: {
        type: String,
        default: null
    },
    shipped_date: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
