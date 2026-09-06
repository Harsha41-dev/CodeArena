import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, ListChecks, RefreshCcw, Trophy } from "lucide-react";
import { adminApi } from "../../services/api";
import type { Problem, Submission } from "../../types/api";
import { Button } from "../../components/Button";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { VisibilityBadge } from "../../components/ProblemTable";
import { VerdictBadge } from "../../components/VerdictBadge";
import { submissionLanguageLabel } from "../../lib/languages";
import { Operation, PanelTitle } from "./formFields";

interface MonitoringSidebarProps {
  problems: Problem[];
  submissions: Submission[];
  contestCount: number;
  userCount: number;
  onToast?: (message: string) => void;
}

export function MonitoringSidebar({ problems, submissions, contestCount, userCount, onToast }: MonitoringSidebarProps) {
  const queryClient = useQueryClient();

  const rejudgeSubmission = useMutation({
    mutationFn: (submissionId: string) => adminApi.rejudgeSubmission(submissionId),
    onSuccess: () => {
      onToast?.("Submission queued for rejudge");
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    }
  });

  const rejudgeInternalErrors = useMutation({
    mutationFn: () => adminApi.rejudgeSubmissions({ status: "INTERNAL_ERROR", limit: 50 }),
    onSuccess: (result) => {
      onToast?.(`${result.queued} internal-error submissions queued`);
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    }
  });

  return (
    <aside className="space-y-4">
      <section className="ca-panel p-5">
        <PanelTitle icon={ListChecks} title="Problem Management" />
        <div className="mt-4 space-y-2">
          {problems.slice(0, 6).map((problem) => (
            <div
              key={problem.id}
              className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{problem.title}</p>
                <p className="text-xs text-slate-500">{problem.slug}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <VisibilityBadge visibility={problem.visibility ?? "PUBLIC"} />
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
            </div>
          ))}
          {!problems.length ? <p className="text-sm text-slate-500">No problems loaded yet.</p> : null}
        </div>
      </section>

      <section className="ca-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle icon={Activity} title="Submission Monitoring" />
          <Button
            className="h-8 px-2 text-xs"
            variant="secondary"
            disabled={rejudgeInternalErrors.isPending}
            onClick={() => rejudgeInternalErrors.mutate()}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Rejudge Errors
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {submissions.slice(0, 6).map((submission) => (
            <div
              key={submission.id}
              className="grid gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{submission.id.slice(0, 8)}</span>
                <span>{submissionLanguageLabel(submission)}</span>
                <VerdictBadge status={submission.status} />
              </div>
              <Button
                className="h-8 px-2 text-xs"
                variant="ghost"
                disabled={rejudgeSubmission.isPending}
                onClick={() => rejudgeSubmission.mutate(submission.id)}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Rejudge
              </Button>
            </div>
          ))}
          {!submissions.length ? <p className="text-sm text-slate-500">No submissions visible yet.</p> : null}
        </div>
      </section>

      <section className="ca-panel p-5">
        <PanelTitle icon={Trophy} title="Contest And User Ops" />
        <div className="mt-4 grid gap-2 text-sm">
          <Operation label="Contest management" state={`${contestCount} contests loaded`} />
          <Operation label="User management" state={`${userCount} users loaded`} />
          <Operation label="Problem builder" state={`${problems.length} problems loaded`} />
          <Operation label="Submission monitor" state={`${submissions.length} submissions visible`} />
        </div>
      </section>
    </aside>
  );
}
