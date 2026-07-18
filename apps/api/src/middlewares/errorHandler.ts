import type { ErrorRequestHandler } from "express";
import { ApiError } from "../errors/ApiError";
import { logger } from "../config/logger";

// last middleware — turns thrown errors into JSON responses
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
        details: err.details ? err.details : {}
      }
    });
    return;
  }

  // unexpected errors — don't leak stack to client
  logger.error({ err }, "Unhandled API error");
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: {
      code: "INTERNAL_ERROR",
      details: {}
    }
  });
};
