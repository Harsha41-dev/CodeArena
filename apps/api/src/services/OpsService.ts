import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../errors/ApiError";
import type {
  AppRepository,
  ContestLeaderboardRow,
  CreateReportInput,
  UpdateReportInput
} from "../repositories/AppRepository";
import type { QueueMetrics, SubmissionQueue } from "../queue/SubmissionQueue";
import type {
  PublicUser,
  HealthStatus,
  ModerationStatus,
  ReportTargetType,
  SolutionVisibility,
  User,
  UserRating
} from "../types/domain";
import type { ExecutorCapabilityService } from "./executorCapability.service";
import { getPagination } from "../utils/pagination";

type RatingState = Pick<UserRating, "rating" | "volatility" | "contestsRated">;
type PathTrafficStats = { count: number; errors: number; totalDurationMs: number };
type ActorTrafficStats = { key: string; requests: number; errors: number; rateLimited: number; codeRuns: number };

export class OpsService {
  constructor(
    private readonly repository: AppRepository,
    private readonly queue: SubmissionQueue,
    private readonly executorCapabilities: ExecutorCapabilityService
  ) {}

  async listSolutions(slug: string, input: { viewerId?: string; isAdmin?: boolean; page?: unknown; limit?: unknown }) {
    const problem = await this.requirePublicProblem(slug);
    const pagination = getPagination(input);
    return this.repository.listSolutions({
      problemId: problem.id,
      viewerId: input.viewerId,
      includePrivate: input.isAdmin,
      page: pagination.page,
      limit: pagination.limit
    });
  }

  async getSolution(id: string, viewer?: { id: string; role: "USER" | "ADMIN" }) {
    const solution = await this.repository.findSolutionById(id);
    if (!solution) {
      throw ApiError.notFound("Solution not found");
    }
    if (!this.canViewSolution(solution, viewer)) {
      throw ApiError.notFound("Solution not found");
    }
    return solution;
  }

  async createSolution(
    slug: string,
    authorId: string,
    input: {
      submissionId?: string | null;
      title: string;
      content: string;
      code?: string;
      language?: string;
      timeComplexity?: string | null;
      spaceComplexity?: string | null;
      visibility?: SolutionVisibility;
    }
  ) {
    const problem = await this.requirePublicProblem(slug);
    let code = input.code;
    let language = input.language;
    const submissionId = input.submissionId ?? null;

    if (submissionId) {
      const submission = await this.repository.findSubmissionById(submissionId);
      if (!submission) {
        throw ApiError.notFound("Submission not found");
      }
      if (submission.userId !== authorId) {
        throw ApiError.forbidden("Only the submission owner can share this solution");
      }
      if (submission.problemId !== problem.id) {
        throw ApiError.badRequest("Submission does not belong to this problem");
      }
      if (submission.status !== "ACCEPTED") {
        throw ApiError.badRequest("Only accepted submissions can be shared as solutions");
      }
      code = code ?? submission.code;
      language = language ?? submission.languageNameSnapshot ?? submission.languageKeySnapshot ?? submission.language;
    }

    if (!code || !language) {
      throw ApiError.badRequest("Code and language are required when not sharing an accepted submission");
    }

    const solution = await this.repository.createSolution({
      problemId: problem.id,
      authorId,
      submissionId,
      title: input.title,
      content: input.content,
      code,
      language,
      timeComplexity: input.timeComplexity ?? null,
      spaceComplexity: input.spaceComplexity ?? null,
      visibility: input.visibility ?? "PUBLIC"
    });

    await this.notifyFollowers(
      authorId,
      "New solution shared",
      `${solution.title} was shared for ${problem.title}.`,
      `/problems/${problem.slug}?tab=solutions`
    );

    return solution;
  }

  async updateSolution(
    id: string,
    actor: { id: string; role: "USER" | "ADMIN" },
    input: {
      title?: string;
      content?: string;
      code?: string;
      language?: string;
      timeComplexity?: string | null;
      spaceComplexity?: string | null;
      visibility?: SolutionVisibility;
      isPinned?: boolean;
    }
  ) {
    const solution = await this.repository.findSolutionById(id);
    if (!solution) throw ApiError.notFound("Solution not found");
    if (actor.role !== "ADMIN" && solution.authorId !== actor.id) {
      throw ApiError.forbidden("Only the author can update this solution");
    }

    const patch = { ...input };
    if (actor.role !== "ADMIN") {
      delete patch.isPinned;
    }
    return this.repository.updateSolution(id, patch);
  }

