const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema({
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ['USER', 'SUPPORT'], required: true },
    message: { type: String, required: true }
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    deviceInfo: { type: Object, default: {} },
    resolvedAt: { type: Date }
}, { timestamps: true });

// Pre-save hook to generate ticketId (e.g., TKT-YYMM-XXXX)
ticketSchema.pre('validate', async function (next) {
    if (this.isNew && !this.ticketId) {
        const date = new Date();
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const prefix = `TKT-${yy}${mm}-`;
        
        try {
            // Find the last ticket in this month
            const lastTicket = await this.constructor.findOne({ ticketId: new RegExp(`^${prefix}`) })
                .sort({ ticketId: -1 })
                .exec();

            let sequence = 1;
            if (lastTicket && lastTicket.ticketId) {
                const lastSequence = parseInt(lastTicket.ticketId.split('-')[2], 10);
                if (!isNaN(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }

            this.ticketId = `${prefix}${String(sequence).padStart(4, '0')}`;
        } catch (err) {
            return next(err);
        }
    }
    next();
});

const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = {
    Ticket,
    TicketMessage
};
