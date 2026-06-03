import winston from "winston";

const levels = {
    error:0,
    warn:1,
    info:2,
    http:3,
    verbose:4,
    debug:5,
    silly:6
}
const sensitivePatterns = [
  /token=[^&\s]+/gi,
  /password=["'][^"']+["']/gi,
  /password:\s*["'][^"']+["']/gi,
  /authorization:\s*Bearer\s+[^\s]+/gi,
  /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi,
];

// Helper to recursively redact sensitive keys and values in objects/arrays
function redactObject(obj: any, seen = new WeakSet()): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (seen.has(obj)) {
    return '[Circular]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, seen));
  }

  const redacted: any = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const val = obj[key];
    
    if (
      lowerKey.includes('password') || 
      lowerKey.includes('token') || 
      lowerKey.includes('authorization') ||
      lowerKey.includes('secret')
    ) {
      if (typeof val === 'string' && val.toLowerCase().startsWith('bearer ')) {
        redacted[key] = 'Bearer [REDACTED]';
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof val === 'string') {
      let sanitized = val;
      sensitivePatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, (match: string) => {
          const parts = match.split('=');
          if (parts.length > 1) return `${parts[0]}=[REDACTED]`;
          if (match.toLowerCase().includes('bearer')) return 'Bearer [REDACTED]';
          return '[REDACTED]';
        });
      });
      redacted[key] = sanitized;
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactObject(val, seen);
    } else {
      redacted[key] = val;
    }
  }
  
  return redacted;
}

const redactFormat = winston.format((info) => {
  // Redact in message string
  const msg = info.message;
  if (typeof msg === 'string') {
    let sanitizedMsg = msg;
    sensitivePatterns.forEach(pattern => {
      sanitizedMsg = sanitizedMsg.replace(pattern, (match: string) => {
        const parts = match.split('=');
        if (parts.length > 1) return `${parts[0]}=[REDACTED]`;
        if (match.toLowerCase().includes('bearer')) return 'Bearer [REDACTED]';
        return '[REDACTED]';
      });
    });
    info.message = sanitizedMsg;
  }
  
  // Redact recursively in meta fields/payloads, skipping winston internal keys
  const seen = new WeakSet();
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp') {
      continue;
    }
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') || 
      lowerKey.includes('token') || 
      lowerKey.includes('authorization') ||
      lowerKey.includes('secret')
    ) {
      const val = info[key];
      if (typeof val === 'string' && val.toLowerCase().startsWith('bearer ')) {
        info[key] = 'Bearer [REDACTED]';
      } else {
        info[key] = '[REDACTED]';
      }
    } else {
      info[key] = redactObject(info[key], seen);
    }
  }
  return info;
});

const logger = winston.createLogger({
  level: "info",
  levels: levels,
  format: winston.format.combine(redactFormat(), winston.format.json()),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({all:true}),
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;
