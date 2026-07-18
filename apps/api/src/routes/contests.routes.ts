import { Router } from "express";
import type { AppContext } from "../appContext";
import { ContestController } from "../controllers/ContestController";
import { authenticate } from "../middlewares/auth";
import { codeExecutionRateLimit } from "../middlewares/rateLimits";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  addContestProblemSchema,
  contestIdSchema,
  createContestSchema,
  removeContestProblemSchema,
  updateContestSchema
} from "../validators/contestValidators";
import { contestSubmitCodeSchema } from "../validators/submissionValidators";

export function createContestsRoutes(context: AppContext): Router {
  const router = Router();
  const contests = new ContestController(context.services.contests, context.services.submissions);

  router.get("/contests", asyncHandler(contests.list));
  router.get("/contests/:id", validate(contestIdSchema), asyncHandler(contests.get));
  router.post(
    "/contests",
    authenticate,
    requireRole("ADMIN"),
    validate(createContestSchema),
    asyncHandler(contests.create)
  );
  router.post("/contests/:id/register", authenticate, validate(contestIdSchema), asyncHandler(contests.register));
  router.get("/contests/:id/leaderboard", validate(contestIdSchema), asyncHandler(contests.leaderboard));
  router.post(
    "/contests/:id/submit",
    codeExecutionRateLimit,
    authenticate,
    validate(contestSubmitCodeSchema),
    asyncHandler(contests.submit)
  );

  router.get("/admin/contests", authenticate, requireRole("ADMIN"), asyncHandler(contests.adminList));
  router.post(
    "/admin/contests",
    authenticate,
    requireRole("ADMIN"),
    validate(createContestSchema),
    asyncHandler(contests.create)
  );
  router.get(
    "/admin/contests/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(contestIdSchema),
    asyncHandler(contests.adminGet)
  );
  router.patch(
    "/admin/contests/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateContestSchema),
    asyncHandler(contests.update)
  );
  router.delete(
    "/admin/contests/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(contestIdSchema),
    asyncHandler(contests.delete)
  );
  router.post(
    "/admin/contests/:id/problems",
    authenticate,
    requireRole("ADMIN"),
    validate(addContestProblemSchema),
    asyncHandler(contests.addProblem)
  );
  router.delete(
    "/admin/contests/:id/problems/:problemId",
    authenticate,
    requireRole("ADMIN"),
    validate(removeContestProblemSchema),
    asyncHandler(contests.removeProblem)
  );

  return router;
}
