import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CalendarClock, Code2, Flame, Trophy, UsersRound } from "lucide-react";
import { contestsApi, leaderboardApi, problemsApi, submissionsApi } from "../services/api";
import { Button } from "../components/Button";
import { ContestCard } from "../components/ContestCard";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { StatsCard } from "../components/StatsCard";
import { EmptyState } from "../components/State";
import { Card, CardContent, CardHeader, CardTitle } from "../components/Card";

export function LandingPage() {
  const problems = useQuery({
    queryKey: ["landing-problems"],
    queryFn: () => problemsApi.list({ limit: "8" })
  });

  const contests = useQuery({
    queryKey: ["landing-contests"],
    queryFn: contestsApi.list
  });

  const leaderboard = useQuery({
    queryKey: ["landing-leaderboard"],
    queryFn: leaderboardApi.global
  });

  // submissions need auth — if guest, this just fails and we show "Login"
  const submissions = useQuery({
    queryKey: ["landing-submissions"],
    queryFn: submissionsApi.list,
    retry: false
  });

  const problemList = problems.data ?? [];
  const daily = problemList.length > 0 ? problemList[0] : undefined;
  const popular = problemList.slice(1, 5);
  const upcoming = (contests.data ?? []).slice(0, 2);

  let submissionCount: number | string = "Login";
  if (submissions.data) {
    submissionCount = submissions.data.length;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-[#111113] dark:ring-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5 dark:from-emerald-500/10 dark:to-transparent" />
        <div className="relative grid gap-8 p-8 lg:grid-cols-[1.3fr_0.9fr] lg:p-12">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/50 bg-amber-50/50 px-3 py-1 text-sm font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
              <Flame className="h-4 w-4 text-amber-500" />
              Personal project — still growing
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Practice DSA. <br /> Run contests. <br /> See your progress.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              CodeArena is a coding platform I built to learn online judges — problems, submissions, contests, and a bit
              of community stuff.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/problems">
                <Button className="h-11 px-6 text-base">
                  <Code2 className="h-5 w-5" /> Browse problems
                </Button>
              </Link>
              <Link to="/contests">
                <Button variant="secondary" className="h-11 px-6 text-base">
                  <Trophy className="h-5 w-5" /> Contests
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatsCard icon={Code2} label="Problems" value={problemList.length} hint="from seed data" />
            <StatsCard
              icon={UsersRound}
              label="On leaderboard"
              value={leaderboard.data?.length ?? 0}
              hint="demo users"
            />
            <StatsCard icon={BarChart3} label="Your submissions" value={submissionCount} hint="login to see" />
            <StatsCard
              icon={CalendarClock}
              label="Contests"
              value={contests.data?.length ?? 0}
              hint="upcoming / live / past"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle>Daily Challenge</CardTitle>
            <Link
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              to={daily ? `/problems/${daily.slug}` : "/problems"}
            >
              Open
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            {daily ? (
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{daily.title}</h3>
                  <DifficultyBadge difficulty={daily.difficulty} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{daily.description}</p>
                <Link
                  to={`/problems/${daily.slug}`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Solve challenge <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <EmptyState title="No challenge available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle>Popular Problems</CardTitle>
            <Link
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              to="/problems"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {popular.map((problem) => (
                <Link
                  key={problem.id}
                  to={`/problems/${problem.slug}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-white/5"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">{problem.title}</span>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-slate-900 dark:text-white">Upcoming Contests</h2>
            <Link
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              to="/contests"
            >
              Contest archive
            </Link>
          </div>
          {upcoming.length === 0 ? <EmptyState title="No contests right now" /> : null}
          {upcoming.map((contest) => (
            <ContestCard key={contest.id} contest={contest} />
          ))}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-slate-900 dark:text-white">Leaderboard</h2>
            <Link
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              to="/leaderboard"
            >
              Full rankings
            </Link>
          </div>
          <LeaderboardTable rows={(leaderboard.data ?? []).slice(0, 5)} />
        </div>
      </section>
    </div>
  );
}
