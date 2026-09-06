import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Award, CalendarDays, Flame, Globe2, MapPin, Medal, Star, Trophy, UserRound, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { leaderboardApi, ratingsApi, usersApi } from "../services/api";
import { Button } from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { HeatmapCalendar } from "../components/HeatmapCalendar";
import { ProgressRing } from "../components/ProgressRing";
import { StatsCard } from "../components/StatsCard";
import { useAuthStore } from "../stores/authStore";

export function PublicProfilePage() {
  const { username = "" } = useParams();
  const authUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => usersApi.get(username),
    enabled: Boolean(username)
  });

  const stats = useQuery({
    queryKey: ["public-profile-stats", username],
    queryFn: () => usersApi.stats(username),
    enabled: Boolean(username)
  });

  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: leaderboardApi.global
  });

  const followStatus = useQuery({
    queryKey: ["follow-status", username, authUser?.id],
    queryFn: () => usersApi.followStatus(username),
    enabled: Boolean(username)
  });

  const ratingHistory = useQuery({
    queryKey: ["rating-history", username],
    queryFn: () => ratingsApi.history(username, { limit: "5" }),
    enabled: Boolean(username)
  });

  const followMutation = useMutation({
    mutationFn: () =>
      followStatus.data?.isFollowing ? usersApi.unfollow(username) : usersApi.follow(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", username] });
    }
  });

  const joined = useMemo(() => {
    if (!profile.data?.createdAt) {
      return "Unavailable";
    }
    return new Date(profile.data.createdAt).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }, [profile.data?.createdAt]);

  if (profile.isLoading || stats.isLoading) {
    return <LoadingState label="Loading public profile" />;
  }

  if (profile.isError) {
    return <ErrorState title="Could not load profile" error={profile.error} />;
  }

  if (stats.isError) {
    return <ErrorState title="Could not load profile stats" error={stats.error} />;
  }

  if (!profile.data) {
    return <EmptyState title="Profile not found" />;
  }

  const data = profile.data;
  const userStats = stats.data;
  const solvedTotal = userStats?.solvedCount ?? 0;
  const acceptedTotal = userStats?.acceptedSubmissions ?? 0;
  const submissionTotal = userStats?.submissionsCount ?? 0;
  const acceptance = userStats?.acceptanceRate ?? 0;
  const calendar = userStats?.submissionCalendar ?? [];
  const difficultyStats = userStats?.difficultyStats ?? { EASY: 0, MEDIUM: 0, HARD: 0 };
  const initials = data.displayName.slice(0, 2).toUpperCase();
  const rankRow = leaderboard.data?.find((row) => row.user.username === data.username);
  const rankLabel = rankRow ? `#${rankRow.currentRank ?? rankRow.rank}` : "Unranked";
  const countryRank = data.countryCode
    ? (leaderboard.data ?? []).filter((row) => row.user.countryCode === data.countryCode).findIndex((row) => row.user.username === data.username) + 1
    : 0;
  const countryRankLabel = countryRank > 0 ? `#${countryRank}` : "Unranked";
  const badges = profileBadges(solvedTotal, acceptedTotal, userStats?.longestStreak ?? 0);
  const isFollowing = followStatus.data?.isFollowing ?? false;
  const isOwnProfile = authUser?.username === data.username;
  const followLabel = !authUser ? "Login to Follow" : isOwnProfile ? "Your Profile" : isFollowing ? "Following" : "Follow";

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
                <h1 className="text-2xl font-semibold">{data.displayName}</h1>
                <p className="text-sm text-slate-500">@{data.username}</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                  {data.bio ?? "No bio added yet."}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
              <ProfileMeta icon={Medal} label="Global Rank" value={rankLabel} />
              <ProfileMeta icon={Globe2} label="Country Rank" value={countryRankLabel} />
              <ProfileMeta icon={CalendarDays} label="Joined" value={joined} />
              <ProfileMeta icon={Flame} label="Streak" value={`${userStats?.currentStreak ?? 0} days`} />
              <ProfileMeta icon={MapPin} label="Country" value={data.country ?? "Not set"} />
              <ProfileMeta icon={UsersRound} label="Followers" value={String(followStatus.data?.followers ?? 0)} />
              <ProfileMeta icon={UsersRound} label="Following" value={String(followStatus.data?.following ?? 0)} />
              <Button
                className="sm:col-span-2"
                variant={isFollowing ? "secondary" : "primary"}
                disabled={!authUser || isOwnProfile || followMutation.isPending}
                onClick={() => followMutation.mutate()}
              >
                {followMutation.isPending ? "Saving" : followLabel}
              </Button>
            </div>
          </div>
          {followMutation.isError ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{followMutation.error.message}</p>
          ) : null}
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard icon={Trophy} label="Solved" value={solvedTotal} hint={`${userStats?.attemptedCount ?? 0} attempted`} />
          <StatsCard icon={Award} label="Accepted" value={acceptedTotal} hint={`${acceptance}% acceptance`} />
          <StatsCard icon={UserRound} label="Submissions" value={submissionTotal} hint="total judged runs" />
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111113]">
            <ProgressRing value={Math.min(100, solvedTotal * 4)} label="Progress" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Difficulty</h2>
          <div className="mt-5 space-y-4">
            <DifficultyBar label="Easy" value={difficultyStats.EASY ?? 0} max={80} className="bg-emerald-500" />
            <DifficultyBar label="Medium" value={difficultyStats.MEDIUM ?? 0} max={120} className="bg-amber-500" />
            <DifficultyBar label="Hard" value={difficultyStats.HARD ?? 0} max={60} className="bg-rose-500" />
          </div>
        </div>

        <div className="ca-panel p-5">
          <h2 className="font-semibold">Activity</h2>
          <div className="mt-4">
            <HeatmapCalendar activeDays={Math.min(110, calendar.length)} calendar={calendar} />
          </div>
        </div>
      </section>

      <section className="ca-panel p-5">
        <h2 className="font-semibold">Badges</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className={`rounded-lg border p-4 ${
                badge.earned
                  ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
                  : "border-slate-200 bg-slate-50/60 text-slate-400 dark:border-white/10 dark:bg-white/5"
              }`}
            >
              <Award className="h-5 w-5" />
              <p className="mt-3 font-semibold">{badge.label}</p>
              <p className="mt-1 text-sm">{badge.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ca-panel p-5">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-semibold">Contest Rating</h2>
        </div>
        <div className="mt-4 space-y-2">
          {(ratingHistory.data ?? []).map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[1fr_5rem_5rem] items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
            >
              <span>{event.contestId ? event.contestId.slice(0, 8) : "Contest"}</span>
              <span className={event.delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {event.delta >= 0 ? "+" : ""}
                {event.delta}
              </span>
              <span className="text-right font-semibold">{event.newRating}</span>
            </div>
          ))}
          {!ratingHistory.data?.length ? <p className="text-sm text-slate-500">No contest ratings yet.</p> : null}
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
  const percent = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
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
