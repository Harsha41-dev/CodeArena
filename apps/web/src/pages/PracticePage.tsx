import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Award,
  Binary,
  BrainCircuit,
  Code2,
  GitBranch,
  ListChecks,
  RefreshCcw,
  Search,
  Shuffle,
  Sigma,
  Table2
} from "lucide-react";
import { problemsApi } from "../services/api";
import type { Problem } from "../types/api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { ProgressRing } from "../components/ProgressRing";
import { StatsCard } from "../components/StatsCard";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { TagBadge } from "../components/TagBadge";

// topic tracks shown on the practice dashboard
const tracks = [
  { name: "Arrays", icon: Table2, tag: "Array" },
  { name: "Strings", icon: Code2, tag: "String" },
  { name: "DP", icon: BrainCircuit, tag: "Dynamic Programming" },
  { name: "Graphs", icon: GitBranch, tag: "Graph" },
  { name: "Greedy", icon: Shuffle, tag: "Greedy" },
  { name: "Binary Search", icon: Search, tag: "Binary Search" },
  { name: "Trees", icon: Binary, tag: "Tree" },
  { name: "Math", icon: Sigma, tag: "Math" }
];

export function PracticePage() {
  const problems = useQuery({
    queryKey: ["practice-problems"],
    queryFn: () => problemsApi.list({ limit: "100" })
  });

  const dailyChallenge = useQuery({
    queryKey: ["daily-challenge"],
    queryFn: problemsApi.dailyChallenge
  });

  const recommendation = useQuery({
    queryKey: ["next-recommendation"],
    queryFn: problemsApi.nextRecommendation
  });

  const problemSets = useQuery({
    queryKey: ["problem-sets"],
    queryFn: problemsApi.problemSets
  });

  const studyPlans = useQuery({
    queryKey: ["study-plans"],
    queryFn: problemsApi.studyPlans
  });

  const revisionQueue = useQuery({
    queryKey: ["revision-queue"],
    queryFn: problemsApi.revisionQueue
  });

  const recommended = useMemo(() => {
    const list = problems.data ?? [];
    const result: Problem[] = [];
    if (recommendation.data?.problem) {
      result.push(recommendation.data.problem);
    }
    for (let i = 0; i < list.length && result.length < 5; i += 1) {
      if (result.some((problem) => problem.id === list[i].id)) {
        continue;
      }
      if (list[i].status !== "SOLVED") {
        result.push(list[i]);
      }
    }
    return result;
  }, [problems.data, recommendation.data?.problem]);

  const solvedCount = useMemo(() => {
    const list = problems.data ?? [];
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].status === "SOLVED") {
        count = count + 1;
      }
    }
    return count;
  }, [problems.data]);

  let progress = 0;
  if (problems.data && problems.data.length > 0) {
    progress = Math.round((solvedCount / problems.data.length) * 100);
  }

  if (problems.isLoading) {
    return <LoadingState label="Loading practice" />;
  }

  if (problems.isError) {
    return <ErrorState title="Could not load practice dashboard" error={problems.error} />;
  }

  const dailyChallengeTitle = dailyChallenge.data?.problem?.title ?? "-";
  const continueList = (problems.data ?? []).slice(5, 9);
  const sets = problemSets.data ?? [];
  const plans = studyPlans.data ?? [];
  const revisionProblems = revisionQueue.data?.problems ?? [];
  const practiceSets =
    sets.length > 0
      ? sets
      : tracks.map((track) => ({
          slug: track.name.toLowerCase().replace(/\s+/g, "-"),
          title: track.name,
          description: `${track.tag} practice`,
          totalProblems: 0,
          solvedCount: 0,
          progressPercent: 0
        }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard label="Recommended" value={recommended.length} icon={ListChecks} />
        <StatsCard label="Daily Challenge" value={dailyChallengeTitle} icon={BrainCircuit} />
        <StatsCard label="Study Plans" value={plans.length || sets.length || tracks.length} icon={Table2} />
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111113]">
          <ProgressRing value={progress} label="Solved" />
        </div>
      </div>

      <section className="ca-panel p-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Practice Dashboard</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {practiceSets.map((set) => {
            const Icon = iconForSet(set.slug);
            return (
              <Link
                key={set.slug}
                to={problemSetLink(set.slug)}
                className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 transition-colors hover:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/30"
              >
                <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-3 font-semibold text-slate-900 dark:text-white">{set.title}</p>
                <p className="text-sm text-slate-500">
                  {set.solvedCount}/{set.totalProblems} solved
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full bg-emerald-500" style={{ width: `${set.progressPercent}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="ca-panel p-6">
        <h2 className="font-semibold">Study Plans</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <Link
              key={plan.slug}
              to={`/study/${plan.slug}`}
              className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 transition-colors hover:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/30"
            >
              <div className="flex items-center justify-between gap-3">
                <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-500 dark:bg-black/20">
                  {plan.solvedCount}/{plan.totalProblems}
                </span>
              </div>
              <p className="mt-3 font-semibold text-slate-900 dark:text-white">{plan.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{plan.description}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full bg-emerald-500" style={{ width: `${plan.progressPercent}%` }} />
              </div>
              {plan.todayProblem ? (
                <p className="mt-3 text-xs font-medium text-slate-500">Today: {plan.todayProblem.title}</p>
              ) : null}
            </Link>
          ))}
          {!plans.length ? <EmptyState title="No study plans available yet" /> : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Recommended Problems</h2>
          {recommendation.data?.reason ? (
            <p className="mt-1 text-sm text-slate-500">{recommendation.data.reason}</p>
          ) : null}
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {recommended.map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{problem.title}</p>
                  <div className="mt-1 flex gap-1">
                    {problem.tags.slice(0, 2).map((tag) => (
                      <TagBadge key={tag.id} label={tag.name} />
                    ))}
                  </div>
                </div>
                <DifficultyBadge difficulty={problem.difficulty} />
              </Link>
            ))}
            {!recommended.length ? <EmptyState title="No recommendations yet" /> : null}
          </div>
        </div>

        <div className="ca-panel p-5">
          <h2 className="font-semibold">Continue Solving</h2>
          <div className="mt-4 space-y-3">
            {continueList.map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
              >
                <span>{problem.title}</span>
                <DifficultyBadge difficulty={problem.difficulty} />
              </Link>
            ))}
          </div>
        </div>

        <div className="ca-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Revision Queue</h2>
            <RefreshCcw className="h-4 w-4 text-slate-400" />
          </div>
          {revisionQueue.data?.reason ? <p className="mt-1 text-sm text-slate-500">{revisionQueue.data.reason}</p> : null}
          <div className="mt-3 space-y-3">
            {revisionProblems.slice(0, 5).map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
              >
                <span>{problem.title}</span>
                <DifficultyBadge difficulty={problem.difficulty} />
              </Link>
            ))}
            {!revisionProblems.length ? <EmptyState title="No revision items yet" /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function iconForSet(slug: string) {
  if (slug.includes("array")) return Table2;
  if (slug.includes("dynamic")) return BrainCircuit;
  if (slug.includes("graph")) return GitBranch;
  if (slug.includes("top")) return ListChecks;
  return Search;
}

function problemSetLink(slug: string): string {
  return `/sets/${slug}`;
}
