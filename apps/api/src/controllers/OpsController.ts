import type { Request, Response } from "express";
import type {
  BackupStatus,
  HealthStatus,
  ModerationStatus,
  MonitoringAlertStatus,
  RatingJobStatus,
  ReportTargetType
} from "../types/domain";
import type { OpsService } from "../services/OpsService";
import { sendSuccess } from "../utils/apiResponse";

export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  listProblemSolutions = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listSolutions(req.params.slug, {
      viewerId: req.user?.id,
      isAdmin: req.user?.role === "ADMIN",
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Solutions", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  getSolution = async (req: Request, res: Response): Promise<void> => {
    const solution = await this.opsService.getSolution(
      req.params.id,
      req.user ? { id: req.user.id, role: req.user.role } : undefined
    );
    sendSuccess(res, "Solution", solution);
  };

  createSolution = async (req: Request, res: Response): Promise<void> => {
    const solution = await this.opsService.createSolution(req.params.slug, req.user!.id, req.body);
    sendSuccess(res, "Solution shared", solution, undefined, 201);
  };

  updateSolution = async (req: Request, res: Response): Promise<void> => {
    const solution = await this.opsService.updateSolution(req.params.id, req.user!, req.body);
    sendSuccess(res, "Solution updated", solution);
  };

  deleteSolution = async (req: Request, res: Response): Promise<void> => {
    await this.opsService.deleteSolution(req.params.id, req.user!);
    sendSuccess(res, "Solution deleted", {});
  };

  voteSolution = async (req: Request, res: Response): Promise<void> => {
    const vote = await this.opsService.voteSolution(req.params.id, req.user!.id, req.body.value);
    sendSuccess(res, "Solution vote recorded", vote);
  };

  createReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.opsService.createReport(req.user?.id ?? null, req.body);
    sendSuccess(res, "Report submitted", report, undefined, 201);
  };

  listReports = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listReports({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status as ModerationStatus | undefined,
      targetType: req.query.targetType as ReportTargetType | undefined
    });
    sendSuccess(res, "Reports", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  updateReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.opsService.updateReport(req.params.id, req.user!.id, req.body);
    sendSuccess(res, "Report updated", report);
  };

  followUser = async (req: Request, res: Response): Promise<void> => {
    const result = await this.opsService.followUser(req.user!.id, req.params.username);
    sendSuccess(res, "User followed", result, undefined, 201);
  };

  unfollowUser = async (req: Request, res: Response): Promise<void> => {
    const result = await this.opsService.unfollowUser(req.user!.id, req.params.username);
    sendSuccess(res, "User unfollowed", result);
  };

  followStatus = async (req: Request, res: Response): Promise<void> => {
    const status = await this.opsService.followStatus(req.user?.id, req.params.username);
    sendSuccess(res, "Follow status", status);
  };

  followers = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listFollowers(req.params.username, {
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Followers", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  following = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listFollowing(req.params.username, {
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Following", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  notifications = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listNotifications(req.user!.id, {
      page: req.query.page,
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly as boolean | undefined
    });
    sendSuccess(res, "Notifications", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  markNotificationRead = async (req: Request, res: Response): Promise<void> => {
    const notification = await this.opsService.markNotificationRead(req.params.id, req.user!.id);
    sendSuccess(res, "Notification read", notification);
  };

  markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
    const result = await this.opsService.markAllNotificationsRead(req.user!.id);
    sendSuccess(res, "Notifications read", result);
  };

  auditLogs = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listAuditLogs({
      page: req.query.page,
      limit: req.query.limit,
      actorId: req.query.actorId as string | undefined,
      entityType: req.query.entityType as string | undefined
    });
    sendSuccess(res, "Audit logs", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  abuseAnalytics = async (req: Request, res: Response): Promise<void> => {
    const summary = await this.opsService.abuseAnalytics({ hours: req.query.hours });
    sendSuccess(res, "Abuse analytics", summary);
  };

  createBackup = async (req: Request, res: Response): Promise<void> => {
    const backup = await this.opsService.createBackup(req.user!.id);
    sendSuccess(res, "Backup run completed", backup, undefined, 201);
  };

  backups = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listBackups({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status as BackupStatus | undefined
    });
    sendSuccess(res, "Backups", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  productionStatus = async (_req: Request, res: Response): Promise<void> => {
    const status = await this.opsService.productionStatus();
    sendSuccess(res, "Production status", status);
  };

  snapshotHealth = async (req: Request, res: Response): Promise<void> => {
    const snapshot = await this.opsService.snapshotHealth(req.user!.id);
    sendSuccess(res, "Health snapshot saved", snapshot, undefined, 201);
  };

  healthSnapshots = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listHealthSnapshots({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status as HealthStatus | undefined
    });
    sendSuccess(res, "Health snapshots", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  monitoringAlerts = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listMonitoringAlerts({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status as MonitoringAlertStatus | undefined
    });
    sendSuccess(res, "Monitoring alerts", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
    const alert = await this.opsService.acknowledgeAlert(req.params.id, req.user!.id);
    sendSuccess(res, "Alert acknowledged", alert);
  };

  resolveAlert = async (req: Request, res: Response): Promise<void> => {
    const alert = await this.opsService.resolveAlert(req.params.id, req.user!.id);
    sendSuccess(res, "Alert resolved", alert);
  };

  rateContest = async (req: Request, res: Response): Promise<void> => {
    const events = await this.opsService.rateContest(req.params.id, req.user!.id);
    sendSuccess(res, "Contest ratings published", events, undefined, 201);
  };

  rollbackContestRatings = async (req: Request, res: Response): Promise<void> => {
    const result = await this.opsService.rollbackContestRatings(req.params.id, req.user!.id);
    sendSuccess(res, "Contest ratings rolled back", result);
  };

  scheduleRatingJob = async (req: Request, res: Response): Promise<void> => {
    const job = await this.opsService.scheduleRatingJob(req.params.id, req.user!.id, req.body);
    sendSuccess(res, "Rating job scheduled", job, undefined, 201);
  };

  ratingJobs = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.listRatingJobs({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status as RatingJobStatus | undefined
    });
    sendSuccess(res, "Rating jobs", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  processRatingJobs = async (req: Request, res: Response): Promise<void> => {
    const result = await this.opsService.processScheduledRatingJobs(req.user!.id);
    sendSuccess(res, "Rating jobs processed", result);
  };

  ratingsLeaderboard = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.ratingsLeaderboard({
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Ratings leaderboard", page.items, { total: page.total, page: page.page, limit: page.limit });
  };

  ratingHistory = async (req: Request, res: Response): Promise<void> => {
    const page = await this.opsService.ratingHistory(req.params.username, {
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Rating history", page.items, { total: page.total, page: page.page, limit: page.limit });
  };
}
