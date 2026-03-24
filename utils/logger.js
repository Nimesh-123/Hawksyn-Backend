const { createLogger, format, transports } = require("winston");

// Custom format for readable log files
const textFormat = format.printf(({ timestamp, level, message, stack }) => {
  const m = typeof message === 'object' ? message : { msg: message };

  // Header: [Time] [LEVEL] [ID] [User]
  const header = `[${timestamp}] [${level.toUpperCase()}] [${m.requestId || 'system'}] [User: ${m.userId || 'guest'}]`;

  // Body logic
  let body = "";
  if (m.method) {
    body += ` ${m.method} ${m.route} -> ${m.statusCode}`;
    if (m.responseTime) body += ` (${m.responseTime})`;

    // Include failure details if present
    const reason = m.failureReason || m.errorMessage;
    if (reason) body += ` [REASON: ${reason}]`;
  }
  else if (m.errorMessage) {
    body += ` ERROR: ${m.errorMessage}`;
  }
  else {
    body += ` ${m.msg || JSON.stringify(m)}`;
  }

  // Stack trace for errors (only if present and significant)
  const errorDetails = stack || m.stack ? `\nSTACK: ${stack || m.stack}` : "";

  return `${header}${body}${errorDetails}`;
});

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    textFormat
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

/**
 * Dynamic User-Specific Logger
 * Records both success and failure for a single user in their own file.
 */
logger.logUserAction = (userIdentifier, logData) => {
  if (!userIdentifier || userIdentifier === "guest" || userIdentifier === "admin@admin.com") return;

  // Sanitize identifier for filename (especially if it's an email)
  const safeFilename = userIdentifier.toString().replace(/[@.]/g, '_').toLowerCase();

  const userTransport = new transports.File({
    filename: `logs/users/${safeFilename}.log`,
    format: format.combine(
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      textFormat
    )
  });

  // Create a temporary logger for this specific file write
  const userLogger = createLogger({
    transports: [userTransport]
  });

  if (logData.statusCode >= 500 || logData.stack) {
    userLogger.error(logData);
  } else if (logData.statusCode >= 400) {
    userLogger.warn(logData);
  } else {
    userLogger.info(logData);
  }

  // Close transport immediately to prevent memory leak / file handle exhaustion
  userTransport.close();
};

module.exports = logger;