  async deleteSolution(id: string, actor: { id: string; role: "USER" | "ADMIN" }): Promise<void> {
    const solution = await this.repository.findSolutionById(id);
    if (!solution) throw ApiError.notFound("Solution not found");
    if (actor.role !== "ADMIN" && solution.authorId !== actor.id) {
      throw ApiError.forbidden("Only the author can delete this solution");
    }
    await this.repository.deleteSolution(id);
  }

  async voteSolution(id: string, voterId: string, value: 1 | -1) {
    const solution = await this.getSolution(id, { id: voterId, role: "USER" });
    if (solution.authorId === voterId) {
      throw ApiError.badRequest("You cannot vote on your own solution");
    }
    const vote = await this.repository.voteSolution(id, voterId, value);
    if (value === 1 && solution.authorId !== voterId) {
      await this.repository.createNotification({
        userId: solution.authorId,
        actorId: voterId,
        type: "SOLUTION_VOTE",
        title: "Solution upvoted",
        body: `${solution.title} received an upvote.`,
        link: solution.problem ? `/problems/${solution.problem.slug}?tab=solutions` : "/profile"
      });
    }
    return vote;
  }

  async createReport(reporterId: string | null, input: CreateReportInput) {
    await this.validateReportTarget(input.targetType, input.targetId, reporterId);
    const report = await this.repository.createReport({
      targetType: input.targetType,
      targetId: input.targetId,
      reporterId,
      reason: input.reason,
      details: input.details ?? null
    });
    await this.repository.createAuditLog({
      actorId: reporterId,
      action: "REPORT_CREATED",
      entityType: input.targetType,
      entityId: input.targetId,
      details: { reason: input.reason }
    });
    return report;
  }

  async listReports(input: {
    page?: unknown;
    limit?: unknown;
    status?: ModerationStatus;
    targetType?: ReportTargetType;
  }) {
    const pagination = getPagination(input);
    return this.repository.listReports({
      page: pagination.page,
      limit: pagination.limit,
      status: input.status,
      targetType: input.targetType
    });
  }

  async updateReport(id: string, moderatorId: string, input: UpdateReportInput) {
    const resolvedStatuses: ModerationStatus[] = ["RESOLVED", "DISMISSED"];
    const patch = {
      ...input,
      moderatorId,
      resolvedAt: input.status && resolvedStatuses.includes(input.status) ? new Date() : input.resolvedAt
    };
    const updated = await this.repository.updateReport(id, patch);
    if (updated.reporterId && input.status) {
      await this.repository.createNotification({
        userId: updated.reporterId,
        actorId: moderatorId,
        type: "REPORT_STATUS",
        title: "Report updated",
        body: `Your report is now ${input.status.toLowerCase()}.`,
        link: "/profile"
      });
    }
    return updated;
  }

  async followUser(followerId: string, username: string) {
    const follower = await this.repository.findUserById(followerId);
    const target = await this.repository.findUserByUsername(username);
    if (!follower || !target || target.status !== "ACTIVE") {
      throw ApiError.notFound("User not found");
    }
    if (target.id === followerId) {
      throw ApiError.badRequest("You cannot follow yourself");
    }
    const follow = await this.repository.followUser(followerId, target.id);
    await this.repository.createNotification({
      userId: target.id,
      actorId: followerId,
      type: "FOLLOW",
      title: "New follower",
      body: `${follower.displayName} started following you.`,
      link: `/u/${follower.username}`
    });
    return { following: true, follow };
  }

  async unfollowUser(followerId: string, username: string) {
    const target = await this.repository.findUserByUsername(username);
    if (!target) throw ApiError.notFound("User not found");
    await this.repository.unfollowUser(followerId, target.id);
    return { following: false };
  }

