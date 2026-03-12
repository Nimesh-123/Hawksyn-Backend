const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
  // Skip logging for OPTIONS requests (Browser pre-flight) to reduce noise
  if (req.method === 'OPTIONS') {
    return next();
  }

  const requestId = uuidv4();
  req.requestId = requestId;

  const start = Date.now();

  res.on("finish", () => {
    const logData = {
      requestId,
      time: new Date().toISOString(),
      userId: req.user?.id || "guest",
      userEmail: req.user?.email || null,
      method: req.method,
      route: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      responseTime: `${Date.now() - start}ms`
    };

    if (res.statusCode >= 500) {
      logger.error(logData);
    } else if (res.statusCode >= 400) {
      logger.warn(logData);
    } else {
      logger.info(logData);
    }

    // Dynamic user-specific logging using email if available
    const userIdentifier = req.user?.email || req.user?.id || "guest";
    logger.logUserAction(userIdentifier, logData);
  });

  next();
};

module.exports = requestLogger;
