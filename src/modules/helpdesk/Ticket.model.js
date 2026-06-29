const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        maxlength: 80
    },
    description: {
        type: String,
        required: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['OPEN', 'CLOSED'],
        default: 'OPEN'
    },
    deviceInfo: {
        type: Object,
        default: {}
    },
    resolvedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

ticketSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
