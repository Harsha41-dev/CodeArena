import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { ListChecks, RefreshCcw, Trophy, UsersRound } from "lucide-react";
import { contestsApi, problemsApi } from "../services/api";
import { Button } from "../components/Button";
import { ContestTimer } from "../components/ContestTimer";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { StatsCard } from "../components/StatsCard";
import { StatusBadge } from "../components/StatusBadge";
import { useAuthStore } from "../stores/authStore";
import { formatDateTime } from "../lib/derivedStats";

export function ContestDetailPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // same page handles /contests/:id and /contests/:id/leaderboard
  const standingsMode = location.pathname.endsWith("/leaderboard");

  const contest = useQuery({
    queryKey: ["contest", id],
    queryFn: () => contestsApi.get(id),
    enabled: Boolean(id)
  });

  // map problem ids -> problem objects for titles/difficulty
  const problems = useQuery({
    queryKey: ["contest-problem-map"],
    queryFn: () => problemsApi.list({ limit: "100" })
  });

  const leaderboard = useQuery({
    queryKey: ["contest-leaderboard", id],
    queryFn: () => contestsApi.leaderboard(id),
    enabled: Boolean(id)
  });

  const register = useMutation({
    mutationFn: () => contestsApi.register(id)
  });

  const problemMap = useMemo(() => {
    const map = new Map();
    const list = problems.data ?? [];
    for (let i = 0; i < list.length; i++) {
      map.set(list[i].id, list[i]);
    }
    return map;
  }, [problems.data]);

  if (contest.isLoading) {
    return <LoadingState label="Loading contest" />;
  }

  if (contest.isError) {
    return <ErrorState title="Could not load contest" error={contest.error} />;
  }

  if (!contest.data) {
    return <EmptyState title="Contest not found" />;
  }

  const data = contest.data;
  const startMs = new Date(data.startTime).getTime();
  const endMs = new Date(data.endTime).getTime();
  const durationHours = Math.max(1, Math.round((endMs - startMs) / 3600000));
  const rankedCount = leaderboard.data?.length ?? 0;
  const previewRows = (leaderboard.data ?? []).slice(0, 6);

  function handleRegister() {
    if (!user) {
      return;
    }
    register.mutate();
  }

  function handleRefreshStandings() {
    leaderboard.refetch();
  }

  return (
    <div className="space-y-5">
      <section className="ca-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{data.title}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">{data.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ContestTimer startTime={data.startTime} endTime={data.endTime} />
              <span className="text-sm text-slate-500">
                {formatDateTime(data.startTime)} - {formatDateTime(data.endTime)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!user || register.isPending} onClick={handleRegister}>
              <Trophy className="h-4 w-4" /> Register
            </Button>
            <Link to={`/contests/${id}/leaderboard`}>
              <Button variant="secondary">
                <UsersRound className="h-4 w-4" /> Standings
              </Button>
            </Link>
          </div>
        </div>
        {register.isSuccess ? <p className="mt-3 text-sm text-emerald-600">Registration confirmed.</p> : null}
        {register.isError ? (
          <div className="mt-3">
            <ErrorState title="Registration failed" error={register.error} />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard label="Problems" value={data.problems.length} icon={ListChecks} />
        <StatsCard label="Ranked" value={rankedCount} icon={UsersRound} />
        <StatsCard label="Duration" value={`${durationHours}h`} />
        <StatsCard label="Mode" value={data.status} />
      </div>

      {standingsMode ? (
        <section className="ca-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold">Standings</h2>
              <p className="text-sm text-slate-500">Solved count, penalty, and per-problem cells.</p>
            </div>
            <Button variant="secondary" onClick={handleRefreshStandings}>
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
          </div>
          {leaderboard.isError ? (
            <div className="p-5">
              <ErrorState title="Could not load standings" error={leaderboard.error} />
            </div>
          ) : null}
          {leaderboard.data?.length ? (
            <ContestStandings rows={leaderboard.data} problemCount={data.problems.length} />
          ) : (
            <div className="p-5">
              <EmptyState title="No standings yet" />
            </div>
          )}
        </section>
      ) : (
        <section className="ca-panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold">Problems</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="ca-table-head">
                <tr>
                  <th className="px-4 py-3">Index</th>
                  <th className="px-4 py-3">Problem</th>
                  <th className="px-4 py-3">Difficulty</th>
                  <th className="px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.problems.map((contestProblem, index) => {
                  const problem = problemMap.get(contestProblem.problemId);
                  const letter = String.fromCharCode(65 + index);

                  return (
                    <tr key={contestProblem.problemId} className="ca-table-row">
                      <td className="px-4 py-3 font-semibold">{letter}</td>
                      <td className="px-4 py-3">
                        {problem ? (
                          <Link className="font-medium text-accent-600" to={`/contests/${id}/problems/${problem.slug}`}>
                            {problem.title}
                          </Link>
                        ) : (
                          contestProblem.problemId.slice(0, 8)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {problem ? <DifficultyBadge difficulty={problem.difficulty} /> : "-"}
                      </td>
                      <td className="px-4 py-3">{contestProblem.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!standingsMode ? (
        <section className="ca-panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold">Leaderboard Preview</h2>
          </div>
          <LeaderboardTable rows={previewRows} />
        </section>
      ) : null}
    </div>
  );
}

function ContestStandings({
  rows,
  problemCount
}: {
  rows: Awaited<ReturnType<typeof contestsApi.leaderboard>>;
  problemCount: number;
}) {
  // build A, B, C... column headers
  const problemHeaders: string[] = [];
  for (let i = 0; i < problemCount; i++) {
    problemHeaders.push(String.fromCharCode(65 + i));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="ca-table-head">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Solved</th>
            <th className="px-4 py-3">Penalty</th>
            {problemHeaders.map((letter) => (
              <th key={letter} className="px-4 py-3 text-center">
                {letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user.id} className="ca-table-row">
              <td className="px-4 py-3 font-semibold">#{row.rank}</td>
              <td className="px-4 py-3">
                <p className="font-medium">{row.user.displayName}</p>
                <p className="text-xs text-slate-500">@{row.user.username}</p>
              </td>
              <td className="px-4 py-3">{row.solvedCount}</td>
              <td className="px-4 py-3">{row.penaltyMinutes ?? 0}</td>
              {problemHeaders.map((_, index) => {
                const solved = index < row.solvedCount;
                let cellClass = "bg-slate-100 text-slate-500 dark:bg-slate-800";
                let cellText = "--";
                if (solved) {
                  cellClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                  cellText = `+${index + 1}`;
                }
                return (
                  <td key={index} className="px-4 py-3 text-center">
                    <span className={`inline-flex min-w-12 justify-center rounded-md px-2 py-1 text-xs ${cellClass}`}>
                      {cellText}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
