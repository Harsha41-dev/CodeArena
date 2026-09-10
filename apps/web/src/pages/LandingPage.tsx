import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { contestsApi, leaderboardApi, problemsApi, submissionsApi } from "../services/api";
import { Button } from "../components/Button";
import { ContestCard } from "../components/ContestCard";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { EmptyState } from "../components/State";
import { Card, CardContent, CardHeader, CardTitle } from "../components/Card";

export function LandingPage() {
  const problems = useQuery({
    queryKey: ["landing-problems"],
    queryFn: () => problemsApi.list({ limit: "8", sort: "frequency" })
  });

  const dailyChallenge = useQuery({
    queryKey: ["landing-daily-challenge"],
    queryFn: problemsApi.dailyChallenge
  });

  const contests = useQuery({
    queryKey: ["landing-contests"],
    queryFn: contestsApi.list
  });

  const leaderboard = useQuery({
    queryKey: ["landing-leaderboard"],
    queryFn: leaderboardApi.global
  });

  const submissions = useQuery({
    queryKey: ["landing-submissions"],
    queryFn: () => submissionsApi.list(),
    retry: false
  });

  const problemList = problems.data ?? [];
  const daily = dailyChallenge.data?.problem ?? (problemList.length > 0 ? problemList[0] : undefined);
  const popular = problemList.filter((problem) => problem.id !== daily?.id).slice(0, 4);
  const upcoming = (contests.data ?? []).slice(0, 2);
  const live = (contests.data ?? []).find((contest) => contest.status === "LIVE");

  let submissionCount: number | string = "—";
  if (submissions.data) {
    submissionCount = submissions.data.length;
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          {live ? (
            <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[#7dcfb6]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#7dcfb6]" />
              Live · {live.title}
            </p>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#9aa1ac]">Daily practice</p>
          )}
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Practice DSA.
            <br />
            Run contests.
            <br />
            Watch the rating move.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#9aa1ac]">
            An online judge with a queue, a worker, and a workspace that takes the problem seriously. Submit as if the
            worker is on the other side of Redis — because it is.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/problems">
              <Button>Browse problems</Button>
            </Link>
            <Link to="/contests">
              <Button variant="secondary">Contests</Button>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "Problems", v: String(problemList.length) },
            { l: "Submissions", v: String(submissionCount) },
            { l: "On the board", v: String(leaderboard.data?.length ?? 0) },
            { l: "Rated rounds", v: String(contests.data?.length ?? 0) }
          ].map((stat) => (
            <div key={stat.l} className="rounded-[28px] border border-[#252a32] bg-[#101216] p-5">
              <p className="text-xs text-[#9aa1ac]">{stat.l}</p>
              <p className="mt-2 font-serif text-3xl tabular-nums">{stat.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-[#252a32] bg-[#101216] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Daily challenge</h2>
            {daily ? <DifficultyBadge difficulty={daily.difficulty} /> : null}
          </div>
          {daily ? (
            <>
              <h3 className="mt-4 font-serif text-2xl">{daily.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-[#9aa1ac]">{daily.description}</p>
              <Link
                to={`/problems/${daily.slug}`}
                className="mt-5 inline-flex items-center gap-2 text-sm text-[#7dcfb6]"
              >
                Solve now <ArrowRight className="size-4" />
              </Link>
            </>
          ) : (
            <EmptyState title="No challenge available" />
          )}
        </article>
        <article className="rounded-[28px] border border-[#252a32] bg-[#101216] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Popular</h2>
            <Link className="text-sm text-[#7dcfb6]" to="/problems">
              Catalog
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[#252a32]">
            {popular.map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span>{problem.title}</span>
                <DifficultyBadge difficulty={problem.difficulty} />
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-serif text-2xl">Contests</h2>
            <Link className="text-sm text-[#7dcfb6]" to="/contests">
              All rounds
            </Link>
          </div>
          {upcoming.length === 0 ? <EmptyState title="No contests right now" /> : null}
          {upcoming.map((contest) => (
            <ContestCard key={contest.id} contest={contest} />
          ))}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-serif text-2xl">Leaderboard</h2>
            <Link className="text-sm text-[#7dcfb6]" to="/leaderboard">
              Full board
            </Link>
          </div>
          <Card>
            <CardHeader className="border-0 py-4">
              <CardTitle>Global</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <LeaderboardTable rows={(leaderboard.data ?? []).slice(0, 5)} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
