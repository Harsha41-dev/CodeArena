import { Bookmark, ExternalLink } from "lucide-react";
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

export function ProblemTable({ problems, offset = 0 }: { problems: Problem[]; offset?: number }) {
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
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="ca-table-head">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Problem</th>
            <th className="px-4 py-3">Difficulty</th>
            <th className="px-4 py-3">Tags</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {problems.map((problem, index) => {
            const number = problemNumber(problem, offset + index);
            const status = problem.status ?? "NOT_ATTEMPTED";
            const visibleTags = problem.tags.slice(0, 4);

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
