import { Router } from "express";
import type { AppContext } from "../appContext";
import { OpsController } from "../controllers/OpsController";
import { authenticate, optionalAuthenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  abuseAnalyticsSchema,
  alertIdSchema,
  contestIdSchema,
  createReportSchema,
  createSolutionSchema,
  listAuditLogsSchema,
  listBackupsSchema,
  listHealthSnapshotsSchema,
  listMonitoringAlertsSchema,
  listNotificationsSchema,
  listProblemSolutionsSchema,
  listRatingJobsSchema,
  listRatingsSchema,
  listReportsSchema,
  listUserConnectionsSchema,
  notificationIdSchema,
  scheduleRatingJobSchema,
  solutionIdSchema,
  updateReportSchema,
  updateSolutionSchema,
  usernameSchema,
  voteSolutionSchema
} from "../validators/opsValidators";

export function createOpsRoutes(context: AppContext): Router {
  const router = Router();
  const ops = new OpsController(context.services.ops);

  router.get(
    "/problems/:slug/solutions",
    optionalAuthenticate,
    validate(listProblemSolutionsSchema),
    asyncHandler(ops.listProblemSolutions)
  );
  router.post(
    "/problems/:slug/solutions",
    authenticate,
    validate(createSolutionSchema),
    asyncHandler(ops.createSolution)
  );
  router.get("/solutions/:id", optionalAuthenticate, validate(solutionIdSchema), asyncHandler(ops.getSolution));
  router.patch("/solutions/:id", authenticate, validate(updateSolutionSchema), asyncHandler(ops.updateSolution));
  router.delete("/solutions/:id", authenticate, validate(solutionIdSchema), asyncHandler(ops.deleteSolution));
  router.post("/solutions/:id/vote", authenticate, validate(voteSolutionSchema), asyncHandler(ops.voteSolution));

  router.post("/reports", optionalAuthenticate, validate(createReportSchema), asyncHandler(ops.createReport));

  router.get("/users/:username/follow-status", optionalAuthenticate, validate(usernameSchema), asyncHandler(ops.followStatus));
  router.post("/users/:username/follow", authenticate, validate(usernameSchema), asyncHandler(ops.followUser));
  router.delete("/users/:username/follow", authenticate, validate(usernameSchema), asyncHandler(ops.unfollowUser));
  router.get("/users/:username/followers", validate(listUserConnectionsSchema), asyncHandler(ops.followers));
  router.get("/users/:username/following", validate(listUserConnectionsSchema), asyncHandler(ops.following));

  router.get("/notifications", authenticate, validate(listNotificationsSchema), asyncHandler(ops.notifications));
  router.patch(
    "/notifications/:id/read",
    authenticate,
    validate(notificationIdSchema),
    asyncHandler(ops.markNotificationRead)
  );
  router.patch("/notifications/read-all", authenticate, asyncHandler(ops.markAllNotificationsRead));

  router.get("/ratings", validate(listRatingsSchema), asyncHandler(ops.ratingsLeaderboard));
  router.get("/users/:username/ratings", validate(listUserConnectionsSchema), asyncHandler(ops.ratingHistory));

  router.get(
    "/admin/reports",
    authenticate,
    requireRole("ADMIN"),
    validate(listReportsSchema),
    asyncHandler(ops.listReports)
  );
  router.patch(
    "/admin/reports/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateReportSchema),
    asyncHandler(ops.updateReport)
  );
  router.get(
    "/admin/audit-logs",
    authenticate,
    requireRole("ADMIN"),
    validate(listAuditLogsSchema),
    asyncHandler(ops.auditLogs)
  );
  router.get(
    "/admin/analytics/abuse",
    authenticate,
    requireRole("ADMIN"),
    validate(abuseAnalyticsSchema),
    asyncHandler(ops.abuseAnalytics)
  );
  router.get(
    "/admin/backups",
    authenticate,
    requireRole("ADMIN"),
    validate(listBackupsSchema),
    asyncHandler(ops.backups)
  );
  router.post("/admin/backups", authenticate, requireRole("ADMIN"), asyncHandler(ops.createBackup));
  router.get("/admin/monitoring/status", authenticate, requireRole("ADMIN"), asyncHandler(ops.productionStatus));
  router.post("/admin/monitoring/snapshots", authenticate, requireRole("ADMIN"), asyncHandler(ops.snapshotHealth));
  router.get(
    "/admin/monitoring/snapshots",
    authenticate,
    requireRole("ADMIN"),
    validate(listHealthSnapshotsSchema),
    asyncHandler(ops.healthSnapshots)
  );
  router.get(
    "/admin/monitoring/alerts",
    authenticate,
    requireRole("ADMIN"),
    validate(listMonitoringAlertsSchema),
    asyncHandler(ops.monitoringAlerts)
  );
  router.patch(
    "/admin/monitoring/alerts/:id/acknowledge",
    authenticate,
    requireRole("ADMIN"),
    validate(alertIdSchema),
    asyncHandler(ops.acknowledgeAlert)
  );
  router.patch(
    "/admin/monitoring/alerts/:id/resolve",
    authenticate,
    requireRole("ADMIN"),
    validate(alertIdSchema),
    asyncHandler(ops.resolveAlert)
  );
  router.post(
    "/admin/contests/:id/rate",
    authenticate,
    requireRole("ADMIN"),
    validate(contestIdSchema),
    asyncHandler(ops.rateContest)
  );
  router.post(
    "/admin/contests/:id/ratings/rollback",
    authenticate,
    requireRole("ADMIN"),
    validate(contestIdSchema),
    asyncHandler(ops.rollbackContestRatings)
  );
  router.post(
    "/admin/contests/:id/rating-jobs",
    authenticate,
    requireRole("ADMIN"),
    validate(scheduleRatingJobSchema),
    asyncHandler(ops.scheduleRatingJob)
  );
  router.get(
    "/admin/ratings/jobs",
    authenticate,
    requireRole("ADMIN"),
    validate(listRatingJobsSchema),
    asyncHandler(ops.ratingJobs)
  );
  router.post(
    "/admin/ratings/jobs/process",
    authenticate,
    requireRole("ADMIN"),
    asyncHandler(ops.processRatingJobs)
  );

  return router;
}
