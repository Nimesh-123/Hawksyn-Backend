const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scan_accuracy: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    ease_of_use: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    overall_experience: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    }
}, { timestamps: true });

// Ensure a user can only rate once, or we can allow multiple if they update it.
// To keep it simple and track historical feedback, we won't put a unique index on user, 
// or if we want one rating per user we can uncomment the below line.
// ratingSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
