const { db } = require('../../models/index.model.js');
const RESPONSE = require('../../../utils/response.js');

exports.getAllTicketsAdmin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { status, userId } = req.query;
        const query = {};

        if (status) query.status = status;
        if (userId) query.userId = userId;

        const total = await db.Ticket.countDocuments(query);
        const tickets = await db.Ticket.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'fullName email avatar')
            .lean();

        return RESPONSE.success(res, 200, 1001, {
            total,
            page,
            limit,
            tickets
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getTicketThreadAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const ticket = await db.Ticket.findById(id).populate('userId', 'fullName email avatar').lean();
        if (!ticket) {
            return RESPONSE.error(res, 404, 3001, "Ticket not found.");
        }

        const messages = await db.TicketMessage.find({ ticketId: ticket._id })
            .sort({ createdAt: 1 })
            .lean();

        return RESPONSE.success(res, 200, 1001, {
            ticket,
            messages
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.replyToTicketAdmin = async (req, res) => {
    try {
        const adminId = req.user.id; // Admin ID
        const { id } = req.params;
        const { message } = req.body;

        if (!message) {
            return RESPONSE.error(res, 400, 1003, "Message is required.");
        }

        const ticket = await db.Ticket.findById(id);
        if (!ticket) {
            return RESPONSE.error(res, 404, 3001, "Ticket not found.");
        }

        const ticketMessage = await db.TicketMessage.create({
            ticketId: ticket._id,
            senderId: adminId,
            senderType: 'SUPPORT',
            message
        });

        // Optionally, if the ticket was closed, maybe replying as an admin should reopen it? 
        // For now, let's keep it simple.

        return RESPONSE.success(res, 201, 1001, {
            message: "Reply sent successfully.",
            ticketMessage
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['OPEN', 'CLOSED'].includes(status)) {
            return RESPONSE.error(res, 400, 1003, "Invalid status.");
        }

        const ticket = await db.Ticket.findById(id);
        if (!ticket) {
            return RESPONSE.error(res, 404, 3001, "Ticket not found.");
        }

        ticket.status = status;
        if (status === 'CLOSED') {
            ticket.resolvedAt = new Date();
        } else {
            ticket.resolvedAt = null;
        }

        await ticket.save();

        return RESPONSE.success(res, 200, 1001, {
            message: `Ticket status updated to ${status}.`,
            ticket
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
