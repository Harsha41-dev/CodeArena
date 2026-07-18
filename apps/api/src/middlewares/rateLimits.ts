import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { ApiError } from "../errors/ApiError";

// in tests we allow a lot more so suites don't flake
function limitFor(nonTestLimit: number): number {
  if (env.NODE_ENV === "test") {
    return 1000;
  }
  return nonTestLimit;
}

// login / register etc - 30 per 15 min in prod
export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: limitFor(30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests("Too many authentication attempts. Try again later."));
  }
});

// code run / submit - 20 per minute
export const codeExecutionRateLimit = rateLimit({
  windowMs: 60_000,
  limit: limitFor(20),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests("Too many code execution requests. Try again later."));
  }
});

// test generation is heavier so lower limit
export const testGenerationRateLimit = rateLimit({
  windowMs: 60_000,
  limit: limitFor(10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests("Too many test generation requests. Try again later."));
  }
});
