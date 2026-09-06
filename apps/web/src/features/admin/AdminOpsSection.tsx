import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  DatabaseBackup,
  FileWarning,
  HeartPulse,
  PlayCircle,
  ScrollText,
  Star,
  Trophy,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { adminApi } from "../../services/api";
import type {
  BackupRun,
  Contest,
  ContestRatingJob,
  HealthStatus,
  ModerationStatus,
  MonitoringAlert,
  Report,
  UserRating
} from "../../types/api";
import { Button } from "../../components/Button";
import { ErrorState, LoadingState } from "../../components/State";
import { PanelTitle } from "./formFields";

interface AdminOpsSectionProps {
  contests: Contest[];
  onToast: (message: string) => void;
}

export function AdminOpsSection({ contests, onToast }: AdminOpsSectionProps) {
  const queryClient = useQueryClient();
  const [selectedContestId, setSelectedContestId] = useState("");

  const production = useQuery({
    queryKey: ["admin-production-status"],
    queryFn: adminApi.productionStatus,
    refetchInterval: 30_000
  });

  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => adminApi.reports({ limit: "8" })
  });

  const auditLogs = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => adminApi.auditLogs({ limit: "8" })
  });

  const abuse = useQuery({
    queryKey: ["admin-abuse-analytics"],
    queryFn: () => adminApi.abuseAnalytics(24)
  });

  const backups = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => adminApi.backups({ limit: "6" })
  });

  const alerts = useQuery({
    queryKey: ["admin-monitoring-alerts"],
    queryFn: () => adminApi.monitoringAlerts({ limit: "8" })
  });

  const ratings = useQuery({
    queryKey: ["admin-ratings"],
    queryFn: () => adminApi.ratings({ limit: "8" })
  });

  const ratingJobs = useQuery({
    queryKey: ["admin-rating-jobs"],
    queryFn: () => adminApi.ratingJobs({ limit: "8" })
  });

  const updateReport = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ModerationStatus }) =>
      adminApi.updateReport(id, { status }),
    onSuccess: () => {
      onToast("Report queue updated");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-abuse-analytics"] });
    }
  });

  const createBackup = useMutation({
    mutationFn: adminApi.createBackup,
    onSuccess: (backup) => {
      onToast(backup.status === "COMPLETED" ? "Backup completed" : "Backup run recorded");
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      queryClient.invalidateQueries({ queryKey: ["admin-production-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring-alerts"] });
    }
  });

  const snapshotHealth = useMutation({
    mutationFn: adminApi.snapshotHealth,
    onSuccess: () => {
      onToast("Health snapshot saved");
      queryClient.invalidateQueries({ queryKey: ["admin-production-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring-alerts"] });
    }
  });

  const rateContest = useMutation({
    mutationFn: () => adminApi.rateContest(selectedContestId),
    onSuccess: (events) => {
      onToast(`${events.length} ratings published`);
      queryClient.invalidateQueries({ queryKey: ["admin-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-rating-jobs"] });
    }
  });

  const rollbackRatings = useMutation({
    mutationFn: () => adminApi.rollbackContestRatings(selectedContestId),
    onSuccess: (result) => {
      onToast(`${result.deletedEvents} rating events rolled back`);
      queryClient.invalidateQueries({ queryKey: ["admin-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-rating-jobs"] });
    }
  });

  const acknowledgeAlert = useMutation({
    mutationFn: adminApi.acknowledgeAlert,
    onSuccess: () => {
      onToast("Alert acknowledged");
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring-alerts"] });
    }
  });

  const resolveAlert = useMutation({
    mutationFn: adminApi.resolveAlert,
    onSuccess: () => {
      onToast("Alert resolved");
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-production-status"] });
    }
  });

  const scheduleRatingJob = useMutation({
    mutationFn: () => adminApi.scheduleRatingJob(selectedContestId),
    onSuccess: () => {
      onToast("Rating job scheduled");
      queryClient.invalidateQueries({ queryKey: ["admin-rating-jobs"] });
    }
  });

  const processRatingJobs = useMutation({
    mutationFn: adminApi.processRatingJobs,
    onSuccess: (result) => {
      onToast(`${result.processed.length} rating jobs processed`);
      queryClient.invalidateQueries({ queryKey: ["admin-rating-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ratings"] });
    }
  });

  const endedContests = useMemo(() => contests.filter((contest) => contest.status === "ENDED"), [contests]);
  const latestBackup = backups.data?.[0];
  const status = production.data?.status ?? "DEGRADED";
  const openAlertCount = (alerts.data ?? []).filter((alert) => alert.status !== "RESOLVED").length;

  return (
    <section className="ca-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
        <div>
          <PanelTitle icon={HeartPulse} title="Public Launch Ops" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Moderation, audit, backup, abuse, and monitoring controls for production readiness.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={snapshotHealth.isPending} onClick={() => snapshotHealth.mutate()}>
            <HeartPulse className="h-4 w-4" /> Snapshot
          </Button>
          <Button variant="secondary" disabled={createBackup.isPending} onClick={() => createBackup.mutate()}>
            <DatabaseBackup className="h-4 w-4" /> Backup
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
        <OpsMetric icon={HeartPulse} label="Health" value={status} tone={statusTone(status)} />
        <OpsMetric icon={FileWarning} label="Open Reports" value={String(production.data?.reports.open ?? 0)} tone="amber" />
        <OpsMetric icon={BellRing} label="Open Alerts" value={String(openAlertCount)} tone={openAlertCount ? "rose" : "emerald"} />
        <OpsMetric icon={Activity} label="Rate Limited" value={String(abuse.data?.rateLimitedRequests ?? 0)} tone="slate" />
        <OpsMetric icon={DatabaseBackup} label="Latest Backup" value={backupLabel(latestBackup)} tone={latestBackup?.status === "FAILED" ? "rose" : "emerald"} />
      </div>

      {(production.isError || reports.isError || auditLogs.isError || abuse.isError || backups.isError || alerts.isError || ratingJobs.isError) ? (
        <div className="px-5 pb-5">
          <ErrorState
            title="Ops data failed"
            error={production.error ?? reports.error ?? auditLogs.error ?? abuse.error ?? backups.error ?? alerts.error ?? ratingJobs.error}
          />
        </div>
      ) : null}

      {production.isLoading ? (
        <LoadingState label="Loading ops status" />
      ) : (
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <PanelBlock icon={AlertTriangle} title="Moderation Queue">
              <div className="space-y-3">
                {(reports.data ?? []).map((report) => (
                  <ReportRow key={report.id} report={report} onUpdate={(status) => updateReport.mutate({ id: report.id, status })} />
                ))}
                {!reports.data?.length ? <p className="text-sm text-slate-500">No reports in queue.</p> : null}
              </div>
            </PanelBlock>

            <PanelBlock icon={Activity} title="Abuse And Rate Analytics">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top paths</p>
                  <div className="mt-2 space-y-2">
                    {(abuse.data?.topPaths ?? []).slice(0, 5).map((row) => (
                      <RowStat key={row.path} label={row.path} value={`${row.count} req / ${row.errors} err`} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suspicious actors</p>
                  <div className="mt-2 space-y-2">
                    {(abuse.data?.suspiciousUsers ?? []).slice(0, 5).map((row) => (
                      <RowStat key={row.key} label={row.key} value={`${row.requests} req / ${row.rateLimited} limited`} />
                    ))}
                    {!abuse.data?.suspiciousUsers.length ? (
                      <p className="text-sm text-slate-500">No actors crossed alert thresholds.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </PanelBlock>

            <PanelBlock icon={BellRing} title="Monitoring Alerts">
              <div className="space-y-2">
                {(alerts.data ?? []).map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={() => acknowledgeAlert.mutate(alert.id)}
                    onResolve={() => resolveAlert.mutate(alert.id)}
                  />
                ))}
                {!alerts.data?.length ? <p className="text-sm text-slate-500">No monitoring alerts recorded.</p> : null}
              </div>
            </PanelBlock>
          </div>

          <div className="space-y-5">
            <PanelBlock icon={ScrollText} title="Audit Logs">
              <div className="space-y-2">
                {(auditLogs.data ?? []).map((log) => (
                  <RowStat
                    key={log.id}
                    label={log.action}
                    value={`${log.outcome} ${log.statusCode ?? ""}`}
                  />
                ))}
                {!auditLogs.data?.length ? <p className="text-sm text-slate-500">No admin actions recorded yet.</p> : null}
              </div>
            </PanelBlock>

            <PanelBlock icon={DatabaseBackup} title="Backups And Monitoring">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  {(backups.data ?? []).map((backup) => (
                    <BackupRow key={backup.id} backup={backup} />
                  ))}
                  {!backups.data?.length ? <p className="text-sm text-slate-500">No backups recorded yet.</p> : null}
                </div>
                <div className="space-y-2 text-sm">
                  <RowStat label="Database" value={production.data?.database.ok ? "ok" : "down"} />
                  <RowStat label="Queue pending" value={String(production.data?.queue.pending ?? 0)} />
                  <RowStat label="Queue failed" value={String(production.data?.queue.failed ?? 0)} />
                  <RowStat label="Executor" value={production.data?.executor.executorConfigured ? "configured" : "missing"} />
                </div>
              </div>
            </PanelBlock>

            <PanelBlock icon={Trophy} title="Contest Ratings">
              <div className="flex flex-wrap gap-2">
                <select
                  className="ca-input min-w-56"
                  value={selectedContestId}
                  onChange={(event) => setSelectedContestId(event.target.value)}
                >
                  <option value="">Select ended contest</option>
                  {endedContests.map((contest) => (
                    <option key={contest.id} value={contest.id}>
                      {contest.title}
                    </option>
                  ))}
                </select>
                <Button disabled={!selectedContestId || rateContest.isPending} onClick={() => rateContest.mutate()}>
                  <Star className="h-4 w-4" /> Publish Ratings
                </Button>
                <Button
                  variant="danger"
                  disabled={!selectedContestId || rollbackRatings.isPending}
                  onClick={() => {
                    if (window.confirm("Rollback ratings for this contest?")) {
                      rollbackRatings.mutate();
                    }
                  }}
                >
                  <XCircle className="h-4 w-4" /> Rollback
                </Button>
                <Button
                  variant="secondary"
                  disabled={!selectedContestId || scheduleRatingJob.isPending}
                  onClick={() => scheduleRatingJob.mutate()}
                >
                  <CalendarClock className="h-4 w-4" /> Schedule
                </Button>
                <Button variant="secondary" disabled={processRatingJobs.isPending} onClick={() => processRatingJobs.mutate()}>
                  <PlayCircle className="h-4 w-4" /> Process Due
                </Button>
              </div>
              {rateContest.isError ? <p className="mt-2 text-sm text-rose-600">{rateContest.error.message}</p> : null}
              {rollbackRatings.isError ? <p className="mt-2 text-sm text-rose-600">{rollbackRatings.error.message}</p> : null}
              {scheduleRatingJob.isError ? <p className="mt-2 text-sm text-rose-600">{scheduleRatingJob.error.message}</p> : null}
              {processRatingJobs.isError ? <p className="mt-2 text-sm text-rose-600">{processRatingJobs.error.message}</p> : null}
              <div className="mt-3 space-y-2">
                {(ratings.data ?? []).slice(0, 5).map((rating) => (
                  <RatingRow key={rating.id} rating={rating} />
                ))}
                {!ratings.data?.length ? <p className="text-sm text-slate-500">No persistent ratings yet.</p> : null}
              </div>
            </PanelBlock>

            <PanelBlock icon={CalendarClock} title="Rating Jobs">
              <div className="space-y-2">
                {(ratingJobs.data ?? []).map((job) => (
                  <RatingJobRow key={job.id} job={job} contestTitle={contests.find((contest) => contest.id === job.contestId)?.title} />
                ))}
                {!ratingJobs.data?.length ? <p className="text-sm text-slate-500">No rating jobs scheduled.</p> : null}
              </div>
            </PanelBlock>
          </div>
        </div>
      )}
    </section>
  );
}

function OpsMetric({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClass = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900",
    amber: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/20 dark:border-amber-900",
    rose: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/20 dark:border-rose-900",
    slate: "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-white/5 dark:border-white/10"
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function PanelBlock({
  icon: Icon,
  title,
  children
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 dark:border-white/10 dark:bg-white/5">
      <PanelTitle icon={Icon} title={title} />
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ReportRow({ report, onUpdate }: { report: Report; onUpdate: (status: ModerationStatus) => void }) {
  return (
    <div className="rounded-md bg-white p-3 text-sm shadow-sm dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{report.reason}</p>
          <p className="mt-1 text-xs text-slate-500">
            {report.targetType} {report.targetId.slice(0, 10)} - {report.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button className="h-8 px-2 text-xs" variant="secondary" onClick={() => onUpdate("TRIAGED")}>
            <AlertTriangle className="h-3.5 w-3.5" /> Triage
          </Button>
          <Button className="h-8 px-2 text-xs" variant="secondary" onClick={() => onUpdate("RESOLVED")}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
          </Button>
          <Button className="h-8 px-2 text-xs" variant="ghost" onClick={() => onUpdate("DISMISSED")}>
            <XCircle className="h-3.5 w-3.5" /> Dismiss
          </Button>
        </div>
      </div>
      {report.details ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{report.details}</p> : null}
    </div>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950">
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-xs font-medium text-slate-500">{value}</span>
    </div>
  );
}

function BackupRow({ backup }: { backup: BackupRun }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{backup.status}</span>
        <span className="text-xs text-slate-500">{backup.sizeBytes ? `${Math.round(backup.sizeBytes / 1024)} KB` : "-"}</span>
      </div>
      {backup.errorMessage ? <p className="mt-1 line-clamp-2 text-xs text-rose-600">{backup.errorMessage}</p> : null}
    </div>
  );
}

function AlertRow({
  alert,
  onAcknowledge,
  onResolve
}: {
  alert: MonitoringAlert;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  return (
    <div className="rounded-md bg-white p-3 text-sm dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{alert.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {alert.source} - {alert.severity} - {alert.status}
          </p>
        </div>
        <div className="flex gap-1">
          {alert.status === "OPEN" ? (
            <Button className="h-8 px-2 text-xs" variant="secondary" onClick={onAcknowledge}>
              Ack
            </Button>
          ) : null}
          {alert.status !== "RESOLVED" ? (
            <Button className="h-8 px-2 text-xs" variant="ghost" onClick={onResolve}>
              Resolve
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{alert.message}</p>
    </div>
  );
}

function RatingJobRow({ job, contestTitle }: { job: ContestRatingJob; contestTitle?: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{contestTitle ?? job.contestId.slice(0, 8)}</span>
        <span className="shrink-0 text-xs font-medium text-slate-500">{job.status}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{new Date(job.scheduledAt).toLocaleString()}</p>
      {job.errorMessage ? <p className="mt-1 line-clamp-2 text-xs text-rose-600">{job.errorMessage}</p> : null}
    </div>
  );
}

function RatingRow({ rating }: { rating: UserRating }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950">
      <span>{rating.user?.displayName ?? rating.userId.slice(0, 8)}</span>
      <span className="font-semibold">{rating.rating}</span>
    </div>
  );
}

function statusTone(status: HealthStatus): "emerald" | "amber" | "rose" | "slate" {
  if (status === "HEALTHY") return "emerald";
  if (status === "DOWN") return "rose";
  return "amber";
}

function backupLabel(backup?: BackupRun): string {
  if (!backup) return "none";
  if (backup.status === "COMPLETED") return "completed";
  if (backup.status === "FAILED") return "failed";
  return "running";
}
