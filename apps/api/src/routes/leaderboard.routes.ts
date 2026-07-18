import { Router } from "express";
import type { AppContext } from "../appContext";
import { LeaderboardController } from "../controllers/LeaderboardController";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { problemSlugSchema } from "../validators/problemValidators";

export function createLeaderboardRoutes(context: AppContext): Router {
  const router = Router();
  const leaderboards = new LeaderboardController(context.services.leaderboards);

  router.get("/leaderboard", asyncHandler(leaderboards.global));
  router.post("/leaderboard/snapshot", authenticate, requireRole("ADMIN"), asyncHandler(leaderboards.snapshot));
  router.get("/problems/:slug/leaderboard", validate(problemSlugSchema), asyncHandler(leaderboards.problem));

  return router;
}
