import { CheckCircle2, Loader2, Radio, WifiOff } from "lucide-react";
import type { SubmissionEventConnectionState } from "../hooks/useSubmissionEvents";
import { formatStatus, isTerminalSubmissionStatus } from "../lib/status";
import type { SubmissionStatus, SubmissionStatusEvent } from "../types/api";
import { VerdictBadge } from "./VerdictBadge";

interface SubmissionLiveStatusBannerProps {
  event?: SubmissionStatusEvent | null;
  status?: SubmissionStatus | null;
  connectionState: SubmissionEventConnectionState;
}

export function SubmissionLiveStatusBanner({ event, status, connectionState }: SubmissionLiveStatusBannerProps) {
  // prefer live event status, fall back to last known submission status
  const activeStatus = event?.status ?? status ?? null;

  // nothing to show yet
  if (!activeStatus && connectionState === "idle") {
    return null;
  }

  const terminal = isTerminalSubmissionStatus(activeStatus);
  const fallback = connectionState === "fallback";

  // pick a human-readable title based on connection + status
  let title = "Connecting to judge...";
  if (fallback) {
    title = "Live updates unavailable, using polling fallback";
  } else if (connectionState === "connecting") {
    title = "Connecting to judge...";
  } else if (activeStatus === "PENDING") {
    title = "Waiting in queue...";
  } else if (activeStatus === "RUNNING") {
    title = "Running test cases...";
  } else if (terminal) {
    title = "Final result available";
  }

  const isPending = connectionState === "connecting" || activeStatus === "PENDING" || activeStatus === "RUNNING";

  // icon depends on state
  let Icon = Radio;
  if (fallback) {
    Icon = WifiOff;
  } else if (terminal) {
    Icon = CheckCircle2;
  } else if (isPending) {
    Icon = Loader2;
  }

  let statusLine = "Preparing live verdict stream";
  if (activeStatus) {
    statusLine = formatStatus(activeStatus);
  }
  if (event) {
    statusLine = `${statusLine} - ${event.passedTestCases}/${event.totalTestCases} test cases passed`;
  }

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-950 dark:bg-sky-950 dark:text-sky-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${isPending ? "animate-spin" : ""}`} />
          <div>
            <p className="font-medium">{title}</p>
            <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-300">{statusLine}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeStatus ? <VerdictBadge status={activeStatus} /> : null}
          {event?.runtime !== null && event?.runtime !== undefined ? <span>{event.runtime} ms</span> : null}
          {event?.memory !== null && event?.memory !== undefined ? <span>{event.memory} KB</span> : null}
        </div>
      </div>
    </div>
  );
}
