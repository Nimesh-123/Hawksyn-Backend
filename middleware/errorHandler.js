const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || res.statusCode >= 400 ? res.statusCode : 500;

  const errorLogData = {
    requestId: req.requestId || 'N/A',
    time: new Date().toISOString(),
    userId: req.user?.id || 'guest',
    userEmail: req.user?.email || null,
    method: req.method,
    route: req.originalUrl,
    errorMessage: err.message,
    errorCode: err.code || 'UNKNOWN_ERROR',
    stack: err.stack,
    timestamp: new Date().getTime(),
    statusCode: statusCode
  };

  logger.error(errorLogData);

  // Record error in user-specific file using email as filename
  const userIdentifier = req.user?.email || req.user?.id;
  if (userIdentifier) {
    logger.logUserAction(userIdentifier, errorLogData);
  }

  // Handle Multer Size Limit specifically if needed (already in index.js but here it's more centralized)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: "File is too large! Maximum limit is 10MB.",
      error: "LIMIT_FILE_SIZE"
    });
  }

  // Same for JSON Parsing Error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format in request body.",
      error: err.message
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.stack : "INTERNAL_SERVER_ERROR"
  });
};

module.exports = errorHandler;
