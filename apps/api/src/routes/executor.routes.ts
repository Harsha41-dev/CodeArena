import { Router } from "express";
import type { AppContext } from "../appContext";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { executorCapabilitiesSchema } from "../validators/executorValidators";

export function createExecutorRoutes(context: AppContext): Router {
  const router = Router();

  router.get(
    "/executor/capabilities",
    validate(executorCapabilitiesSchema),
    asyncHandler(async (req, res) => {
      sendSuccess(res, "Executor capabilities", await context.services.executorCapabilities.capabilities(req.query));
    })
  );
  router.get(
    "/executor/health",
    asyncHandler(async (_req, res) => {
      sendSuccess(res, "Executor health", await context.services.executorCapabilities.publicHealth());
    })
  );

  router.get(
    "/admin/executor/capabilities",
    authenticate,
    requireRole("ADMIN"),
    validate(executorCapabilitiesSchema),
    asyncHandler(async (req, res) => {
      sendSuccess(
        res,
        "Admin executor capabilities",
        await context.services.executorCapabilities.capabilities({ ...req.query, admin: true })
      );
    })
  );
  router.get(
    "/admin/executor/health",
    authenticate,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      sendSuccess(res, "Executor health", await context.services.executorCapabilities.health(true));
    })
  );
  router.get(
    "/admin/judge/queue",
    authenticate,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      sendSuccess(res, "Judge queue", await context.queue.getMetrics());
    })
  );
  router.get(
    "/admin/health/deep",
    authenticate,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      const [database, queue, testGenerationQueue, executor] = await Promise.all([
        context.repository.healthCheck(),
        context.queue.getMetrics().catch(() => ({
          driver: process.env.REDIS_URL ? ("bullmq" as const) : ("memory" as const),
          waiting: 0,
          pending: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 0,
          workerStatus: "unavailable" as const
        })),
        context.testCaseGenerationQueue.getMetrics(),
        context.services.executorCapabilities.health(true)
      ]);
      sendSuccess(res, "Deep health", {
        api: { ok: true, uptime: process.uptime() },
        database,
        redis: { configured: Boolean(process.env.REDIS_URL), ok: queue.driver === "bullmq" ? true : undefined },
        queue,
        testGenerationQueue,
        executor,
        timestamp: new Date().toISOString()
      });
    })
  );

  return router;
}
