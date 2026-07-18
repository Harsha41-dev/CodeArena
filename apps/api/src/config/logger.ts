import pino from "pino";

// don't log secrets / source code
export const loggerRedactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "req.headers['x-rapidapi-key']",
  "req.body.password",
  "req.body.refreshToken",
  "req.body.code",
  "body.password",
  "body.refreshToken",
  "body.code",
  "request.sourceCode",
  "sourceCode"
];

// pretty logs in dev, plain json in prod
const isProduction = process.env.NODE_ENV === "production";

let transport: pino.LoggerOptions["transport"] = undefined;
if (!isProduction) {
  transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      singleLine: true
    }
  };
}

export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: loggerRedactPaths,
    censor: "[Redacted]"
  },
  transport
};

export const logger = pino(loggerOptions);
