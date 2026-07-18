import type { Executor, ExecutionRequest, ExecutionResult } from "./Executor";
import { env } from "../config/env";
import { logger } from "../config/logger";

interface Judge0Response {
  token?: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: {
    id: number;
    description: string;
  };
}

export class Judge0Executor implements Executor {
  constructor() {
    // warn early if misconfigured
    if (env.EXECUTOR_MODE === "judge0" && !env.JUDGE0_BASE_URL) {
      logger.error("EXECUTOR_MODE=judge0 but JUDGE0_BASE_URL is not configured");
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const judge0Id = request.profile?.judge0Id;

    // need a language id for judge0
    if (!judge0Id) {
      return {
        status: "INTERNAL_ERROR",
        stdout: "",
        stderr: `${request.language} does not have a Judge0 language id configured`,
        runtimeMs: 0,
        memoryKb: 0
      };
    }

    if (!env.JUDGE0_BASE_URL) {
      logger.error({ language: request.language }, "Judge0 executor is not configured");
      return {
        status: "INTERNAL_ERROR",
        stdout: "",
        stderr: "JUDGE0_BASE_URL is not configured",
        runtimeMs: 0,
        memoryKb: 0
      };
    }

    try {
      // time limit in seconds (at least 1)
      const cpuTimeLimit = Math.max(1, Math.ceil(request.timeLimitMs / 1000));
      // memory in KB
      const memoryLimit = request.memoryLimitMb * 1024;

      const createUrl = `${env.JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`;

      const createResponse = await fetchWithTimeout(
        createUrl,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({
            language_id: judge0Id,
            source_code: request.sourceCode,
            stdin: request.stdin,
            cpu_time_limit: cpuTimeLimit,
            memory_limit: memoryLimit
          })
        },
        10_000
      );

      if (!createResponse.ok) {
        logger.error({ status: createResponse.status, language: request.language }, "Judge0 submission request failed");
        return internalJudge0Error(`Judge0 request failed with ${createResponse.status}`);
      }

      const created = (await createResponse.json()) as Judge0Response;

      // poll until done if we got a token
      let payload: Judge0Response;
      if (created.token) {
        const pollTimeout = Math.max(request.timeLimitMs + 5_000, 10_000);
        payload = await this.poll(created.token, pollTimeout);
      } else {
        // maybe wait=true style response already has the result
        payload = created;
      }

      const status = this.mapStatus(payload.status?.id, payload.status?.description);

      // pick the best diagnostic string
      let stderrValue: string | undefined;
      if (payload.stderr != null) {
        stderrValue = safeJudge0Diagnostic(payload.stderr);
      } else if (payload.message != null) {
        stderrValue = safeJudge0Diagnostic(payload.message);
      } else if (status !== "ACCEPTED") {
        stderrValue = safeJudge0Diagnostic(payload.status?.description);
      } else {
        stderrValue = undefined;
      }

      // judge0 time is in seconds
      const timeSeconds = Number(payload.time ?? 0);
      const runtimeMs = Math.round(timeSeconds * 1000);

      let memoryKb = 0;
      if (payload.memory != null) {
        memoryKb = payload.memory;
      }

      return {
        status,
        stdout: payload.stdout ?? "",
        stderr: stderrValue,
        compileOutput: safeJudge0Diagnostic(payload.compile_output),
        runtimeMs,
        memoryKb
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : error;
      logger.error({ err: errMsg, language: request.language }, "Judge0 execution failed");

      let stderr = "Judge0 execution failed";
      if (error instanceof Judge0PollingTimeout) {
        stderr = "Judge0 polling timed out";
      }

      return {
        status: "INTERNAL_ERROR",
        stdout: "",
        stderr,
        runtimeMs: 0,
        memoryKb: 0
      };
    }
  }

  private async poll(token: string, timeoutMs: number): Promise<Judge0Response> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const pollUrl = `${env.JUDGE0_BASE_URL}/submissions/${encodeURIComponent(token)}?base64_encoded=false`;

      const response = await fetchWithTimeout(
        pollUrl,
        {
          headers: this.headers()
        },
        5_000
      );

      if (!response.ok) {
        logger.error({ status: response.status }, "Judge0 polling request failed");
        throw new Error("Judge0 polling request failed");
      }

      const payload = (await response.json()) as Judge0Response;

      // 1 = In Queue, 2 = Processing - keep waiting
      const statusId = payload.status?.id;
      if (statusId !== 1 && statusId !== 2) {
        return payload;
      }

      // wait a bit before next poll
      await sleep(500);
    }

    throw new Judge0PollingTimeout();
  }

  private headers() {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    // rapidapi key if set
    if (env.JUDGE0_API_KEY) {
      headers["x-rapidapi-key"] = env.JUDGE0_API_KEY;
    }

    return headers;
  }

  // map judge0 status ids to our status strings
  private mapStatus(statusId?: number, description?: string): ExecutionResult["status"] {
    // memory check first (description based)
    if (/memory/i.test(description ?? "")) {
      return "MEMORY_LIMIT_EXCEEDED";
    }

    if (statusId === 3) {
      return "ACCEPTED";
    }
    if (statusId === 4) {
      return "WRONG_ANSWER";
    }
    if (statusId === 5) {
      return "TIME_LIMIT_EXCEEDED";
    }
    if (statusId === 6) {
      return "COMPILATION_ERROR";
    }

    // 7-12 are various runtime errors
    if (statusId === 7 || statusId === 8 || statusId === 9 || statusId === 10 || statusId === 11 || statusId === 12) {
      return "RUNTIME_ERROR";
    }

    if (statusId === 13) {
      return "INTERNAL_ERROR";
    }

    // unknown status
    return "INTERNAL_ERROR";
  }
}

class Judge0PollingTimeout extends Error {
  constructor() {
    super("Judge0 polling timed out");
  }
}

function internalJudge0Error(stderr: string): ExecutionResult {
  return {
    status: "INTERNAL_ERROR",
    stdout: "",
    stderr,
    runtimeMs: 0,
    memoryKb: 0
  };
}

// trim and cap length so we don't store huge stderr
function safeJudge0Diagnostic(value?: string | null): string | undefined {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  // max 1000 chars
  if (trimmed.length > 1000) {
    return trimmed.slice(0, 1_000);
  }
  return trimmed;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
