import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type {
  ApiResponse,
  AuthResult,
  Bookmark,
  CheckerMode,
  CheckerPreviewResult,
  CodeLanguage,
  CodeLanguageVersion,
  Contest,
  CustomRunResult,
  Discussion,
  Editorial,
  ExecutorCapabilityResponse,
  ExecutorHealthResponse,
  GeneratedTestCaseBatch,
  GenerationPreview,
  LeaderboardRow,
  Problem,
  ProblemAsset,
  ProblemAssetType,
  ProblemLanguageOption,
  RunResult,
  Submission,
  TestCase,
  TestCaseGenerationJob,
  User,
  UserStats
} from "../types/api";
import { useAuthStore } from "../stores/authStore";

export interface CreateProblemPayload {
  slug?: string;
  title?: string;
  difficulty?: Problem["difficulty"];
  description?: string;
  constraints?: string;
  inputFormat?: string;
  outputFormat?: string;
  starterCode?: Problem["starterCode"];
  tags: string[];
  visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  checkerMode?: CheckerMode;
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

export type CreateTestCasePayload = Omit<TestCase, "id"> & { order?: number; isStrict?: boolean };

export interface ProblemAssetPayload {
  type: ProblemAssetType;
  languageId?: string;
  languageVersionId?: string;
  languageKey?: string;
  version?: string;
  filename: string;
  sourceCode: string;
}

export interface TestGenerationJobPayload {
  batchName: string;
  description?: string;
  visibility: "SAMPLE" | "HIDDEN";
  count?: number;
  seedStart?: number;
  seedEnd?: number;
  inputMode?: "STDIN";
  replaceExistingGenerated?: boolean;
  runValidator?: boolean;
  allowEmptyInput?: boolean;
  allowEmptyOutput?: boolean;
  skipDuplicates?: boolean;
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL
});

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// share one in-flight refresh so parallel 401s don't stampede
let refreshPromise: Promise<AuthResult> | null = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    const isLogin = url.includes("/auth/login");
    const isRegister = url.includes("/auth/register");
    const isRefresh = url.includes("/auth/refresh");
    const isAuthRoute = isLogin || isRegister || isRefresh;

    const refreshToken = useAuthStore.getState().refreshToken;

    // only try silent refresh on 401 for protected routes
    if (status !== 401 || !original || original._retry || isAuthRoute || !refreshToken) {
      if (status === 401 && !isAuthRoute) {
        useAuthStore.getState().logout();
      }
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post<ApiResponse<AuthResult>>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
          .then((response) => response.data.data)
          .finally(() => {
            refreshPromise = null;
          });
      }

      const auth = await refreshPromise;
      useAuthStore.getState().setAuth(auth);
      original.headers.Authorization = `Bearer ${auth.tokens.accessToken}`;
      return api(original);
    } catch {
      useAuthStore.getState().logout();
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
  }
);

// pull `data` out of the standard { success, message, data } envelope
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const response = await promise;
    const body = response.data;
    return body.data;
  } catch (err) {
    const message = getApiErrorMessage(err);
    throw new Error(message);
  }
}

