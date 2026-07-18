import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Binary, BrainCircuit, Code2, GitBranch, ListChecks, Search, Shuffle, Sigma, Table2 } from "lucide-react";
import { problemsApi } from "../services/api";
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

  // first 5 as "recommended"
  const recommended = useMemo(() => {
    const list = problems.data ?? [];
    return list.slice(0, 5);
  }, [problems.data]);

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

  const dailyChallengeTitle = problems.data?.[0]?.title ?? "-";
  const continueList = (problems.data ?? []).slice(5, 9);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard label="Recommended" value={recommended.length} icon={ListChecks} />
        <StatsCard label="Daily Challenge" value={dailyChallengeTitle} icon={BrainCircuit} />
        <StatsCard label="Topics" value={tracks.length} icon={Table2} />
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111113]">
          <ProgressRing value={progress} label="Solved" />
        </div>
      </div>

      <section className="ca-panel p-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Practice Dashboard</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tracks.map((track) => {
            // count problems that have this tag
            const list = problems.data ?? [];
            let count = 0;
            for (let i = 0; i < list.length; i++) {
              const hasTag = list[i].tags.some((tag) => tag.name === track.tag);
              if (hasTag) {
                count = count + 1;
              }
            }

            return (
              <Link
                key={track.name}
                to={`/problems?tag=${encodeURIComponent(track.tag)}`}
                className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 transition-colors hover:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/30"
              >
                <track.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-3 font-semibold text-slate-900 dark:text-white">{track.name}</p>
                <p className="text-sm text-slate-500">{count} problems</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Recommended Problems</h2>
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
      </section>
    </div>
  );
}
