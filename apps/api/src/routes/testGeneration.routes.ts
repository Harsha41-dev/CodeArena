import { Router } from "express";
import type { AppContext } from "../appContext";
import { TestCaseGenerationController } from "../controllers/TestCaseGenerationController";
import { authenticate } from "../middlewares/auth";
import { testGenerationRateLimit } from "../middlewares/rateLimits";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  checkerModeSchema,
  checkerPreviewSchema,
  generationBatchIdSchema,
  generationJobCreateSchema,
  generationJobIdSchema,
  generationPreviewSchema,
  generationProblemIdSchema,
  problemAssetCreateSchema,
  problemAssetIdSchema,
  problemAssetUpdateSchema
} from "../validators/testCaseGenerationValidators";

export function createTestGenerationRoutes(context: AppContext): Router {
  const router = Router();
  const testGeneration = new TestCaseGenerationController(context.services.testCaseGeneration);

  router.get(
    "/admin/problems/:problemId/assets",
    authenticate,
    requireRole("ADMIN"),
    validate(generationProblemIdSchema),
    asyncHandler(testGeneration.listAssets)
  );
  router.post(
    "/admin/problems/:problemId/assets",
    testGenerationRateLimit,
    authenticate,
    requireRole("ADMIN"),
    validate(problemAssetCreateSchema),
    asyncHandler(testGeneration.createAsset)
  );
  router.patch(
    "/admin/problem-assets/:assetId",
    authenticate,
    requireRole("ADMIN"),
    validate(problemAssetUpdateSchema),
    asyncHandler(testGeneration.updateAsset)
  );
  router.delete(
    "/admin/problem-assets/:assetId",
    authenticate,
    requireRole("ADMIN"),
    validate(problemAssetIdSchema),
    asyncHandler(testGeneration.deleteAsset)
  );
  router.patch(
    "/admin/problems/:problemId/checker-mode",
    authenticate,
    requireRole("ADMIN"),
    validate(checkerModeSchema),
    asyncHandler(testGeneration.setCheckerMode)
  );
  router.post(
    "/admin/problems/:problemId/checker/preview",
    testGenerationRateLimit,
    authenticate,
    requireRole("ADMIN"),
    validate(checkerPreviewSchema),
    asyncHandler(testGeneration.previewChecker)
  );
  router.post(
    "/admin/problems/:problemId/test-generation/preview",
    testGenerationRateLimit,
    authenticate,
    requireRole("ADMIN"),
    validate(generationPreviewSchema),
    asyncHandler(testGeneration.preview)
  );
  router.post(
    "/admin/problems/:problemId/test-generation-jobs",
    testGenerationRateLimit,
    authenticate,
    requireRole("ADMIN"),
    validate(generationJobCreateSchema),
    asyncHandler(testGeneration.createJob)
  );
  router.get(
    "/admin/problems/:problemId/test-generation-jobs",
    authenticate,
    requireRole("ADMIN"),
    validate(generationProblemIdSchema),
    asyncHandler(testGeneration.listJobs)
  );
  router.get(
    "/admin/test-generation-jobs/:jobId",
    authenticate,
    requireRole("ADMIN"),
    validate(generationJobIdSchema),
    asyncHandler(testGeneration.getJob)
  );
  router.post(
    "/admin/test-generation-jobs/:jobId/cancel",
    authenticate,
    requireRole("ADMIN"),
    validate(generationJobIdSchema),
    asyncHandler(testGeneration.cancelJob)
  );
  router.get(
    "/admin/problems/:problemId/testcase-batches",
    authenticate,
    requireRole("ADMIN"),
    validate(generationProblemIdSchema),
    asyncHandler(testGeneration.listBatches)
  );
  router.delete(
    "/admin/testcase-batches/:batchId",
    authenticate,
    requireRole("ADMIN"),
    validate(generationBatchIdSchema),
    asyncHandler(testGeneration.deleteBatch)
  );

  return router;
}