  async followStatus(followerId: string | undefined, username: string) {
    const target = await this.repository.findUserByUsername(username);
    if (!target || target.status !== "ACTIVE") {
      throw ApiError.notFound("User not found");
    }
    const [followers, following, isFollowing] = await Promise.all([
      this.repository.countFollowers(target.id),
      this.repository.countFollowing(target.id),
      followerId ? this.repository.isFollowing(followerId, target.id) : false
    ]);
    return { isFollowing, followers, following };
  }

  async listFollowers(username: string, input: { page?: unknown; limit?: unknown }) {
    const target = await this.repository.findUserByUsername(username);
    if (!target) throw ApiError.notFound("User not found");
    const pagination = getPagination(input);
    const page = await this.repository.listFollowers(target.id, pagination);
    return { ...page, items: page.items.map(publicUser) };
  }

  async listFollowing(username: string, input: { page?: unknown; limit?: unknown }) {
    const target = await this.repository.findUserByUsername(username);
    if (!target) throw ApiError.notFound("User not found");
    const pagination = getPagination(input);
    const page = await this.repository.listFollowing(target.id, pagination);
    return { ...page, items: page.items.map(publicUser) };
  }

  async listNotifications(userId: string, input: { page?: unknown; limit?: unknown; unreadOnly?: boolean }) {
    const pagination = getPagination(input);
    return this.repository.listNotifications({
      userId,
      page: pagination.page,
      limit: pagination.limit,
      unreadOnly: input.unreadOnly
    });
  }

  async markNotificationRead(id: string, userId: string) {
    return this.repository.markNotificationRead(id, userId);
  }

  async markAllNotificationsRead(userId: string) {
    return { updated: await this.repository.markAllNotificationsRead(userId) };
  }

  async listAuditLogs(input: { page?: unknown; limit?: unknown; actorId?: string; entityType?: string }) {
    const pagination = getPagination(input);
    return this.repository.listAuditLogs({
      page: pagination.page,
      limit: pagination.limit,
      actorId: input.actorId,
      entityType: input.entityType
    });
  }

