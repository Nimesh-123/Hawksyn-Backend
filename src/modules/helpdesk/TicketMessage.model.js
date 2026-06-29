const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema({
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderType: {
        type: String,
        enum: ['USER', 'SUPPORT'],
        required: true
    },
    message: {
        type: String,
        required: true
    }
}, { timestamps: true });

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model('TicketMessage', ticketMessageSchema);
