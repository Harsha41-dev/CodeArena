import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  Bell,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Code2,
  Flame,
  Globe2,
  MapPin,
  Medal,
  NotebookTabs,
  Shield,
  Trophy
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authApi, leaderboardApi, notificationsApi, problemsApi, socialApi, submissionsApi, usersApi } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/Button";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { HeatmapCalendar } from "../components/HeatmapCalendar";
import { ProgressRing } from "../components/ProgressRing";
import { StatsCard } from "../components/StatsCard";
import { SubmissionTable } from "../components/SubmissionTable";
import type { LeaderboardRow } from "../types/api";

const tabs = ["Overview", "Notifications", "Submissions", "Solved Problems", "Contests", "Bookmarks", "Notes"] as const;

export function ProfilePage() {
  const authUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");

  const me = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: Boolean(authUser)
  });

  const stats = useQuery({
    queryKey: ["stats", authUser?.username],
    queryFn: () => usersApi.stats(authUser!.username),
    enabled: Boolean(authUser)
  });

  const persistedBadges = useQuery({
    queryKey: ["profile-badges", authUser?.username],
    queryFn: () => usersApi.badges(authUser!.username),
    enabled: Boolean(authUser)
  });

  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: leaderboardApi.global,
    enabled: Boolean(authUser)
  });

  const bookmarks = useQuery({
    queryKey: ["bookmarks"],
    queryFn: socialApi.bookmarks,
    enabled: Boolean(authUser)
  });

  const profileProblems = useQuery({
    queryKey: ["profile-problems"],
    queryFn: () => problemsApi.list({ limit: "100" }),
    enabled: Boolean(authUser)
  });

  const recentAccepted = useQuery({
    queryKey: ["profile-accepted-submissions"],
    queryFn: () => submissionsApi.list({ status: "ACCEPTED", limit: "8" }),
    enabled: Boolean(authUser)
  });

  const recentSubmissions = useQuery({
    queryKey: ["profile-recent-submissions"],
    queryFn: () => submissionsApi.list({ limit: "12" }),
    enabled: Boolean(authUser)
  });

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list({ limit: "20" }),
    enabled: Boolean(authUser)
  });

  // basic totals from stats endpoint
  const solvedTotal = stats.data?.solvedCount ?? 0;
  const submissionTotal = stats.data?.submissionsCount ?? 0;
  const acceptedTotal = stats.data?.acceptedSubmissions ?? 0;

  let acceptance = stats.data?.acceptanceRate ?? 0;
  if (stats.data?.acceptanceRate === undefined || stats.data?.acceptanceRate === null) {
    if (submissionTotal > 0) {
      acceptance = Math.round((acceptedTotal / submissionTotal) * 100);
    } else {
      acceptance = 0;
    }
  }

  const saveCountry = useMutation({
    mutationFn: () => {
      const countryValue = country.trim() || null;
      let codeValue: string | null = null;
      if (countryCode.trim()) {
        codeValue = countryCode.trim().toUpperCase();
      }
      return usersApi.updateMe({
        country: countryValue,
        countryCode: codeValue
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  const markNotificationRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markAllNotificationsRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  // keep form in sync when profile loads
  useEffect(() => {
    if (me.data) {
      setCountry(me.data.country ?? "");
      setCountryCode(me.data.countryCode ?? "");
    }
  }, [me.data]);

  useEffect(() => {
    const requested = searchParams.get("tab");
    const tab = tabs.find((item) => tabSlug(item) === requested);
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const joined = useMemo(() => {
    if (!me.data?.createdAt) {
      return "Profile date unavailable";
    }
    return new Date(me.data.createdAt).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }, [me.data?.createdAt]);

  const topicRows = useMemo(() => {
    const map = new Map<string, { label: string; total: number; solved: number }>();
    for (const problem of profileProblems.data ?? []) {
      for (const tag of problem.tags) {
        const row = map.get(tag.slug) ?? { label: tag.name, total: 0, solved: 0 };
        row.total += 1;
        if (problem.status === "SOLVED") {
          row.solved += 1;
        }
        map.set(tag.slug, row);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [profileProblems.data]);

  if (!authUser) {
    return (
      <section className="ca-panel p-6">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Login to view progress, submissions, bookmarks, notes, and contest history.
        </p>
      </section>
    );
  }

  if (me.isLoading || stats.isLoading) {
    return <LoadingState label="Loading profile" />;
  }

  if (me.isError) {
    return <ErrorState title="Could not load profile" error={me.error} />;
  }

  if (stats.isError) {
    return <ErrorState title="Could not load user stats" error={stats.error} />;
  }

  const difficultyStats = stats.data?.difficultyStats ?? { EASY: 0, MEDIUM: 0, HARD: 0 };
  const languageStats = stats.data?.languageStats ?? {};
  const displayName = me.data?.displayName ?? authUser.displayName;
  const initials = displayName.slice(0, 2).toUpperCase();
  const calendar = stats.data?.submissionCalendar ?? [];
  const activeDays = calendar.length;

  // find this user on the global leaderboard
  let rankRow: LeaderboardRow | undefined;
  if (leaderboard.data) {
    rankRow = leaderboard.data.find((row) => row.user.username === authUser.username);
  }

  let rankLabel = "Unranked";
  if (rankRow) {
    rankLabel = `#${rankRow.currentRank ?? rankRow.rank}`;
  }

  const currentCountryCode = me.data?.countryCode ?? authUser.countryCode;
  const countryRank = currentCountryCode
    ? (leaderboard.data ?? [])
        .filter((row) => row.user.countryCode === currentCountryCode)
        .findIndex((row) => row.user.username === authUser.username) + 1
    : 0;
  const countryRankLabel = countryRank > 0 ? `#${countryRank}` : "Unranked";

  const countryDisabled = saveCountry.isPending || Boolean(countryCode && countryCode.length !== 2);

  let bookmarkCountLabel = "Loading";
  if (!bookmarks.isLoading) {
    bookmarkCountLabel = String(bookmarks.data?.length ?? 0);
  }

  const languageEntries = Object.entries(languageStats);
  const overallProgress = Math.min(100, solvedTotal * 4);
  const strengths = topicRows
    .filter((row) => row.solved > 0)
    .sort((a, b) => b.solved / Math.max(1, b.total) - a.solved / Math.max(1, a.total))
    .slice(0, 4);
  const weaknesses = topicRows
    .filter((row) => row.total > row.solved)
    .sort((a, b) => a.solved / Math.max(1, a.total) - b.solved / Math.max(1, b.total))
    .slice(0, 4);
  const badges = persistedBadges.data?.length
    ? persistedBadges.data.map((award) => ({
        label: award.badge?.name ?? "Badge",
        earned: true,
        hint: award.badge?.description ?? `Awarded ${new Date(award.awardedAt).toLocaleDateString()}`
      }))
    : profileBadges(solvedTotal, acceptedTotal, stats.data?.longestStreak ?? 0);

  return (
    <div className="space-y-5">
      <section className="ca-panel overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-md bg-slate-950 text-xl font-semibold text-white dark:bg-white dark:text-slate-950">
                {initials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">{displayName}</h1>
                  {me.data?.role === "ADMIN" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">@{me.data?.username ?? authUser.username}</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                  {me.data?.bio ?? "No bio added yet."}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
              <ProfileMeta icon={Medal} label="Global Rank" value={rankLabel} />
              <ProfileMeta icon={Globe2} label="Country Rank" value={countryRankLabel} />
              <ProfileMeta icon={Award} label="Movement" value={formatMovement(rankRow)} />
              <ProfileMeta icon={CalendarDays} label="Joined" value={joined} />
              <ProfileMeta icon={Flame} label="Streak" value={`${stats.data?.currentStreak ?? 0} days`} />
              <ProfileMeta icon={MapPin} label="Country" value={me.data?.country ?? "Not set"} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className="ca-input"
              placeholder="Country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
            <input
              className="ca-input w-24"
              placeholder="US"
              maxLength={2}
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
            />
            <Button variant="secondary" disabled={countryDisabled} onClick={() => saveCountry.mutate()}>
              Save Country
            </Button>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              to={`/u/${me.data?.username ?? authUser.username}`}
            >
              Public Profile
            </Link>
          </div>
          {saveCountry.isError ? <p className="mt-2 text-sm text-rose-600">{saveCountry.error.message}</p> : null}
          {saveCountry.isSuccess ? <p className="mt-2 text-sm text-emerald-600">Country updated.</p> : null}
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            icon={Trophy}
            label="Total Solved"
            value={solvedTotal}
            hint={`${stats.data?.attemptedCount ?? 0} attempted`}
          />
          <StatsCard icon={Code2} label="Submissions" value={submissionTotal} hint={`${acceptedTotal} accepted`} />
          <StatsCard icon={Award} label="Acceptance" value={`${acceptance}%`} hint="accepted / total submissions" />
          <StatsCard
            icon={Flame}
            label="Longest Streak"
            value={`${stats.data?.longestStreak ?? 0} days`}
            hint="accepted submissions by day"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="ca-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Difficulty Progress</h2>
            <ProgressRing value={overallProgress} label="Overall" />
          </div>
          <div className="mt-5 space-y-4">
            <DifficultyBar label="Easy" value={difficultyStats.EASY ?? 0} max={80} className="bg-emerald-500" />
            <DifficultyBar label="Medium" value={difficultyStats.MEDIUM ?? 0} max={120} className="bg-amber-500" />
            <DifficultyBar label="Hard" value={difficultyStats.HARD ?? 0} max={60} className="bg-rose-500" />
          </div>
        </div>

        <div className="ca-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Submission Calendar</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Recent activity density across solved and attempted days.
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">
              {activeDays} active days
            </span>
          </div>
          <div className="mt-4">
            <HeatmapCalendar activeDays={Math.min(110, activeDays)} calendar={calendar} linkActiveDays />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Language Stats</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {languageEntries.map(([language, count]) => (
              <DifficultyBar
                key={language}
                label={language}
                value={count}
                max={Math.max(10, submissionTotal)}
                className="bg-accent-600"
              />
            ))}
          </div>
          {!languageEntries.length ? <EmptyState title="No language stats yet" /> : null}
        </div>
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Profile Summary</h2>
          <div className="mt-4 grid gap-2">
            <SummaryRow label="Current streak" value={`${stats.data?.currentStreak ?? 0} days`} />
            <SummaryRow label="Longest streak" value={`${stats.data?.longestStreak ?? 0} days`} />
            <SummaryRow label="Active days" value={String(activeDays)} />
            <SummaryRow label="Bookmarked problems" value={bookmarkCountLabel} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Topic Strengths And Weaknesses</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Strongest</p>
              <div className="mt-3 space-y-3">
                {strengths.map((row) => (
                  <TopicBar key={row.label} row={row} className="bg-emerald-500" />
                ))}
                {!strengths.length ? <EmptyState title="No strengths yet" /> : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Needs Work</p>
              <div className="mt-3 space-y-3">
                {weaknesses.map((row) => (
                  <TopicBar key={row.label} row={row} className="bg-amber-500" />
                ))}
                {!weaknesses.length ? <EmptyState title="No weak topics yet" /> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="ca-panel p-5">
          <h2 className="font-semibold">Badges</h2>
          <div className="mt-4 grid gap-2">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className={`rounded-lg border px-3 py-2 ${
                  badge.earned
                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50/60 text-slate-500 dark:border-white/10 dark:bg-white/5"
                }`}
              >
                <p className="font-semibold">{badge.label}</p>
                <p className="text-xs">{badge.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ca-panel p-5">
        <h2 className="font-semibold">Recent Accepted Submissions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(recentAccepted.data ?? []).map((submission) => (
            <Link
              key={submission.id}
              to={`/submissions/${submission.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 transition-colors hover:bg-slate-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div>
                <p className="font-medium">{submission.problem?.title ?? submission.problemId.slice(0, 8)}</p>
                <p className="mt-1 text-xs text-slate-500">{submission.id.slice(0, 8)}</p>
              </div>
              {submission.problem ? <DifficultyBadge difficulty={submission.problem.difficulty} /> : null}
            </Link>
          ))}
          {!recentAccepted.data?.length ? <EmptyState title="No accepted submissions yet" /> : null}
        </div>
      </section>

      <section className="ca-panel overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-4 dark:border-white/10 dark:bg-white/5">
          <h2 className="font-semibold">Activity Feed</h2>
          <p className="mt-1 text-sm text-slate-500">Latest judged submissions linked to exact result pages.</p>
        </div>
        {recentSubmissions.data?.length ? (
          <SubmissionTable submissions={recentSubmissions.data} />
        ) : (
          <div className="p-5">
            <EmptyState title="No recent activity yet" />
          </div>
        )}
      </section>

      <section className="ca-panel overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200/80 bg-slate-50/50 px-2 dark:border-white/10 dark:bg-white/5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            let tabClass = "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300";
            if (isActive) {
              tabClass = "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400";
            }
            return (
              <button
                key={tab}
                className={`h-11 px-4 text-sm font-medium transition-colors ${tabClass}`}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchParams(tab === "Overview" ? {} : { tab: tabSlug(tab) });
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {activeTab === "Overview" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <MiniPanel icon={Trophy} label="Rank" value={rankLabel} />
              <MiniPanel icon={Bookmark} label="Bookmarks" value={bookmarkCountLabel} />
              <MiniPanel icon={NotebookTabs} label="Private Notes" value="Synced per problem" />
            </div>
          ) : activeTab === "Notifications" ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  disabled={markAllNotificationsRead.isPending || !notifications.data?.length}
                  onClick={() => markAllNotificationsRead.mutate()}
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark All Read
                </Button>
              </div>
              {(notifications.data ?? []).map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 ${
                    notification.readAt
                      ? "border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5"
                      : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-emerald-600" />
                        <p className="font-semibold">{notification.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.body}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {notification.link ? (
                        <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-emerald-600" to={notification.link}>
                          Open
                        </Link>
                      ) : null}
                      {!notification.readAt ? (
                        <Button
                          variant="ghost"
                          disabled={markNotificationRead.isPending}
                          onClick={() => markNotificationRead.mutate(notification.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!notifications.data?.length ? <EmptyState title="No notifications yet" /> : null}
            </div>
          ) : activeTab === "Bookmarks" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {(bookmarks.data ?? []).map((bookmark) => (
                <a
                  key={bookmark.id}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 transition-colors hover:bg-slate-100/50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  href={`/problems/${bookmark.problem.slug}`}
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{bookmark.problem.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{bookmark.problem.slug}</p>
                </a>
              ))}
              {!bookmarks.data?.length ? <EmptyState title="No bookmarks yet" /> : null}
            </div>
          ) : (
            <EmptyState title={`No ${activeTab.toLowerCase()} data to show yet`} />
          )}
        </div>
      </section>
    </div>
  );
}

function profileBadges(solved: number, accepted: number, longestStreak: number) {
  return [
    { label: "First Accept", earned: accepted > 0, hint: "Submit one accepted solution." },
    { label: "Problem Solver", earned: solved >= 10, hint: "Solve 10 problems." },
    { label: "Streak Keeper", earned: longestStreak >= 7, hint: "Reach a 7 day streak." }
  ];
}

function tabSlug(tab: (typeof tabs)[number]): string {
  return tab.toLowerCase().replace(/\s+/g, "-");
}

function formatMovement(row?: LeaderboardRow): string {
  if (!row) {
    return "No snapshot";
  }
  if (row.rankMovementDirection === "NEW") {
    return "New";
  }
  if (!row.rankMovement || row.rankMovementDirection === "SAME") {
    return "Same";
  }
  if (row.rankMovementDirection === "UP") {
    return `+${row.rankMovement}`;
  }
  return `-${row.rankMovement}`;
}

function ProfileMeta({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-[#111113]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function DifficultyBar({
  label,
  value,
  max,
  className
}: {
  label: string;
  value: number;
  max: number;
  className: string;
}) {
  const safeMax = Math.max(1, max);
  const percent = Math.min(100, Math.round((value / safeMax) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TopicBar({
  row,
  className
}: {
  row: { label: string; total: number; solved: number };
  className: string;
}) {
  const percent = Math.min(100, Math.round((row.solved / Math.max(1, row.total)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{row.label}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {row.solved}/{row.total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function MiniPanel({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/5">
      <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