// try to get a readable message out of axios / zod / plain errors
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          error?: { details?: { issues?: Array<{ path: string; message: string }> } };
        }
      | undefined;

    // show first zod validation issue if backend sent one
    const issues = data?.error?.details?.issues;
    if (issues && issues.length > 0) {
      const first = issues[0];
      return first.path + ": " + first.message;
    }

    if (data && data.message) {
      return data.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export const authApi = {
  login: (email: string, password: string) => unwrap<AuthResult>(api.post("/auth/login", { email, password })),
  register: (payload: { email: string; username: string; displayName: string; password: string }) =>
    unwrap<AuthResult>(api.post("/auth/register", payload)),
  me: () => unwrap<User>(api.get("/auth/me"))
};

export const problemsApi = {
  list: (params?: Record<string, string>) => unwrap<Problem[]>(api.get("/problems", { params })),
  get: (slug: string) => unwrap<Problem>(api.get(`/problems/${slug}`)),
  languages: (slug: string) => unwrap<ProblemLanguageOption[]>(api.get(`/problems/${slug}/languages`)),
  tags: () => unwrap<Array<{ id: string; name: string; slug: string }>>(api.get("/tags")),
  create: (payload: CreateProblemPayload) => unwrap<Problem>(api.post("/problems", payload)),
  addTestCase: (problemId: string, payload: CreateTestCasePayload) =>
    unwrap<TestCase>(api.post(`/problems/${problemId}/testcases`, payload)),
  editorial: (slug: string, includeDraft = false) =>
    unwrap<Editorial | null>(
      api.get(`/problems/${slug}/editorial`, { params: includeDraft ? { includeDraft: "true" } : undefined })
    ),
  discussions: (slug: string) => unwrap<Discussion[]>(api.get(`/problems/${slug}/discussions`))
};

export interface SubmissionLanguagePayload {
  problemSlug?: string;
  problemId?: string;
  languageId?: string;
  languageVersionId?: string;
  languageKey?: string;
  version?: string;
  language?: string;
  code: string;
  input?: string;
  contestId?: string;
}

export const submissionsApi = {
  run: (payload: SubmissionLanguagePayload) => unwrap<RunResult>(api.post("/run", payload)),
  runCustom: (payload: SubmissionLanguagePayload & { problemId: string; input: string }) =>
    unwrap<CustomRunResult>(api.post("/run/custom", payload)),
  submit: (payload: SubmissionLanguagePayload) =>
    unwrap<{ submissionId: string; status: string }>(
      api.post(payload.contestId ? `/contests/${payload.contestId}/submit` : "/submit", payload)
    ),
  get: (id: string) => unwrap<Submission>(api.get(`/submissions/${id}`)),
  list: () => unwrap<Submission[]>(api.get("/submissions"))
};

export const languagesApi = {
  list: () => unwrap<CodeLanguage[]>(api.get("/languages")),
  get: (key: string) => unwrap<CodeLanguage>(api.get(`/languages/${key}`))
};

export const executorApi = {
  capabilities: (params?: { problemId?: string; problemSlug?: string }) =>
    unwrap<ExecutorCapabilityResponse>(api.get("/executor/capabilities", { params })),
  health: () => unwrap<ExecutorHealthResponse>(api.get("/executor/health"))
};

export const leaderboardApi = {
  global: () => unwrap<LeaderboardRow[]>(api.get("/leaderboard")),
  problem: (slug: string) => unwrap<LeaderboardRow[]>(api.get(`/problems/${slug}/leaderboard`))
};

export const contestsApi = {
  list: () => unwrap<Contest[]>(api.get("/contests")),
  get: (id: string) => unwrap<Contest>(api.get(`/contests/${id}`)),
  register: (id: string) => unwrap(api.post(`/contests/${id}/register`)),
  leaderboard: (id: string) => unwrap<LeaderboardRow[]>(api.get(`/contests/${id}/leaderboard`))
};

export const usersApi = {
  stats: (username: string) => unwrap<UserStats>(api.get(`/users/${username}/stats`)),
  updateMe: (payload: {
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    country?: string | null;
    countryCode?: string | null;
  }) => unwrap<User>(api.patch("/users/me", payload))
};

export const socialApi = {
  listDiscussions: (params?: Record<string, string>) => unwrap<Discussion[]>(api.get("/discussions", { params })),
  getDiscussion: (id: string) => unwrap<Discussion>(api.get(`/discussions/${id}`)),
  createGeneralDiscussion: (payload: { title: string; content: string; tags?: string[] }) =>
    unwrap<Discussion>(api.post("/discussions", payload)),
  createDiscussion: (slug: string, payload: { title: string; content: string }) =>
    unwrap<Discussion>(api.post(`/problems/${slug}/discussions`, payload)),
  updateDiscussion: (id: string, payload: { title?: string; content?: string; tags?: string[] }) =>
    unwrap<Discussion>(api.patch(`/discussions/${id}`, payload)),
  deleteDiscussion: (id: string) => unwrap(api.delete(`/discussions/${id}`)),
  addComment: (id: string, content: string) => unwrap(api.post(`/discussions/${id}/comments`, { content })),
  updateComment: (id: string, content: string) => unwrap(api.patch(`/discussion-comments/${id}`, { content })),
  deleteComment: (id: string) => unwrap(api.delete(`/discussion-comments/${id}`)),
  voteDiscussion: (id: string, value: 1 | -1) => unwrap(api.post(`/discussions/${id}/vote`, { value })),
  addBookmark: (slug: string) => unwrap(api.post(`/problems/${slug}/bookmark`)),
  removeBookmark: (slug: string) => unwrap(api.delete(`/problems/${slug}/bookmark`)),
  bookmarks: () => unwrap<Bookmark[]>(api.get("/bookmarks")),
  getNote: (slug: string) => unwrap<{ id: string; content: string } | null>(api.get(`/problems/${slug}/notes`)),
  saveNote: (slug: string, content: string) =>
    unwrap<{ id: string; content: string }>(api.post(`/problems/${slug}/notes`, { content }))
};

export const adminApi = {
  users: (params?: Record<string, string>) => unwrap<User[]>(api.get("/admin/users", { params })),
  updateUser: (
    id: string,
    payload: Partial<Pick<User, "displayName" | "bio" | "avatarUrl" | "country" | "countryCode">>
  ) => unwrap<User>(api.patch(`/admin/users/${id}`, payload)),
  updateUserRole: (id: string, role: User["role"]) => unwrap<User>(api.patch(`/admin/users/${id}/role`, { role })),
  updateUserStatus: (id: string, status: NonNullable<User["status"]>) =>
    unwrap<User>(api.patch(`/admin/users/${id}/status`, { status })),
  deleteUser: (id: string) => unwrap(api.delete(`/admin/users/${id}`)),
  contests: () => unwrap<Contest[]>(api.get("/admin/contests")),
  createContest: (payload: {
    title: string;
    slug: string;
    description: string;
    startTime: string;
    endTime: string;
    problemIds: string[];
    visibility?: Contest["visibility"];
  }) => unwrap<Contest>(api.post("/admin/contests", payload)),
  updateContest: (
    id: string,
    payload: Partial<
      Pick<Contest, "title" | "slug" | "description" | "startTime" | "endTime" | "status" | "visibility">
    >
  ) => unwrap<Contest>(api.patch(`/admin/contests/${id}`, payload)),
  deleteContest: (id: string) => unwrap(api.delete(`/admin/contests/${id}`)),
  addContestProblem: (id: string, payload: { problemId: string; points?: number }) =>
    unwrap(api.post(`/admin/contests/${id}/problems`, payload)),
  removeContestProblem: (id: string, problemId: string) =>
    unwrap(api.delete(`/admin/contests/${id}/problems/${problemId}`)),
  upsertEditorial: (problemId: string, payload: { title: string; content: string; isPublished?: boolean }) =>
    unwrap<Editorial>(api.post(`/admin/problems/${problemId}/editorial`, payload)),
  updateEditorial: (id: string, payload: { title?: string; content?: string }) =>
    unwrap<Editorial>(api.patch(`/admin/editorials/${id}`, payload)),
  publishEditorial: (id: string) => unwrap<Editorial>(api.patch(`/admin/editorials/${id}/publish`)),
  unpublishEditorial: (id: string) => unwrap<Editorial>(api.patch(`/admin/editorials/${id}/unpublish`)),
  snapshotLeaderboard: () => unwrap(api.post("/leaderboard/snapshot")),
  languages: () => unwrap<CodeLanguage[]>(api.get("/admin/languages")),
  createLanguage: (payload: Omit<CodeLanguage, "id" | "versions">) =>
    unwrap<CodeLanguage>(api.post("/admin/languages", payload)),
  updateLanguage: (id: string, payload: Partial<Omit<CodeLanguage, "id" | "versions">>) =>
    unwrap<CodeLanguage>(api.patch(`/admin/languages/${id}`, payload)),
  deleteLanguage: (id: string) => unwrap(api.delete(`/admin/languages/${id}`)),
  versions: (languageId: string) => unwrap<CodeLanguageVersion[]>(api.get(`/admin/languages/${languageId}/versions`)),
  createVersion: (
    languageId: string,
    payload: Partial<CodeLanguageVersion> & { version: string; label: string; sourceFileName: string }
  ) => unwrap<CodeLanguageVersion>(api.post(`/admin/languages/${languageId}/versions`, payload)),
  updateVersion: (id: string, payload: Partial<CodeLanguageVersion>) =>
    unwrap<CodeLanguageVersion>(api.patch(`/admin/language-versions/${id}`, payload)),
  deleteVersion: (id: string) => unwrap(api.delete(`/admin/language-versions/${id}`)),
  syncJudge0Languages: () =>
    unwrap<{ created: number; updated: number; skipped: number }>(api.post("/admin/languages/sync/judge0")),
  executorCapabilities: (params?: { problemId?: string; problemSlug?: string }) =>
    unwrap<ExecutorCapabilityResponse>(api.get("/admin/executor/capabilities", { params })),
  executorHealth: () => unwrap(api.get("/admin/executor/health")),
  judgeQueue: () => unwrap(api.get("/admin/judge/queue")),
  problemAssets: (problemId: string) => unwrap<ProblemAsset[]>(api.get(`/admin/problems/${problemId}/assets`)),
  createProblemAsset: (problemId: string, payload: ProblemAssetPayload) =>
    unwrap<ProblemAsset>(api.post(`/admin/problems/${problemId}/assets`, payload)),
  updateProblemAsset: (assetId: string, payload: Partial<ProblemAssetPayload> & { isActive?: boolean }) =>
    unwrap<ProblemAsset>(api.patch(`/admin/problem-assets/${assetId}`, payload)),
  deleteProblemAsset: (assetId: string) => unwrap(api.delete(`/admin/problem-assets/${assetId}`)),
  updateCheckerMode: (problemId: string, checkerMode: CheckerMode) =>
    unwrap<Problem>(api.patch(`/admin/problems/${problemId}/checker-mode`, { checkerMode })),
  previewChecker: (
    problemId: string,
    payload: {
      input: string;
      expectedOutput: string;
      actualOutput: string;
      timeLimitMs?: number;
      memoryLimitMb?: number;
    }
  ) => unwrap<CheckerPreviewResult>(api.post(`/admin/problems/${problemId}/checker/preview`, payload)),
  previewTestGeneration: (
    problemId: string,
    payload: { seed: number; runValidator?: boolean; timeLimitMs?: number; memoryLimitMb?: number }
  ) => unwrap<GenerationPreview>(api.post(`/admin/problems/${problemId}/test-generation/preview`, payload)),
  createTestGenerationJob: (problemId: string, payload: TestGenerationJobPayload) =>
    unwrap<TestCaseGenerationJob>(api.post(`/admin/problems/${problemId}/test-generation-jobs`, payload)),
  testGenerationJobs: (problemId: string) =>
    unwrap<TestCaseGenerationJob[]>(api.get(`/admin/problems/${problemId}/test-generation-jobs`)),
  testGenerationJob: (jobId: string) => unwrap<TestCaseGenerationJob>(api.get(`/admin/test-generation-jobs/${jobId}`)),
  cancelTestGenerationJob: (jobId: string) =>
    unwrap<TestCaseGenerationJob>(api.post(`/admin/test-generation-jobs/${jobId}/cancel`)),
  testcaseBatches: (problemId: string) =>
    unwrap<GeneratedTestCaseBatch[]>(api.get(`/admin/problems/${problemId}/testcase-batches`)),
  deleteTestcaseBatch: (batchId: string) => unwrap(api.delete(`/admin/testcase-batches/${batchId}`)),
  problemLanguages: (problemId: string) =>
    unwrap<ProblemLanguageOption[]>(api.get(`/admin/problems/${problemId}/languages`)),
  updateProblemLanguages: (
    problemId: string,
    languages: Array<{ languageId: string; languageVersionId?: string | null; isEnabled: boolean }>
  ) => unwrap(api.patch(`/admin/problems/${problemId}/languages`, { languages })),
  upsertProblemStarterCode: (
    problemId: string,
    payload: { languageId: string; languageVersionId?: string | null; code: string }
  ) => unwrap(api.post(`/admin/problems/${problemId}/starter-code`, payload)),
  updateProblemStarterCode: (problemId: string, starterCodeId: string, code: string) =>
    unwrap(api.patch(`/admin/problems/${problemId}/starter-code/${starterCodeId}`, { code }))
};
