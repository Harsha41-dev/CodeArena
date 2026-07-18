import { env } from "../config/env";

export interface Judge0HealthProbe {
  baseUrlConfigured: boolean;
  judge0Reachable: boolean;
  languagesCount?: number;
  message?: string;
}

// shared error text when Judge0 can't be reached
export function judge0UnavailableMessage(baseUrl = env.JUDGE0_BASE_URL): string {
  const urlPart = baseUrl ?? "the configured URL";
  return `Judge0 is not reachable at ${urlPart}. Start local Judge0 Docker services first.`;
}

// pings /languages to see if Judge0 is up
export async function checkJudge0Health(
  baseUrl = env.JUDGE0_BASE_URL,
  apiKey = env.JUDGE0_API_KEY,
  timeoutMs = 3_000
): Promise<Judge0HealthProbe> {
  if (!baseUrl) {
    return {
      baseUrlConfigured: false,
      judge0Reachable: false,
      message: "JUDGE0_BASE_URL is not configured. Set JUDGE0_BASE_URL=http://localhost:2358 for local Judge0."
    };
  }

  try {
    const url = `${trimTrailingSlash(baseUrl)}/languages`;

    let headers: Record<string, string> | undefined = undefined;
    if (apiKey) {
      headers = { "x-rapidapi-key": apiKey };
    }

    const response = await fetchWithTimeout(url, { headers }, timeoutMs);

    if (!response.ok) {
      return {
        baseUrlConfigured: true,
        judge0Reachable: false,
        message: judge0UnavailableMessage(baseUrl)
      };
    }

    const payload = (await response.json()) as unknown;

    let languagesCount: number | undefined = undefined;
    if (Array.isArray(payload)) {
      languagesCount = payload.length;
    }

    return {
      baseUrlConfigured: true,
      judge0Reachable: true,
      languagesCount
    };
  } catch {
    // network error / timeout / abort
    return {
      baseUrlConfigured: true,
      judge0Reachable: false,
      message: judge0UnavailableMessage(baseUrl)
    };
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

// fetch that aborts after timeoutMs so health checks don't hang forever
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
