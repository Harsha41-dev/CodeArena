import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leaderboardApi } from "../services/api";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { FilterBar, SelectFilter } from "../components/FilterBar";
import { StatsCard } from "../components/StatsCard";
import { Trophy, TrendingUp, UsersRound } from "lucide-react";

export function LeaderboardPage() {
  const [scope, setScope] = useState("global");

  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: leaderboardApi.global
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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard label="Ranked Users" value={rankedCount} icon={UsersRound} />
        <StatsCard label="Top Solver" value={topSolver} icon={Trophy} />
        <StatsCard label="Rank Movement" value="Snapshot based" icon={TrendingUp} />
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
    </div>
  );
}
