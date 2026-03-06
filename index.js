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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use(`${process.env.API_COMMON_ROUTE}/uploads`, express.static(path.join(__dirname, 'uploads')));

app.use(`${process.env.API_COMMON_ROUTE}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(`${process.env.API_COMMON_ROUTE}`, authenticate, check_validation, route);

// --- Global Error Handler (Keep at the end of the middleware chain) ---
app.use((err, req, res, next) => {
    // 1. Multer Size Limit Error
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: "File is too large! Maximum limit is 10MB.",
            error: "LIMIT_FILE_SIZE"
        });
    }

    // 2. JSON Parsing Error
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON format in request body.",
            error: err.message
        });
    }

    // 3. General Catch-all Error
    console.error("Global Error Caught:", err);
    return res.status(err.status || 500).json({
        success: false,
        message: err.message || "Something went wrong on the server.",
        error: process.env.NODE_ENV === 'development' ? err : "INTERNAL_SERVER_ERROR"
    });
});

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
    console.log(`Magic happens on port ${PORT}`);
});

// Set timeout to 2 minutes for AI processing
server.timeout = 120000;
