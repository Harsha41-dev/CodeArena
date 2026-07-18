import { useEffect, useState } from "react";
import { API_BASE_URL } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import type { SubmissionStatusEvent } from "../types/api";
import { isTerminalSubmissionStatus } from "../lib/status";

export type SubmissionEventConnectionState = "idle" | "connecting" | "connected" | "fallback" | "closed";

// live updates via SSE; if stream dies UI should fall back to polling
export function useSubmissionEvents(submissionId: string | null | undefined, enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [event, setEvent] = useState<SubmissionStatusEvent | null>(null);
  const [connectionState, setConnectionState] = useState<SubmissionEventConnectionState>("idle");

  useEffect(() => {
    setEvent(null);

    if (!enabled || !submissionId) {
      setConnectionState("idle");
      return;
    }

    if (!accessToken) {
      // not logged in properly — let the page poll instead
      setConnectionState("fallback");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let gotTerminal = false;
    setConnectionState("connecting");

    async function connect() {
      try {
        const url = `${API_BASE_URL}/submissions/${submissionId}/events`;
        const response = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${accessToken}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Live submission updates unavailable");
        }
        if (!response.body) {
          throw new Error("Live submission updates unavailable");
        }

        setConnectionState("connected");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }

          buffer += decoder.decode(chunk.value, { stream: true });

          // SSE events are separated by blank lines
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() ?? "";

          for (let i = 0; i < parts.length; i++) {
            const nextEvent = parseSubmissionEvent(parts[i]);
            if (!nextEvent) {
              continue;
            }

            setEvent(nextEvent);

            if (isTerminalSubmissionStatus(nextEvent.status)) {
              gotTerminal = true;
              setConnectionState("closed");
              controller.abort();
              return;
            }
          }
        }

        if (!cancelled) {
          if (gotTerminal) {
            setConnectionState("closed");
          } else {
            setConnectionState("fallback");
          }
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setConnectionState("fallback");
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accessToken, enabled, submissionId]);

  return {
    event,
    connectionState,
    isPollingFallback: connectionState === "fallback"
  };
}

function parseSubmissionEvent(chunk: string): SubmissionStatusEvent | null {
  const lines = chunk.split(/\r?\n/);
  const dataLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const data = dataLines.join("\n");
  if (!data || data === "{}") {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as Partial<SubmissionStatusEvent>;
    if (!parsed.submissionId || !parsed.status) {
      return null;
    }
    return parsed as SubmissionStatusEvent;
  } catch {
    return null;
  }
}
