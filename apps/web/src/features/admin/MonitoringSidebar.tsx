import { Activity, ListChecks, Trophy } from "lucide-react";
import type { Problem, Submission } from "../../types/api";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { VerdictBadge } from "../../components/VerdictBadge";
import { submissionLanguageLabel } from "../../lib/languages";
import { Operation, PanelTitle } from "./formFields";

interface MonitoringSidebarProps {
  problems: Problem[];
  submissions: Submission[];
  contestCount: number;
  userCount: number;
}

export function MonitoringSidebar({ problems, submissions, contestCount, userCount }: MonitoringSidebarProps) {
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
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
          ))}
          {!problems.length ? <p className="text-sm text-slate-500">No problems loaded yet.</p> : null}
        </div>
      </section>

      <section className="ca-panel p-5">
        <PanelTitle icon={Activity} title="Submission Monitoring" />
        <div className="mt-4 space-y-2">
          {submissions.slice(0, 6).map((submission) => (
            <div
              key={submission.id}
              className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
            >
              <span className="font-mono text-xs">{submission.id.slice(0, 8)}</span>
              <span>{submissionLanguageLabel(submission)}</span>
              <VerdictBadge status={submission.status} />
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
