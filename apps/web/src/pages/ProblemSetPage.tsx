import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ListChecks, Play } from "lucide-react";
import { problemsApi } from "../services/api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { ProgressRing } from "../components/ProgressRing";
import { StatusBadge } from "../components/StatusBadge";
import { TagBadge } from "../components/TagBadge";

export function ProblemSetPage() {
  const { slug = "" } = useParams();

  const set = useQuery({
    queryKey: ["problem-set", slug],
    queryFn: () => problemsApi.problemSet(slug),
    enabled: Boolean(slug)
  });

  if (set.isLoading) {
    return <LoadingState label="Loading problem set" />;
  }

  if (set.isError) {
    return <ErrorState title="Could not load problem set" error={set.error} />;
  }

  if (!set.data) {
    return <EmptyState title="Problem set not found" />;
  }

  const data = set.data;
  const nextProblem = data.problems.find((problem) => problem.status !== "SOLVED") ?? data.problems[0] ?? null;

  return (
    <div className="space-y-5">
      <Link
        to="/practice"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Practice
      </Link>

      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <ListChecks className="h-3.5 w-3.5" />
              Curated List
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data.title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data.description}</p>
          </div>
          <ProgressRing value={data.progressPercent} label="Done" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Problems" value={String(data.totalProblems)} />
          <Metric label="Solved" value={String(data.solvedCount)} />
          <Metric label="Remaining" value={String(Math.max(0, data.totalProblems - data.solvedCount))} />
        </div>
        {nextProblem ? (
          <Link
            to={`/problems/${nextProblem.slug}`}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
          >
            <Play className="h-4 w-4" />
            Start Next
          </Link>
        ) : null}
      </section>

      <section className="ca-panel overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5">
          Ordered Problems
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {data.problems.map((problem, index) => (
            <Link
              key={problem.id}
              to={`/problems/${problem.slug}`}
              className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 md:grid-cols-[3rem_1fr_auto] dark:hover:bg-white/5"
            >
              <div className="font-mono text-sm font-semibold text-slate-500">{index + 1}</div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{problem.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {problem.tags.slice(0, 4).map((tag) => (
                    <TagBadge key={tag.id} label={tag.name} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={problem.status ?? "NOT_ATTEMPTED"} />
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
            </Link>
          ))}
          {!data.problems.length ? <EmptyState title="No problems in this list yet" /> : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
