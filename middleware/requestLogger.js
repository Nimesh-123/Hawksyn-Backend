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

  // Intercept res.send and res.json to capture response body
  const originalSend = res.send;
  res.send = function (body) {
    try {
      const parsed = (typeof body === 'string') ? JSON.parse(body) : body;
      req.responseBody = parsed;
      if (res.statusCode >= 400 && parsed) {
        // Hawksyn standard uses .message or .error for failure reasons
        req.failureReason = parsed.message || parsed.error || (typeof body === 'string' ? body : null);
      }
    } catch (e) {
      // Not JSON or error parsing, store as string if string
      req.responseBody = (typeof body === 'string') ? body : '[Non-string body]';
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
      requestBody: req.body || null,
      responseBody: req.responseBody || null,
      failureReason: req.appError?.message || req.failureReason || null,
      stack: req.appError?.stack || null,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      responseTime: `${Date.now() - start}ms`
    };

    // Log to terminal for easy visibility as requested by user
    console.log(`\n--- REQUEST [${requestId}] ---`);
    console.log(`Method: ${req.method} | Route: ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    console.log(`--- RESPONSE [${requestId}] ---`);
    console.log(`Status: ${res.statusCode} | Time: ${Date.now() - start}ms`);
    console.log('Body:', JSON.stringify(req.responseBody, null, 2));
    console.log(`-------------------------------\n`);

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
