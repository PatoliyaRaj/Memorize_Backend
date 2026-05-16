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
const logger = winston.createLogger({
  level: "info",
  levels: levels,
  format: winston.format.json(),
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
