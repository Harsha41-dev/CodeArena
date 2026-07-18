import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { submissionsApi } from "../services/api";
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

  return (
    <div className="space-y-4">
      <section className="ca-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Submission {shortId}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {problemTitle} • {languageLabel}
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
