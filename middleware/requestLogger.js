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

  // Intercept res.send and res.json to capture error reason for 4xx/5xx
  const originalSend = res.send;
  res.send = function (body) {
    if (res.statusCode >= 400 && body) {
      try {
        const parsed = (typeof body === 'string') ? JSON.parse(body) : body;
        // Hawksyn standard uses .message or .error for failure reasons
        req.failureReason = parsed.message || parsed.error || (typeof body === 'string' ? body : null);
      } catch (e) {
        // Not JSON, skip
      }
    }
    return originalSend.apply(res, arguments);
  };

  res.on("finish", () => {
    const logData = {
      requestId,
      time: new Date().toISOString(),
      userId: req.user?.id || "guest",
      userEmail: req.user?.email || null,
      method: req.method,
      route: req.originalUrl,
      statusCode: res.statusCode,
      failureReason: req.failureReason || null, // Capture captured reason
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
