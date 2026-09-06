import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leaderboardApi, ratingsApi } from "../services/api";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { FilterBar, SelectFilter } from "../components/FilterBar";
import { StatsCard } from "../components/StatsCard";
import { Star, Trophy, TrendingUp, UsersRound } from "lucide-react";

export function LeaderboardPage() {
  const [scope, setScope] = useState("global");

  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: leaderboardApi.global
  });

  const ratings = useQuery({
    queryKey: ["ratings-leaderboard"],
    queryFn: () => ratingsApi.leaderboard({ limit: "10" })
  });

  // scope is client-side only for now (weekly/monthly just slice the list)
  const rows = useMemo(() => {
    const data = leaderboard.data ?? [];
    if (scope === "weekly") {
      return data.slice(0, 10);
    }
    if (scope === "monthly") {
      return data.slice(0, 25);
    }
    // friends / contest fall back to full list until we have real endpoints
    return data;
  }, [leaderboard.data, scope]);

  if (leaderboard.isLoading) {
    return <LoadingState label="Loading leaderboard" />;
  }

  if (leaderboard.isError) {
    return <ErrorState title="Could not load leaderboard" error={leaderboard.error} />;
  }

  const rankedCount = leaderboard.data?.length ?? 0;
  const topSolver = leaderboard.data?.[0]?.user.username ?? "-";
  const topRated = ratings.data?.[0]?.user?.username ?? "-";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard label="Ranked Users" value={rankedCount} icon={UsersRound} />
        <StatsCard label="Top Solver" value={topSolver} icon={Trophy} />
        <StatsCard label="Top Rating" value={topRated} icon={Star} />
      </div>

      <section className="ca-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Global Leaderboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ranked by solved problems, accepted submissions, and contest signals.
            </p>
          </div>
          <FilterBar>
            <SelectFilter
              label="Scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: "global", label: "Global" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "friends", label: "Friends" },
                { value: "contest", label: "Contest" }
              ]}
            />
          </FilterBar>
        </div>

        {!rows.length ? (
          <div className="p-5">
            <EmptyState title="No ranked users yet" body="Accepted submissions will populate this board." />
          </div>
        ) : (
          <LeaderboardTable rows={rows} />
        )}
      </section>

      <section className="ca-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-semibold">Contest Ratings</h2>
        </div>
        <div className="p-5">
          {ratings.isError ? <ErrorState title="Could not load ratings" error={ratings.error} /> : null}
          {ratings.isLoading ? <LoadingState label="Loading ratings" /> : null}
          {!ratings.isLoading && !ratings.data?.length ? (
            <EmptyState title="No ratings yet" body="Admin-published contest ratings will appear here." />
          ) : null}
          <div className="space-y-2">
            {(ratings.data ?? []).map((rating, index) => (
              <div
                key={rating.id}
                className="grid grid-cols-[3rem_1fr_6rem] items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
              >
                <span className="font-semibold">#{index + 1}</span>
                <span>{rating.user?.displayName ?? rating.userId.slice(0, 8)}</span>
                <span className="text-right font-semibold">{rating.rating}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
