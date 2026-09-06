import { Router } from "express";
import type { AppContext } from "../appContext";
import { createAuthRoutes } from "./auth.routes";
import { createContestsRoutes } from "./contests.routes";
import { createExecutorRoutes } from "./executor.routes";
import { createLanguagesRoutes } from "./languages.routes";
import { createLeaderboardRoutes } from "./leaderboard.routes";
import { createOpsRoutes } from "./ops.routes";
import { createPracticeRoutes } from "./practice.routes";
import { createProblemsRoutes } from "./problems.routes";
import { createSocialRoutes } from "./social.routes";
import { createSubmissionsRoutes } from "./submissions.routes";
import { createTestGenerationRoutes } from "./testGeneration.routes";
import { createUsersRoutes } from "./users.routes";

export function createApiRouter(context: AppContext): Router {
  const router = Router();

  router.use(createAuthRoutes(context));
  router.use(createUsersRoutes(context));
  router.use(createLanguagesRoutes(context));
  router.use(createExecutorRoutes(context));
  router.use(createProblemsRoutes(context));
  router.use(createSubmissionsRoutes(context));
  router.use(createLeaderboardRoutes(context));
  router.use(createContestsRoutes(context));
  router.use(createPracticeRoutes(context));
  router.use(createTestGenerationRoutes(context));
  router.use(createSocialRoutes(context));
  router.use(createOpsRoutes(context));

  return router;
}
