const { Server } = require('socket.io');

let io;

module.exports = {
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: "*", // Adjust for production
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log(`[Socket] Client connected: ${socket.id}`);

            // Client should emit this immediately after connecting
            socket.on('join_user_room', (userId) => {
                if (userId) {
                    socket.join(userId);
                    console.log(`[Socket] Client ${socket.id} joined user room: ${userId}`);
                }
            });

            socket.on('disconnect', () => {
                console.log(`[Socket] Client disconnected: ${socket.id}`);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            console.warn("Socket.io not initialized. Cannot get IO instance.");
            return null; // Return null gracefully or throw an error based on preference
        }
        return io;
    }
};
