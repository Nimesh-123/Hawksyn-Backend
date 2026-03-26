const { createLogger, format, transports } = require("winston");

// Custom format for readable log files
const textFormat = format.printf(({ timestamp, level, message, stack }) => {
  const m = typeof message === 'object' ? message : { msg: message };
  const border = "─".repeat(80);
  
  // 1. Primary Header: [Time] [LEVEL] METHOD ROUTE -> STATUS (Time)
  let output = `\n${border}\n[${timestamp}] [${level.toUpperCase()}]`;
  
  if (m.method) {
    output += ` ${m.method} ${m.route} -> ${m.statusCode}`;
    if (m.responseTime) output += ` (${m.responseTime})`;
    
    // 2. Metadata
    output += `\n  ID:   ${m.requestId || 'system'}`;
    output += `\n  USER: ${m.userId || 'guest'} ${m.userEmail ? '(' + m.userEmail + ')' : ''}`;

    // 3. Request Body (Prettified)
    if (m.requestBody && Object.keys(m.requestBody).length > 0) {
      const reqStr = JSON.stringify(m.requestBody, null, 2);
      const indentedReq = reqStr.split('\n').map(l => '    ' + l).join('\n');
      output += `\n  REQ:\n${indentedReq}`;
    }
    
    // 4. Response Body (Prettified & Truncated)
    if (m.responseBody) {
      const resStr = JSON.stringify(m.responseBody, null, 2);
      // Keep it readable but prevent log floods (using 5000 chars as limit for prettified JSON)
      const displayRes = resStr.length > 5000 ? resStr.substring(0, 5000) + "\n    ... [TRUNCATED]" : resStr;
      
      const indentedRes = displayRes.split('\n').map(l => '    ' + l).join('\n');
      output += `\n  RES:\n${indentedRes}`;
    }

    // 5. Failure Reason
    const reason = m.failureReason || m.errorMessage;
    if (reason) output += `\n  ERR:  ${reason}`;
  } else {
    // Non-request logs
    output += ` ${m.msg || JSON.stringify(m)}`;
  }

  // 6. Stack Trace
  if (stack || m.stack) {
    output += `\n  STACK: ${stack || m.stack}`;
  }

  return output;
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
