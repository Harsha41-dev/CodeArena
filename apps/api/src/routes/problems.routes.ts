import { Router } from "express";
import type { AppContext } from "../appContext";
import { ProblemController } from "../controllers/ProblemController";
import { authenticate, optionalAuthenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createProblemSchema,
  createTestCaseSchema,
  listProblemsSchema,
  problemIdParamSchema,
  problemSlugSchema,
  updateProblemSchema,
  updateTestCaseSchema
} from "../validators/problemValidators";

export function createProblemsRoutes(context: AppContext): Router {
  const router = Router();
  const problems = new ProblemController(context.services.problems);

  router.get("/tags", asyncHandler(problems.tags));
  router.get("/problems", optionalAuthenticate, validate(listProblemsSchema), asyncHandler(problems.list));
  router.get("/problems/:slug", validate(problemSlugSchema), asyncHandler(problems.get));
  router.post(
    "/problems",
    authenticate,
    requireRole("ADMIN"),
    validate(createProblemSchema),
    asyncHandler(problems.create)
  );
  router.patch(
    "/problems/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateProblemSchema),
    asyncHandler(problems.update)
  );
  router.delete(
    "/problems/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(problemIdParamSchema),
    asyncHandler(problems.archive)
  );

  router.post(
    "/problems/:id/testcases",
    authenticate,
    requireRole("ADMIN"),
    validate(createTestCaseSchema),
    asyncHandler(problems.addTestCase)
  );
  router.patch(
    "/testcases/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateTestCaseSchema),
    asyncHandler(problems.updateTestCase)
  );
  router.delete(
    "/testcases/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(problemIdParamSchema),
    asyncHandler(problems.deleteTestCase)
  );

  return router;
}
