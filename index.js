require('dotenv').config();

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

// --- Cron Jobs ---
require('./src/crons/trendEngine.cron.js');

// --- Global Logging & Request ID ---
const requestLogger = require('./middleware/requestLogger.js');
const errorHandler = require('./middleware/errorHandler.js');

app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test routes for logging verification

app.use(`${process.env.API_COMMON_ROUTE}/uploads`, express.static(path.join(__dirname, 'uploads')));

app.use(`${process.env.API_COMMON_ROUTE}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(`${process.env.API_COMMON_ROUTE}`, authenticate, check_validation, route);

// --- Centralized Error Handling Middleware (Keep at the end) ---
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
    console.log(`Magic happens on port ${PORT}`);
});

// Set timeout to 2 minutes for AI processing
server.timeout = 120000;
