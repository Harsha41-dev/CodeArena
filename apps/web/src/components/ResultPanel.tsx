import type { Submission } from "../types/api";
import { formatDateTime } from "../lib/derivedStats";
import { submissionLanguageLabel } from "../lib/languages";
import { formatStatus } from "../lib/status";
import { VerdictBadge } from "./VerdictBadge";

export function ResultPanel({ submission }: { submission?: Submission | null }) {
  if (!submission) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-white/10">
        No submission selected.
      </div>
    );
  }

  const results = submission.results ?? [];
  let passed = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "ACCEPTED") {
      passed = passed + 1;
    }
  }
  const total = results.length;

  const languageLabel = submissionLanguageLabel(submission);
  const createdAt = formatDateTime(submission.createdAt);
  const diagnostic = submissionDiagnostic(submission);
  const runtimeText = `${submission.runtimeMs ?? "-"} ms`;
  const memoryText = `${submission.memoryKb ?? "-"} KB`;
  const codeLength = `${submission.code.length} chars`;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-sm dark:border-white/10 dark:bg-[#111113]">
      <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Submission Result</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {languageLabel} • {createdAt}
            </p>
          </div>
          <VerdictBadge status={submission.status} />
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-4">
        <Metric label="Passed" value={`${passed}/${total}`} />
        <Metric label="Runtime" value={runtimeText} />
        <Metric label="Memory" value={memoryText} />
        <Metric label="Code" value={codeLength} />
      </div>
      {diagnostic ? (
        <pre className="mx-4 mb-4 rounded-lg bg-rose-50/80 p-3 text-[13px] font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50">
          {diagnostic}
        </pre>
      ) : null}
    </div>
  );
}

function submissionDiagnostic(submission: Submission): string | null {
  const errorMessage = submission.errorMessage?.trim();

  if (submission.status === "WRONG_ANSWER") {
    // sometimes backend sends "accepted" by mistake, ignore that
    if (!errorMessage || errorMessage.toLowerCase() === "accepted") {
      return "Output did not match the expected answer.";
    }
  }

  // no diagnostic for happy / in-progress states
  if (submission.status === "ACCEPTED" || submission.status === "PENDING" || submission.status === "RUNNING") {
    return null;
  }

  if (errorMessage) {
    return errorMessage;
  }

  return formatStatus(submission.status);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
