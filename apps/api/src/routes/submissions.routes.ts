import { Router } from "express";
import type { AppContext } from "../appContext";
import { SubmissionController } from "../controllers/SubmissionController";
import { authenticate } from "../middlewares/auth";
import { codeExecutionRateLimit } from "../middlewares/rateLimits";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { problemSlugSchema } from "../validators/problemValidators";
import {
  listSubmissionsSchema,
  rejudgeManySubmissionsSchema,
  runCodeSchema,
  runCustomCodeSchema,
  submissionIdSchema,
  submitCodeSchema
} from "../validators/submissionValidators";

export function createSubmissionsRoutes(context: AppContext): Router {
  const router = Router();
  const submissions = new SubmissionController(context.services.submissions, context.submissionEvents);

  router.get(
    "/problems/:slug/submissions",
    authenticate,
    validate(problemSlugSchema),
    asyncHandler(submissions.byProblem)
  );
  router.post("/run", codeExecutionRateLimit, authenticate, validate(runCodeSchema), asyncHandler(submissions.run));
  router.post(
    "/run/custom",
    codeExecutionRateLimit,
    authenticate,
    validate(runCustomCodeSchema),
    asyncHandler(submissions.runCustom)
  );
  router.post(
    "/submit",
    codeExecutionRateLimit,
    authenticate,
    validate(submitCodeSchema),
    asyncHandler(submissions.submit)
  );
  router.post(
    "/admin/submissions/rejudge",
    authenticate,
    requireRole("ADMIN"),
    validate(rejudgeManySubmissionsSchema),
    asyncHandler(submissions.rejudgeMany)
  );
  router.post(
    "/admin/submissions/:id/rejudge",
    authenticate,
    requireRole("ADMIN"),
    validate(submissionIdSchema),
    asyncHandler(submissions.rejudge)
  );
  router.get("/submissions/:id/events", authenticate, validate(submissionIdSchema), asyncHandler(submissions.events));
  router.get("/submissions/:id", authenticate, validate(submissionIdSchema), asyncHandler(submissions.get));
  router.get("/submissions", authenticate, validate(listSubmissionsSchema), asyncHandler(submissions.list));

  return router;
}
