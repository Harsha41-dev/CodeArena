import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Award, CalendarDays, Lock, Unlock } from "lucide-react";
import { problemsApi } from "../services/api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { ProgressRing } from "../components/ProgressRing";
import { TagBadge } from "../components/TagBadge";

export function StudyPlanPage() {
  const { slug = "" } = useParams();

  const plan = useQuery({
    queryKey: ["study-plan", slug],
    queryFn: () => problemsApi.studyPlan(slug),
    enabled: Boolean(slug)
  });

  if (plan.isLoading) {
    return <LoadingState label="Loading study plan" />;
  }

  if (plan.isError) {
    return <ErrorState title="Could not load study plan" error={plan.error} />;
  }

  if (!plan.data) {
    return <EmptyState title="Study plan not found" />;
  }

  const data = plan.data;
  const isComplete = data.totalProblems > 0 && data.solvedCount === data.totalProblems;

  return (
    <div className="space-y-5">
      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Award className="h-3.5 w-3.5" />
              {isComplete ? data.badge : `${data.badge} in progress`}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data.title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data.description}</p>
          </div>
          <ProgressRing value={data.progressPercent} label="Done" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Problems" value={`${data.solvedCount}/${data.totalProblems}`} />
          <Metric label="Unlocked" value={String(data.unlockedCount)} />
          <Metric label="Daily Unlock" value={`${data.dailyUnlockCount}/day`} />
        </div>
        {data.todayProblem ? (
          <Link
            to={`/problems/${data.todayProblem.slug}`}
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 transition-colors hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <CalendarDays className="h-3.5 w-3.5" />
                Today
              </div>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{data.todayProblem.title}</p>
            </div>
            <DifficultyBadge difficulty={data.todayProblem.difficulty} />
          </Link>
        ) : null}
      </section>

      <section className="ca-panel overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5">
          Ordered Problems
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {data.problems.map((problem, index) => {
            const locked = Boolean(problem.locked);
            return (
              <Link
                key={problem.id}
                to={locked ? "#" : `/problems/${problem.slug}`}
                className={`grid gap-3 px-5 py-4 transition-colors md:grid-cols-[3rem_1fr_auto] ${
                  locked
                    ? "cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-white/5"
                    : "hover:bg-slate-50/70 dark:hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">{problem.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {problem.tags.slice(0, 3).map((tag) => (
                      <TagBadge key={tag.id} label={tag.name} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {problem.status ? <span className="text-xs font-medium text-slate-500">{problem.status}</span> : null}
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
              </Link>
            );
          })}
          {!data.problems.length ? <EmptyState title="No problems in this plan yet" /> : null}
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
