require('dotenv').config(); // Triggering restart to fix encryption key issue

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const { authenticate } = require('./middleware/authorization/authorization.js');
const { check_validation } = require('./utils/validateRequest.js');
const swaggerSpec = require('./utils/swagger.js');
const route = require('./src/routes/index.route.js');
require('./middleware/database/connectDatabase.js');

// --- Real-time Chat ---
const { Server } = require('socket.io');
const { initChatSocket } = require('./src/sockets/chatSocket');

require('./src/modules/signals/crons/trendEngine.cron.js');
require('./src/modules/assurance/crons/validityDecline.cron.js');
require('./src/modules/signals/crons/signalArchive.cron.js');
require('./src/modules/assurance/crons/slaBreach.cron.js');
const cronService = require('./src/services/cronService');
cronService.init();

// --- Global Logging & Request ID ---
const requestLogger = require('./middleware/requestLogger.js');
const errorHandler = require('./middleware/errorHandler.js');

app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: "Hawksyn Backend API is running",
        version: "1.0.0"
    });
});

// Test routes for logging verification

app.use(`${process.env.API_COMMON_ROUTE}/uploads`, express.static(path.join(__dirname, 'uploads')));
app.use(`${process.env.API_COMMON_ROUTE}/chat`, require('./src/modules/expert/chat.route.js'));

app.use(`${process.env.API_COMMON_ROUTE}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- Routes ---
const apiPrefix = process.env.API_COMMON_ROUTE || '/api/v1';
app.use(apiPrefix, authenticate, check_validation, route);

// --- Centralized Error Handling Middleware (Keep at the end) ---
app.use(errorHandler);

const PORT = process.env.PORT || 3002;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API Base Route: ${apiPrefix}`);
});
  
// --- Initialize Socket.io ---
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});
initChatSocket(io);

// Set timeout to 2 minutes for AI processing
server.timeout = 120000;
