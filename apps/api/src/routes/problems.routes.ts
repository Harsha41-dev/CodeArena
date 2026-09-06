import { Router } from "express";
import type { AppContext } from "../appContext";
import { ProblemController } from "../controllers/ProblemController";
import { authenticate, optionalAuthenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  adminListProblemsSchema,
  collectionIdSchema,
  collectionListSchema,
  createBadgeDefinitionSchema,
  createLearningCollectionSchema,
  createProblemSchema,
  createTestCaseSchema,
  listBadgeDefinitionsSchema,
  listDailyChallengesSchema,
  listProblemsSchema,
  problemIdParamSchema,
  problemSlugSchema,
  setLearningCollectionItemsSchema,
  updateBadgeDefinitionSchema,
  updateLearningCollectionSchema,
  updateProblemSchema,
  updateTestCaseSchema,
  upsertDailyChallengeSchema
} from "../validators/problemValidators";

export function createProblemsRoutes(context: AppContext): Router {
  const router = Router();
  const problems = new ProblemController(context.services.problems);

  router.get("/tags", asyncHandler(problems.tags));
  router.get("/companies", asyncHandler(problems.companies));
  router.get("/daily-challenge", optionalAuthenticate, asyncHandler(problems.dailyChallenge));
  router.get("/problem-sets", optionalAuthenticate, asyncHandler(problems.problemSets));
  router.get("/problem-sets/:slug", optionalAuthenticate, validate(problemSlugSchema), asyncHandler(problems.problemSet));
  router.get("/recommendations/next", optionalAuthenticate, asyncHandler(problems.nextRecommendation));
  router.get("/study-plans", optionalAuthenticate, asyncHandler(problems.studyPlans));
  router.get("/study-plans/:slug", optionalAuthenticate, validate(problemSlugSchema), asyncHandler(problems.studyPlan));
  router.get("/revision-queue", optionalAuthenticate, asyncHandler(problems.revisionQueue));
  router.get(
    "/admin/problems",
    authenticate,
    requireRole("ADMIN"),
    validate(adminListProblemsSchema),
    asyncHandler(problems.adminList)
  );
  router.get(
    "/admin/problem-sets",
    authenticate,
    requireRole("ADMIN"),
    validate(collectionListSchema),
    asyncHandler(problems.adminProblemSets)
  );
  router.post(
    "/admin/problem-sets",
    authenticate,
    requireRole("ADMIN"),
    validate(createLearningCollectionSchema),
    asyncHandler(problems.createProblemSet)
  );
  router.get(
    "/admin/study-plans",
    authenticate,
    requireRole("ADMIN"),
    validate(collectionListSchema),
    asyncHandler(problems.adminStudyPlans)
  );
  router.post(
    "/admin/study-plans",
    authenticate,
    requireRole("ADMIN"),
    validate(createLearningCollectionSchema),
    asyncHandler(problems.createStudyPlan)
  );
  router.patch(
    "/admin/learning-collections/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateLearningCollectionSchema),
    asyncHandler(problems.updateCollection)
  );
  router.delete(
    "/admin/learning-collections/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(collectionIdSchema),
    asyncHandler(problems.deleteCollection)
  );
  router.put(
    "/admin/learning-collections/:id/items",
    authenticate,
    requireRole("ADMIN"),
    validate(setLearningCollectionItemsSchema),
    asyncHandler(problems.setCollectionItems)
  );
  router.get(
    "/admin/daily-challenges",
    authenticate,
    requireRole("ADMIN"),
    validate(listDailyChallengesSchema),
    asyncHandler(problems.adminDailyChallenges)
  );
  router.put(
    "/admin/daily-challenges/:date",
    authenticate,
    requireRole("ADMIN"),
    validate(upsertDailyChallengeSchema),
    asyncHandler(problems.upsertDailyChallenge)
  );
  router.get(
    "/admin/badges",
    authenticate,
    requireRole("ADMIN"),
    validate(listBadgeDefinitionsSchema),
    asyncHandler(problems.badgeDefinitions)
  );
  router.post(
    "/admin/badges",
    authenticate,
    requireRole("ADMIN"),
    validate(createBadgeDefinitionSchema),
    asyncHandler(problems.createBadgeDefinition)
  );
  router.patch(
    "/admin/badges/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateBadgeDefinitionSchema),
    asyncHandler(problems.updateBadgeDefinition)
  );
  router.get("/problems", optionalAuthenticate, validate(listProblemsSchema), asyncHandler(problems.list));
  router.get("/problems/:slug", optionalAuthenticate, validate(problemSlugSchema), asyncHandler(problems.get));
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
