const { Server } = require('socket.io');
const { db } = require('../models/index.model.js');

let io;

const HIP_PROGRESS_MAP = {
    'CAREER_SIGNALS': { progress: 20, message: "Analyzing career signals..." },
    'CLOCK_DATA': { progress: 40, message: "Processing clock data..." },
    'PROFILE_CARD': { progress: 60, message: "Building profile card..." },
    'SECURE_PIN': { progress: 88, message: "Locking with your M-PIN..." }
};

const CLOCK_PROGRESS_MAP = {
    'MARKET_VELOCITY': { progress: 25, message: "Aligning market position..." },
    'SKILL_HALFLIFE': { progress: 50, message: "Calculating skill decay..." },
    'OPPORTUNITY_WINDOW': { progress: 75, message: "Identifying opportunities..." }
};

const CV_PROGRESS_MAP = {
    'PENDING': { progress: 10, message: "Initializing..." },
    'PROCESSING': { progress: 20, message: "Reading document..." },
    'BUILDING_CAREER_TIMELINE': { progress: 48, message: "Analyzing career timeline..." },
    'READING_CAREER_SIGNALS': { progress: 72, message: "Extracting career signals..." }
};

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

            socket.on('join_user_room', async (userId) => {
                if (userId) {
                    socket.join(userId);
                    console.log(`[Socket] Client ${socket.id} joined user room: ${userId}`);

                    try {
                        // 1. Check active HIP process
                        const hipDoc = await db.HipProfile.findOne({ userId }).lean();
                        if (hipDoc && hipDoc.generationStatus && HIP_PROGRESS_MAP[hipDoc.generationStatus]) {
                            const mapping = HIP_PROGRESS_MAP[hipDoc.generationStatus];
                            io.to(userId).emit('hip_generation_update', {
                                success: true,
                                data: {
                                    generationStatus: hipDoc.generationStatus,
                                    progress: mapping.progress,
                                    message: mapping.message
                                }
                            });
                        }

                        // 2. Check active Clock process
                        const clockDoc = await db.UserClocks.findOne({ userId }).lean();
                        if (clockDoc && clockDoc.generationStatus && CLOCK_PROGRESS_MAP[clockDoc.generationStatus]) {
                            const mapping = CLOCK_PROGRESS_MAP[clockDoc.generationStatus];
                            io.to(userId).emit('clock_generation_update', {
                                success: true,
                                data: {
                                    status: clockDoc.generationStatus,
                                    progress: mapping.progress,
                                    message: mapping.message
                                }
                            });
                        }

                        // 3. Check active CV Parsing process
                        const cvDoc = await db.DocumentUploads.findOne({ userId, isActive: true }).lean();
                        if (cvDoc && cvDoc.parserStatus && (cvDoc.parserStatus === 'PENDING' || cvDoc.parserStatus === 'PROCESSING')) {
                            // DocumentUploads usually holds 'PROCESSING' or 'PENDING'.
                            const mapping = CV_PROGRESS_MAP[cvDoc.parserStatus];
                            io.to(userId).emit('cv_parse_update', {
                                success: true,
                                data: {
                                    parserStatus: cvDoc.parserStatus,
                                    progress: mapping.progress,
                                    message: mapping.message
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`[Socket] Error checking catch-up status for user ${userId}:`, error);
                    }
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