  async abuseAnalytics(input: { hours?: unknown } = {}) {
    const hours = analyticsWindowHours(input.hours);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [events, openReports] = await Promise.all([
      this.repository.listApiUsageEvents({ page: 1, limit: 1000, since }),
      this.repository.listReports({ page: 1, limit: 1, status: "OPEN" })
    ]);

    const byPath = new Map<string, PathTrafficStats>();
    const byActor = new Map<string, ActorTrafficStats>();
    let rateLimitedRequests = 0;
    let errorRequests = 0;
    let totalDurationMs = 0;

    for (const event of events.items) {
      totalDurationMs += event.durationMs;
      if (event.rateLimited) rateLimitedRequests += 1;
      if (event.statusCode >= 400) errorRequests += 1;

      const pathStats = byPath.get(event.path) ?? { count: 0, errors: 0, totalDurationMs: 0 };
      pathStats.count += 1;
      pathStats.totalDurationMs += event.durationMs;
      if (event.statusCode >= 400) pathStats.errors += 1;
      byPath.set(event.path, pathStats);

      const actorKey = event.userId ?? event.ip ?? "anonymous";
      const actor = byActor.get(actorKey) ?? {
        key: actorKey,
        requests: 0,
        errors: 0,
        rateLimited: 0,
        codeRuns: 0
      };
      actor.requests += 1;
      if (event.statusCode >= 400) actor.errors += 1;
      if (event.rateLimited) actor.rateLimited += 1;
      if (event.path.includes("/submissions")) actor.codeRuns += 1;
      byActor.set(actorKey, actor);
    }

    const topPaths = [...byPath.entries()]
      .map(([requestPath, stats]) => ({
        path: requestPath,
        count: stats.count,
        errors: stats.errors,
        avgDurationMs: stats.count ? Math.round(stats.totalDurationMs / stats.count) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const suspiciousUsers = [...byActor.values()]
      .filter(isSuspiciousActor)
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    const summary = {
      windowHours: hours,
      totalRequests: events.total,
      sampledRequests: events.items.length,
      errorRequests,
      rateLimitedRequests,
      averageDurationMs: events.items.length ? Math.round(totalDurationMs / events.items.length) : 0,
      topPaths,
      suspiciousUsers,
      openReports: openReports.total,
      generatedAt: new Date().toISOString()
    };

    if (summary.suspiciousUsers.length > 0 || summary.rateLimitedRequests >= 10) {
      await this.createAlert({
        severity: summary.rateLimitedRequests >= 10 ? "HIGH" : "MEDIUM",
        source: "ABUSE_ANALYTICS",
        title: "Suspicious traffic detected",
        message: `${summary.suspiciousUsers.length} actors crossed abuse thresholds in the last ${hours} hours.`,
        details: summary as unknown as Record<string, unknown>
      });
    }

    return summary;
  }

  async createBackup(requestedById: string) {
    const startedAt = new Date();
    const run = await this.repository.createBackupRun({ requestedById, status: "RUNNING", startedAt });

    if (!env.DATABASE_URL) {
      return this.repository.updateBackupRun(run.id, {
        status: "FAILED",
        errorMessage: "DATABASE_URL is not configured",
        completedAt: new Date()
      });
    }

    const backupDir = path.resolve(env.BACKUP_DIR);
    mkdirSync(backupDir, { recursive: true });
    const filename = `codearena-${timestampForFilename(startedAt)}.dump`;
    const outputPath = path.join(backupDir, filename);
    const result = spawnSync(env.PG_DUMP_PATH, ["--format=custom", "--file", outputPath, env.DATABASE_URL], {
      timeout: env.BACKUP_TIMEOUT_MS,
      windowsHide: true,
      encoding: "utf8"
    });

    if (result.error || result.status !== 0) {
      const message = result.error?.message ?? result.stderr ?? "pg_dump failed";
      return this.repository.updateBackupRun(run.id, {
        status: "FAILED",
        errorMessage: message.slice(0, 1000),
        completedAt: new Date()
      });
    }

    const stat = statSync(outputPath);
    return this.repository.updateBackupRun(run.id, {
      status: "COMPLETED",
      filename: outputPath,
      sizeBytes: stat.size,
      completedAt: new Date()
    });
  }

  async listBackups(input: { page?: unknown; limit?: unknown; status?: "RUNNING" | "COMPLETED" | "FAILED" }) {
    const pagination = getPagination(input);
    return this.repository.listBackupRuns({
      page: pagination.page,
      limit: pagination.limit,
      status: input.status
    });
  }

  async productionStatus() {
    const [database, executor, queue, backups, snapshots, reports, abuse] = await Promise.all([
      this.repository.healthCheck(),
      this.executorCapabilities.health(true),
      this.queueMetrics(),
      this.safePage(() => this.repository.listBackupRuns({ page: 1, limit: 5 })),
      this.safePage(() => this.repository.listHealthCheckSnapshots({ page: 1, limit: 5 })),
      this.safePage(() => this.repository.listReports({ page: 1, limit: 1, status: "OPEN" })),
      this.abuseAnalytics({ hours: 24 }).catch(() => null)
    ]);

    let status: HealthStatus = "HEALTHY";
    if (!database.ok) {
      status = "DOWN";
    } else if (!executor.executorConfigured || queue.unavailable || queue.metrics.failed > 0) {
      status = "DEGRADED";
    }

    return {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database,
      executor,
      redis: {
        configured: Boolean(env.REDIS_URL),
        ok: queue.unavailable ? false : undefined
      },
      queue: queue.metrics,
      reports: { open: reports.total },
      backups: backups.items,
      snapshots: snapshots.items,
      abuse
    };
  }

  async snapshotHealth(actorId: string) {
    const status = await this.productionStatus();
    const snapshot = await this.repository.createHealthCheckSnapshot({
      status: status.status,
      details: status as unknown as Record<string, unknown>
    });
    await this.repository.createAuditLog({
      actorId,
      action: "HEALTH_SNAPSHOT_CREATED",
      entityType: "HEALTH",
      entityId: snapshot.id,
      details: { status: snapshot.status }
    });
    if (snapshot.status !== "HEALTHY") {
      await this.createAlert({
        severity: snapshot.status === "DOWN" ? "CRITICAL" : "MEDIUM",
        source: "HEALTH_SNAPSHOT",
        title: `Platform health is ${snapshot.status.toLowerCase()}`,
        message: "A health snapshot detected degraded production status.",
        details: status as unknown as Record<string, unknown>
      });
    }
    return snapshot;
  }

  async listHealthSnapshots(input: { page?: unknown; limit?: unknown; status?: HealthStatus }) {
    const pagination = getPagination(input);
    return this.repository.listHealthCheckSnapshots({
      page: pagination.page,
      limit: pagination.limit,
      status: input.status
    });
  }

  async listMonitoringAlerts(input: {
    page?: unknown;
    limit?: unknown;
    status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  }) {
    const pagination = getPagination(input);
    return this.repository.listMonitoringAlerts({
      page: pagination.page,
      limit: pagination.limit,
      status: input.status
    });
  }

  async acknowledgeAlert(id: string, actorId: string) {
    return this.repository.updateMonitoringAlert(id, {
      status: "ACKNOWLEDGED",
      acknowledgedById: actorId,
      acknowledgedAt: new Date()
    });
  }

  async resolveAlert(id: string, actorId: string) {
    return this.repository.updateMonitoringAlert(id, {
      status: "RESOLVED",
      resolvedById: actorId,
      resolvedAt: new Date()
    });
  }

  async rateContest(contestId: string, actorId: string | null) {
    const contest = await this.repository.findContestById(contestId);
    if (!contest) throw ApiError.notFound("Contest not found");
    if (contest.isRated === false) {
      throw ApiError.badRequest("Contest is not marked as rated");
    }
    if (Date.now() < contest.endTime.getTime()) {
      throw ApiError.badRequest("Contest must be ended before ratings are published");
    }
    const existing = await this.repository.listRatingEvents({ contestId, page: 1, limit: 1 });
    if (existing.total > 0) {
      throw ApiError.conflict("Contest ratings have already been published");
    }

    const rows = await this.repository.getContestLeaderboard(contestId);
    if (rows.length < 2) {
      throw ApiError.badRequest("At least two ranked participants are required");
    }

    const ratings = await this.currentRatingMap(rows);

    const averageRating = [...ratings.values()].reduce((sum, rating) => sum + rating.rating, 0) / ratings.size;
    const participants = rows.length;
    const events = [];

    for (const row of rows) {
      const current = ratings.get(row.user.id)!;
      const next = calculateRatingChange({
        current,
        averageRating,
        participants,
        rank: row.rank
      });
      await this.repository.upsertUserRating({
        userId: row.user.id,
        rating: next.newRating,
        volatility: next.newVolatility,
        contestsRated: current.contestsRated + 1
      });
      const event = await this.repository.createRatingEvent({
        userId: row.user.id,
        contestId,
        oldRating: current.rating,
        newRating: next.newRating,
        delta: next.delta,
        rank: row.rank,
        participants
      });
      events.push({ ...event, user: row.user });
    }

    await this.repository.createAuditLog({
      actorId,
      action: "CONTEST_RATINGS_PUBLISHED",
      entityType: "CONTEST",
      entityId: contestId,
      details: { participants }
    });
    await this.repository.updateContest(contestId, { ratingsPublishedAt: new Date() });

    return events.sort((a, b) => a.rank - b.rank);
  }

  async rollbackContestRatings(contestId: string, actorId: string | null) {
    const contest = await this.repository.findContestById(contestId);
    if (!contest) throw ApiError.notFound("Contest not found");

    const publishedEvents = await this.repository.listRatingEvents({ contestId, page: 1, limit: 10000 });
    if (publishedEvents.total === 0) {
      throw ApiError.badRequest("No ratings have been published for this contest");
    }

    const affectedUserIds = [...new Set(publishedEvents.items.map((event) => event.userId))];
    const deletedEvents = await this.repository.deleteRatingEventsByContest(contestId);
    const resetUsers = [];

    for (const userId of affectedUserIds) {
      const remaining = await this.repository.listRatingEvents({ userId, page: 1, limit: 10000 });
      const latest = remaining.items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      const contestsRated = remaining.total;
      const rating = latest?.newRating ?? 1500;
      const volatility = contestsRated ? Math.max(80, Math.round(350 * 0.92 ** contestsRated)) : 350;
      const updated = await this.repository.upsertUserRating({
        userId,
        rating,
        volatility,
        contestsRated
      });
      resetUsers.push(updated);
    }

    await this.repository.updateContest(contestId, { ratingsPublishedAt: null });
    await this.repository.createAuditLog({
      actorId,
      action: "CONTEST_RATINGS_ROLLED_BACK",
      entityType: "CONTEST",
      entityId: contestId,
      details: { deletedEvents, affectedUsers: affectedUserIds.length }
    });

    return { contestId, deletedEvents, resetUsers };
  }

  async scheduleRatingJob(contestId: string, actorId: string, input: { scheduledAt?: Date | null }) {
    const contest = await this.repository.findContestById(contestId);
    if (!contest) throw ApiError.notFound("Contest not found");
    if (contest.isRated === false) {
      throw ApiError.badRequest("Contest is not marked as rated");
    }
    const scheduledAt = input.scheduledAt ?? contest.ratingScheduledAt ?? contest.endTime;
    const job = await this.repository.createContestRatingJob({
      contestId,
      requestedById: actorId,
      scheduledAt
    });
    await this.repository.updateContest(contestId, { ratingScheduledAt: scheduledAt });
    return job;
  }

  async listRatingJobs(input: {
    page?: unknown;
    limit?: unknown;
    status?: "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  }) {
    const pagination = getPagination(input);
    return this.repository.listContestRatingJobs({
      page: pagination.page,
      limit: pagination.limit,
      status: input.status
    });
  }

  async processScheduledRatingJobs(actorId: string | null) {
    const page = await this.repository.listContestRatingJobs({ status: "SCHEDULED", page: 1, limit: 100 });
    const now = new Date();
    const processed = [];
    for (const job of page.items.filter((item) => item.scheduledAt <= now)) {
      await this.repository.updateContestRatingJob(job.id, { status: "RUNNING", startedAt: now });
      try {
        const events = await this.rateContest(job.contestId, job.requestedById ?? actorId);
        const completed = await this.repository.updateContestRatingJob(job.id, {
          status: "COMPLETED",
          completedAt: new Date()
        });
        processed.push({ job: completed, events });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Rating job failed";
        const failed = await this.repository.updateContestRatingJob(job.id, {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date()
        });
        processed.push({ job: failed, error: message });
      }
    }
    return { processed };
  }

  async ratingsLeaderboard(input: { page?: unknown; limit?: unknown }) {
    const pagination = getPagination(input);
    return this.repository.listUserRatings({ page: pagination.page, limit: pagination.limit });
  }

  async ratingHistory(username: string, input: { page?: unknown; limit?: unknown }) {
    const user = await this.repository.findUserByUsername(username);
    if (!user) throw ApiError.notFound("User not found");
    const pagination = getPagination(input);
    return this.repository.listRatingEvents({
      userId: user.id,
      page: pagination.page,
      limit: pagination.limit
    });
  }

  private async currentRatingMap(rows: ContestLeaderboardRow[]): Promise<Map<string, RatingState>> {
    const ratings = new Map<string, RatingState>();
    for (const row of rows) {
      const current = await this.repository.getUserRating(row.user.id);
      ratings.set(row.user.id, {
        rating: current?.rating ?? 1500,
        volatility: current?.volatility ?? 350,
        contestsRated: current?.contestsRated ?? 0
      });
    }
    return ratings;
  }

  private async requirePublicProblem(slug: string) {
    const problem = await this.repository.findProblemBySlug(slug);
    if (!problem || problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }

  private canViewSolution(
    solution: { authorId: string; visibility: SolutionVisibility },
    viewer?: { id: string; role: "USER" | "ADMIN" }
  ) {
    if (solution.visibility === "PUBLIC" || solution.visibility === "UNLISTED") return true;
    return Boolean(viewer && (viewer.role === "ADMIN" || viewer.id === solution.authorId));
  }

  private async notifyFollowers(authorId: string, title: string, body: string, link: string) {
    const followers = await this.repository.listFollowers(authorId, { page: 1, limit: 100 });
    await Promise.all(
      followers.items.map((follower) =>
        this.repository.createNotification({
          userId: follower.id,
          actorId: authorId,
          type: "SYSTEM",
          title,
          body,
          link
        })
      )
    );
  }

  private async validateReportTarget(targetType: ReportTargetType, targetId: string, reporterId: string | null) {
    if (targetType === "PROBLEM") {
      const problem = await this.repository.findProblemById(targetId);
      if (!problem) throw ApiError.notFound("Report target not found");
      return;
    }

    if (targetType === "SUBMISSION") {
      const submission = await this.repository.findSubmissionById(targetId);
      if (!submission) throw ApiError.notFound("Report target not found");
      return;
    }

    if (targetType === "DISCUSSION") {
      const discussion = await this.repository.findDiscussionById(targetId);
      if (!discussion) throw ApiError.notFound("Report target not found");
      return;
    }

    if (targetType === "COMMENT") {
      const comment = await this.repository.findDiscussionCommentById(targetId);
      if (!comment) throw ApiError.notFound("Report target not found");
      return;
    }

    if (targetType === "SOLUTION") {
      const solution = await this.repository.findSolutionById(targetId);
      if (!solution || !this.canViewSolution(solution, reporterId ? { id: reporterId, role: "USER" } : undefined)) {
        throw ApiError.notFound("Report target not found");
      }
      return;
    }

    const user = await this.repository.findUserById(targetId);
    if (!user || user.status !== "ACTIVE") {
      throw ApiError.notFound("Report target not found");
    }
  }

  private async queueMetrics(): Promise<{ metrics: QueueMetrics; unavailable: boolean }> {
    try {
      return { metrics: await this.queue.getMetrics(), unavailable: false };
    } catch {
      return {
        unavailable: true,
        metrics: unavailableQueueMetrics()
      };
    }
  }

  private async safePage<T>(load: () => Promise<{ items: T[]; total: number; page: number; limit: number }>) {
    try {
      return await load();
    } catch {
      return { items: [], total: 0, page: 1, limit: 0 };
    }
  }

  private async createAlert(input: {
    severity: string;
    source: string;
    title: string;
    message: string;
    details?: Record<string, unknown> | null;
  }) {
    const alert = await this.repository.createMonitoringAlert(input);
    if (env.MONITORING_WEBHOOK_URL) {
      try {
        await fetch(env.MONITORING_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...alert, details: input.details ?? null })
        });
      } catch (error) {
        logger.warn({ err: error, alertId: alert.id }, "Monitoring webhook delivery failed");
      }
    }
    return alert;
  }
}

type PublicProfileUser = Omit<PublicUser, "email">;

function analyticsWindowHours(value: unknown): number {
  let hours = Number(value ?? 24);
  if (!Number.isFinite(hours) || hours < 1) {
    hours = 24;
  }
  if (hours > 168) {
    hours = 168;
  }
  return hours;
}

function isSuspiciousActor(actor: ActorTrafficStats): boolean {
  return actor.requests >= 300 || actor.rateLimited >= 5 || actor.errors >= 20 || actor.codeRuns >= 200;
}

function calculateRatingChange(input: {
  current: RatingState;
  averageRating: number;
  participants: number;
  rank: number;
}) {
  const actualScore = (input.participants - input.rank) / Math.max(1, input.participants - 1);
  const expectedScore = 1 / (1 + 10 ** ((input.averageRating - input.current.rating) / 400));
  const experienceMultiplier = input.current.contestsRated < 5 ? 1.25 : 1;
  const fieldMultiplier = Math.min(1.4, Math.max(0.8, input.participants / 25));
  const delta = Math.round(
    (actualScore - expectedScore) * (input.current.volatility / 4) * experienceMultiplier * fieldMultiplier
  );

  return {
    delta,
    newRating: Math.max(100, input.current.rating + delta),
    newVolatility: Math.max(80, input.current.volatility - 25)
  };
}

function unavailableQueueMetrics(): QueueMetrics {
  return {
    driver: env.REDIS_URL ? "bullmq" : "memory",
    waiting: 0,
    pending: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
    workerStatus: "unavailable"
  };
}

function publicUser(user: User): PublicProfileUser {
  const { passwordHash, email, ...profile } = user;
  void passwordHash;
  void email;
  return profile;
}

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
