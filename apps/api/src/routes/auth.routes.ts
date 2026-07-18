import { Router } from "express";
import type { AppContext } from "../appContext";
import { AuthController } from "../controllers/AuthController";
import { authenticate } from "../middlewares/auth";
import { authRateLimit } from "../middlewares/rateLimits";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "../validators/authValidators";

export function createAuthRoutes(context: AppContext): Router {
  const router = Router();
  const auth = new AuthController(context.services.auth);

  router.post("/auth/register", authRateLimit, validate(registerSchema), asyncHandler(auth.register));
  router.post("/auth/login", authRateLimit, validate(loginSchema), asyncHandler(auth.login));
  router.post("/auth/refresh", authRateLimit, validate(refreshSchema), asyncHandler(auth.refresh));
  router.post("/auth/logout", validate(logoutSchema), asyncHandler(auth.logout));
  router.get("/auth/me", authenticate, asyncHandler(auth.me));

  return router;
}
