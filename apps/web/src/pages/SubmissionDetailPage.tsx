import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MessageSquareShare } from "lucide-react";
import { leaderboardApi, solutionsApi, submissionsApi } from "../services/api";
import { Button } from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { ResultPanel } from "../components/ResultPanel";
import { SubmissionLiveStatusBanner } from "../components/SubmissionLiveStatusBanner";
import { VerdictBadge } from "../components/VerdictBadge";
import { useSubmissionEvents } from "../hooks/useSubmissionEvents";
import { submissionLanguageLabel } from "../lib/languages";
import { isTerminalSubmissionStatus } from "../lib/status";
import type { Submission } from "../types/api";

export function SubmissionDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const liveUpdates = useSubmissionEvents(id, Boolean(id));

  const submission = useQuery({
    queryKey: ["submission", id],
    queryFn: () => submissionsApi.get(id),
    enabled: Boolean(id),
    // poll only if websocket fell back and still running
    refetchInterval: (query) => {
      const liveStatus = liveUpdates.event?.status;
      const dataStatus = query.state.data?.status;
      const status = liveStatus ?? dataStatus;
      if (!liveUpdates.isPollingFallback) {
        return false;
      }
      if (status === "PENDING" || status === "RUNNING") {
        return 1000;
      }
      return false;
    }
  });

  const previousSubmissions = useQuery({
    queryKey: ["submission-compare", id, submission.data?.problem?.slug],
    queryFn: () => submissionsApi.list({ problemSlug: submission.data!.problem!.slug, limit: "20" }),
    enabled: Boolean(submission.data?.problem?.slug)
  });

  const runtimeComparison = useQuery({
    queryKey: ["submission-runtime-comparison", submission.data?.problem?.slug],
    queryFn: () => leaderboardApi.problem(submission.data!.problem!.slug),
    enabled: Boolean(submission.data?.problem?.slug && submission.data?.status === "ACCEPTED")
  });

  const shareSolution = useMutation({
    mutationFn: () => {
      const current = submission.data!;
      const problem = current.problem!;
      const language = current.languageKeySnapshot ?? current.languageNameSnapshot ?? current.language;
      return solutionsApi.create(problem.slug, {
        submissionId: current.id,
        title: `Accepted solution: ${problem.title}`,
        content: `Shared from an accepted ${submissionLanguageLabel(current)} submission.\n\n\`\`\`${language}\n${current.code}\n\`\`\``,
        code: current.code,
        language,
        visibility: "PUBLIC"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problem-solutions", submission.data?.problem?.slug] });
    }
  });

  // merge live event fields into the cached submission
  useEffect(() => {
    const event = liveUpdates.event;
    if (!event) {
      return;
    }
    if (event.submissionId !== id) {
      return;
    }

    queryClient.setQueryData<Submission>(["submission", id], (current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        status: event.status,
        runtimeMs: event.runtime,
        memoryKb: event.memory
      };
    });

    // once terminal, re-fetch full result (test case rows etc.)
    if (isTerminalSubmissionStatus(event.status)) {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
    }
  }, [id, liveUpdates.event, queryClient]);

  if (submission.isLoading) {
    return <LoadingState label="Loading submission" />;
  }

  if (submission.isError) {
    return <ErrorState title="Could not load submission" error={submission.error} />;
  }

  if (!submission.data) {
    return <EmptyState title="Submission not found" />;
  }

  const data = submission.data;
  const shortId = data.id.slice(0, 8);
  const problemTitle = data.problem?.title ?? data.problemId;
  const languageLabel = submissionLanguageLabel(data);
  const results = data.results ?? [];
  const previousList = previousSubmissions.data ?? [];
  const currentTime = new Date(data.createdAt).getTime();
  const previousSubmission =
    previousList.find((item) => item.id !== data.id && new Date(item.createdAt).getTime() < currentTime) ??
    previousList.find((item) => item.id !== data.id) ??
    null;
  const canShareSolution = data.status === "ACCEPTED" && Boolean(data.problem?.slug);
  const performanceComparison = calculatePerformanceComparison(
    data.runtimeMs ?? null,
    data.memoryKb ?? null,
    runtimeComparison.data ?? []
  );

  return (
    <div className="space-y-4">
      <section className="ca-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Submission {shortId}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {problemTitle} &middot; {languageLabel}
            </p>
          </div>
          <VerdictBadge status={data.status} />
        </div>
        <div className="p-5">
          <SubmissionLiveStatusBanner
            event={liveUpdates.event}
            status={data.status}
            connectionState={liveUpdates.connectionState}
          />
          <div className="mt-4">
            <ResultPanel submission={data} />
          </div>
          {performanceComparison ? (
            <div className="mt-4 grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 text-sm dark:border-white/10 dark:bg-white/5 md:grid-cols-4">
              <Metric label="Runtime Rank" value={performanceComparison.rankLabel} />
              <Metric label="Faster Than" value={performanceComparison.fasterThanLabel} />
              <Metric label="Memory Better Than" value={performanceComparison.memoryBetterThanLabel} />
              <Metric label="Accepted Pool" value={String(performanceComparison.total)} />
            </div>
          ) : null}
          {canShareSolution ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="secondary" disabled={shareSolution.isPending} onClick={() => shareSolution.mutate()}>
                <MessageSquareShare className="h-4 w-4" />
                {shareSolution.isPending ? "Sharing" : "Share Solution"}
              </Button>
              {shareSolution.data ? (
                <Link className="text-sm font-medium text-emerald-600" to={`/problems/${data.problem?.slug}?tab=solutions`}>
                  Open problem solutions
                </Link>
              ) : null}
              {shareSolution.isError ? (
                <span className="text-sm font-medium text-rose-600">{shareSolution.error.message}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <pre className="ca-panel max-h-[70vh] overflow-auto p-4 text-xs">{data.code}</pre>
        <div className="ca-panel p-4">
          <h2 className="font-semibold">Test Case Results</h2>
          <div className="mt-3 space-y-3">
            {!results.length ? (
              <EmptyState title="No case results yet" body="Queued submissions show results after judging completes." />
            ) : null}

            {results.map((result, index) => (
              <div
                key={result.testCaseId ?? index}
                className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">Case {index + 1}</p>
                  <VerdictBadge status={result.status} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Block title="Output" value={result.actualOutput} />
                  <Block title="Expected" value={result.expectedOutput} />
                  <Block title="Runtime" value={`${result.runtimeMs ?? "-"} ms`} />
                  <Block title="Error" value={result.stderr ?? ""} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ca-panel p-4">
        <h2 className="font-semibold">Compare With Previous Submission</h2>
        <div className="mt-4">
          {previousSubmission ? (
            <CodeCompare current={data.code} previous={previousSubmission.code} />
          ) : (
            <EmptyState title="No previous submission to compare" />
          )}
        </div>
      </section>
    </div>
  );
}

function calculatePerformanceComparison(
  runtimeMs: number | null,
  memoryKb: number | null,
  rows: Awaited<ReturnType<typeof leaderboardApi.problem>>
): { rankLabel: string; fasterThanLabel: string; memoryBetterThanLabel: string; total: number } | null {
  if (!runtimeMs || rows.length === 0) {
    return null;
  }

  const slower = rows.filter((row) => row.runtimeMs >= runtimeMs).length;
  const fasterThan = Math.max(0, Math.round((slower / rows.length) * 100));
  const rank = rows.findIndex((row) => row.runtimeMs >= runtimeMs) + 1;
  const memoryBetterThan =
    memoryKb && memoryKb > 0
      ? Math.max(0, Math.round((rows.filter((row) => row.memoryKb >= memoryKb).length / rows.length) * 100))
      : 0;

  return {
    rankLabel: rank > 0 ? `~#${rank}` : "Unranked",
    fasterThanLabel: `${fasterThan}%`,
    memoryBetterThanLabel: memoryKb && memoryKb > 0 ? `${memoryBetterThan}%` : "-",
    total: rows.length
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function CodeCompare({ current, previous }: { current: string; previous: string }) {
  const currentLines = current.split("\n");
  const previousLines = previous.split("\n");
  const max = Math.max(currentLines.length, previousLines.length);
  const rows = [];

  for (let i = 0; i < max; i += 1) {
    const before = previousLines[i] ?? "";
    const after = currentLines[i] ?? "";
    rows.push({ line: i + 1, before, after, changed: before !== after });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
      <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5">
        <div className="px-3 py-2">Previous</div>
        <div className="border-l border-slate-200 px-3 py-2 dark:border-white/10">Current</div>
      </div>
      <div className="max-h-[60vh] overflow-auto font-mono text-xs">
        {rows.map((row) => (
          <div
            key={row.line}
            className={`grid grid-cols-2 ${
              row.changed ? "bg-amber-50/70 dark:bg-amber-950/20" : "bg-white dark:bg-transparent"
            }`}
          >
            <pre className="border-b border-slate-100 px-3 py-1 dark:border-white/5">
              <span className="mr-3 select-none text-slate-400">{row.line}</span>
              {row.before || " "}
            </pre>
            <pre className="border-b border-l border-slate-100 px-3 py-1 dark:border-white/5">
              <span className="mr-3 select-none text-slate-400">{row.line}</span>
              {row.after || " "}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function Block({ title, value }: { title: string; value: string }) {
  const display = value || "No data";
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <pre className="mt-2 max-h-28 overflow-auto font-mono text-[13px] text-slate-800 dark:text-slate-200">
        {display}
      </pre>
    </div>
  );
}
