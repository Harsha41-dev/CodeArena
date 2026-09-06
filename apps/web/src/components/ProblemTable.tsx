import { Bookmark, ExternalLink, Eye, EyeOff, Lock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Problem } from "../types/api";
import { problemNumber } from "../lib/derivedStats";
import { socialApi } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { DifficultyBadge } from "./DifficultyBadge";
import { StatusBadge } from "./StatusBadge";
import { TagBadge } from "./TagBadge";
import { Button } from "./Button";

export function ProblemTable({
  problems,
  offset = 0,
  showVisibility = false
}: {
  problems: Problem[];
  offset?: number;
  showVisibility?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const bookmark = useMutation({
    mutationFn: (slug: string) => socialApi.addBookmark(slug),
    onSuccess: () => {
      // refresh bookmarks list if profile has it open
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    }
  });

  function handleBookmark(slug: string) {
    if (!user) {
      return;
    }
    bookmark.mutate(slug);
  }

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${showVisibility ? "min-w-[1080px]" : "min-w-[980px]"}`}>
        <thead className="ca-table-head">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Problem</th>
            <th className="px-4 py-3">Difficulty</th>
            <th className="px-4 py-3">Tags</th>
            <th className="px-4 py-3">Acceptance</th>
            <th className="px-4 py-3">Solved</th>
            <th className="px-4 py-3">Submissions</th>
            {showVisibility ? <th className="px-4 py-3">Visibility</th> : null}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {problems.map((problem, index) => {
            const number = problemNumber(problem, offset + index);
            const status = problem.status ?? "NOT_ATTEMPTED";
            const visibleTags = problem.tags.slice(0, 4);
            const acceptanceRate = problem.acceptanceRate ?? 0;
            const solvedCount = problem.solvedCount ?? 0;
            const totalSubmissions = problem.totalSubmissions ?? 0;
            const visibleCompanies = (problem.companies ?? []).slice(0, 3);

            return (
              <tr key={problem.id} className="ca-table-row">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{number}</td>
                <td className="px-4 py-3">
                  <Link
                    className="font-medium text-slate-950 hover:text-accent-600 dark:text-slate-100"
                    to={`/problems/${problem.slug}`}
                  >
                    {problem.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    TL {problem.timeLimitMs} ms - ML {problem.memoryLimitMb} MB
                  </p>
                  {visibleCompanies.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {visibleCompanies.map((entry) => (
                        <Link
                          key={entry.id}
                          to={`/companies/${entry.company.slug}`}
                          className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                        >
                          {entry.company.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <DifficultyBadge difficulty={problem.difficulty} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {visibleTags.map((tag) => (
                      <TagBadge key={tag.id} label={tag.name} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{acceptanceRate}%</td>
                <td className="px-4 py-3 text-slate-500">{solvedCount}</td>
                <td className="px-4 py-3 text-slate-500">{totalSubmissions}</td>
                {showVisibility ? (
                  <td className="px-4 py-3">
                    <VisibilityBadge visibility={problem.visibility ?? "PUBLIC"} />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      aria-label="Bookmark problem"
                      disabled={!user || bookmark.isPending}
                      onClick={() => handleBookmark(problem.slug)}
                    >
                      <Bookmark className="h-4 w-4" />
                    </Button>
                    <Link
                      className="inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      to={`/problems/${problem.slug}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function VisibilityBadge({ visibility }: { visibility: NonNullable<Problem["visibility"]> }) {
  const styles = {
    PUBLIC: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    PRIVATE: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    ARCHIVED: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
  } satisfies Record<NonNullable<Problem["visibility"]>, string>;
  const icons = {
    PUBLIC: Eye,
    PRIVATE: Lock,
    ARCHIVED: EyeOff
  } satisfies Record<NonNullable<Problem["visibility"]>, typeof Eye>;
  const Icon = icons[visibility];

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${styles[visibility]}`}>
      <Icon className="h-3.5 w-3.5" />
      {visibility}
    </span>
  );
}
