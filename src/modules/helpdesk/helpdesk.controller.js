const { db } = require('../../models/index.model.js');
const RESPONSE = require('../../../utils/response.js');
const { generateFormattedId } = require('../../../utils/idGenerator.js');

exports.getAllTickets = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const total = await db.Ticket.countDocuments({ userId });
        const tickets = await db.Ticket.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
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

exports.createTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subject, description, deviceInfo } = req.body;

        if (!subject || !description) {
            return RESPONSE.error(res, 400, 1003, "Subject and description are required.");
        }

        // Generate Ticket ID using the standard utility (e.g. TKT_20260627_0001)
        const ticketId = await generateFormattedId(db.Ticket, 'TKT', 'ticketId');

        const ticket = await db.Ticket.create({
            ticketId,
            userId,
            subject,
            description,
            deviceInfo: deviceInfo || {},
            status: 'OPEN'
        });

        // Add the initial message to the thread
        await db.TicketMessage.create({
            ticketId: ticket._id,
            senderId: userId,
            senderType: 'USER',
            message: description
        });

        return RESPONSE.success(res, 201, 1001, {
            message: "Ticket created successfully.",
            ticket
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};

exports.getTicketThread = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const ticket = await db.Ticket.findOne({ _id: id, userId }).lean();
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

exports.replyToTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { message } = req.body;

        if (!message) {
            return RESPONSE.error(res, 400, 1003, "Message is required.");
        }

        const ticket = await db.Ticket.findOne({ _id: id, userId });
        if (!ticket) {
            return RESPONSE.error(res, 404, 3001, "Ticket not found.");
        }

        if (ticket.status === 'CLOSED') {
            return RESPONSE.error(res, 403, 1005, "This ticket is closed. You cannot reply.");
        }

        const ticketMessage = await db.TicketMessage.create({
            ticketId: ticket._id,
            senderId: userId,
            senderType: 'USER',
            message
        });

        return RESPONSE.success(res, 201, 1001, {
            message: "Reply sent successfully.",
            ticketMessage
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
