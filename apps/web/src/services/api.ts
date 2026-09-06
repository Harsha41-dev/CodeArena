import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type {
  AbuseAnalytics,
  ApiResponse,
  AdminAuditLog,
  AuthResult,
  BadgeDefinition,
  BackupRun,
  Bookmark,
  CheckerMode,
  CheckerPreviewResult,
  CodeLanguage,
  CodeLanguageVersion,
  Company,
  Contest,
  ContestAnnouncement,
  ContestRatingJob,
  CustomRunResult,
  DailyChallenge,
  Discussion,
  Editorial,
  ExecutorCapabilityResponse,
  ExecutorHealthResponse,
  FollowStatus,
  GeneratedTestCaseBatch,
  GenerationPreview,
  HealthCheckSnapshot,
  LearningCollection,
  LeaderboardRow,
  ModerationStatus,
  MonitoringAlert,
  Notification,
  PracticeOutcome,
  PracticeSession,
  PracticeSessionType,
  Problem,
  ProblemAsset,
  ProblemAssetType,
  ProblemLanguageOption,
  ProblemRecommendation,
  ProblemLeaderboardRow,
  ProblemSetDetail,
  ProblemSetSummary,
  ProductionStatus,
  PublicUserProfile,
  RatingEvent,
  Report,
  ReportTargetType,
  RevisionQueue,
  RunResult,
  Solution,
  SolutionVisibility,
  StudyPlanDetail,
  StudyPlanSummary,
  Submission,
  TestCase,
  TestCaseGenerationJob,
  UserRating,
  User,
  UserBadge,
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
  companies?: Array<{
    companyId?: string;
    name?: string;
    slug?: string;
    frequency?: number;
    isFeatured?: boolean;
  }>;
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

export interface CreateSolutionPayload {
  submissionId?: string | null;
  title: string;
  content: string;
  code?: string;
  language?: string;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  visibility?: SolutionVisibility;
}

export type UpdateSolutionPayload = Partial<
  Pick<
    Solution,
    "title" | "content" | "code" | "language" | "timeComplexity" | "spaceComplexity" | "visibility" | "isPinned"
  >
>;

export interface LearningCollectionPayload {
  slug: string;
  title: string;
  description: string;
  badge?: string | null;
  dailyUnlockCount?: number;
  visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
}

export interface EditorialPayload {
  title: string;
  content: string;
  isPublished?: boolean;
  structure?: {
    sections?: Array<{
      type?: "TEXT" | "HINT" | "SOLUTION" | "COMPLEXITY" | "DIAGRAM";
      title: string;
      content: string;
      language?: string | null;
      order?: number;
      isLocked?: boolean;
    }>;
    officialSolutions?: Array<{
      language: string;
      code: string;
      explanation?: string | null;
      timeComplexity?: string | null;
      spaceComplexity?: string | null;
      order?: number;
    }>;
  };
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
  dailyChallenge: () => unwrap<DailyChallenge>(api.get("/daily-challenge")),
  problemSets: () => unwrap<ProblemSetSummary[]>(api.get("/problem-sets")),
  problemSet: (slug: string) => unwrap<ProblemSetDetail>(api.get(`/problem-sets/${slug}`)),
  nextRecommendation: () => unwrap<ProblemRecommendation>(api.get("/recommendations/next")),
  studyPlans: () => unwrap<StudyPlanSummary[]>(api.get("/study-plans")),
  studyPlan: (slug: string) => unwrap<StudyPlanDetail>(api.get(`/study-plans/${slug}`)),
  revisionQueue: () => unwrap<RevisionQueue>(api.get("/revision-queue")),
  languages: (slug: string) => unwrap<ProblemLanguageOption[]>(api.get(`/problems/${slug}/languages`)),
  tags: () => unwrap<Array<{ id: string; name: string; slug: string }>>(api.get("/tags")),
  companies: () => unwrap<Company[]>(api.get("/companies")),
  create: (payload: CreateProblemPayload) => unwrap<Problem>(api.post("/problems", payload)),
  addTestCase: (problemId: string, payload: CreateTestCasePayload) =>
    unwrap<TestCase>(api.post(`/problems/${problemId}/testcases`, payload)),
  editorial: (slug: string, includeDraft = false) =>
    unwrap<Editorial | null>(
      api.get(`/problems/${slug}/editorial`, { params: includeDraft ? { includeDraft: "true" } : undefined })
    ),
  discussions: (slug: string, sort?: "newest" | "top" | "unanswered") =>
    unwrap<Discussion[]>(api.get(`/problems/${slug}/discussions`, { params: sort ? { sort } : undefined }))
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
  testCaseId?: string;
  contestId?: string;
}

export const submissionsApi = {
  run: (payload: SubmissionLanguagePayload) => unwrap<RunResult>(api.post("/run", payload)),
  runCustom: (payload: SubmissionLanguagePayload & { problemId: string; input: string }) =>
    unwrap<CustomRunResult>(api.post("/run/custom", payload)),
  submit: (payload: SubmissionLanguagePayload) =>
    unwrap<{ submissionId: string; status: string; queuePosition?: number }>(
      api.post(payload.contestId ? `/contests/${payload.contestId}/submit` : "/submit", payload)
    ),
  get: (id: string) => unwrap<Submission>(api.get(`/submissions/${id}`)),
  list: (params?: Record<string, string>) => unwrap<Submission[]>(api.get("/submissions", { params }))
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
  problem: (slug: string) => unwrap<ProblemLeaderboardRow[]>(api.get(`/problems/${slug}/leaderboard`))
};

export const solutionsApi = {
  listProblem: (slug: string, params?: Record<string, string>) =>
    unwrap<Solution[]>(api.get(`/problems/${slug}/solutions`, { params })),
  get: (id: string) => unwrap<Solution>(api.get(`/solutions/${id}`)),
  create: (slug: string, payload: CreateSolutionPayload) =>
    unwrap<Solution>(api.post(`/problems/${slug}/solutions`, payload)),
  update: (id: string, payload: UpdateSolutionPayload) => unwrap<Solution>(api.patch(`/solutions/${id}`, payload)),
  delete: (id: string) => unwrap(api.delete(`/solutions/${id}`)),
  vote: (id: string, value: 1 | -1) => unwrap(api.post(`/solutions/${id}/vote`, { value }))
};

export const contestsApi = {
  list: () => unwrap<Contest[]>(api.get("/contests")),
  get: (id: string) => unwrap<Contest>(api.get(`/contests/${id}`)),
  register: (id: string) => unwrap(api.post(`/contests/${id}/register`)),
  leaderboard: (id: string) => unwrap<LeaderboardRow[]>(api.get(`/contests/${id}/leaderboard`)),
  announcements: (id: string) => unwrap<ContestAnnouncement[]>(api.get(`/contests/${id}/announcements`)),
  discussions: (id: string, sort?: "newest" | "top" | "unanswered") =>
    unwrap<Discussion[]>(api.get(`/contests/${id}/discussions`, { params: sort ? { sort } : undefined })),
  createDiscussion: (id: string, payload: { title: string; content: string }) =>
    unwrap<Discussion>(api.post(`/contests/${id}/discussions`, payload))
};

export const usersApi = {
  get: (username: string) => unwrap<PublicUserProfile>(api.get(`/users/${username}`)),
  stats: (username: string) => unwrap<UserStats>(api.get(`/users/${username}/stats`)),
  badges: (username: string) => unwrap<UserBadge[]>(api.get(`/users/${username}/badges`)),
  followStatus: (username: string) => unwrap<FollowStatus>(api.get(`/users/${username}/follow-status`)),
  follow: (username: string) => unwrap<{ following: boolean }>(api.post(`/users/${username}/follow`)),
  unfollow: (username: string) => unwrap<{ following: boolean }>(api.delete(`/users/${username}/follow`)),
  followers: (username: string, params?: Record<string, string>) =>
    unwrap<PublicUserProfile[]>(api.get(`/users/${username}/followers`, { params })),
  following: (username: string, params?: Record<string, string>) =>
    unwrap<PublicUserProfile[]>(api.get(`/users/${username}/following`, { params })),
  updateMe: (payload: {
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    country?: string | null;
    countryCode?: string | null;
  }) => unwrap<User>(api.patch("/users/me", payload))
};

export const reportsApi = {
  create: (payload: { targetType: ReportTargetType; targetId: string; reason: string; details?: string | null }) =>
    unwrap<Report>(api.post("/reports", payload))
};

export const notificationsApi = {
  list: (params?: Record<string, string>) => unwrap<Notification[]>(api.get("/notifications", { params })),
  markRead: (id: string) => unwrap<Notification>(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap<{ updated: number }>(api.patch("/notifications/read-all"))
};

export const ratingsApi = {
  leaderboard: (params?: Record<string, string>) => unwrap<UserRating[]>(api.get("/ratings", { params })),
  history: (username: string, params?: Record<string, string>) =>
    unwrap<RatingEvent[]>(api.get(`/users/${username}/ratings`, { params }))
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
  markCommentHelpful: (id: string) => unwrap(api.post(`/discussion-comments/${id}/helpful`)),
  unmarkCommentHelpful: (id: string) => unwrap(api.delete(`/discussion-comments/${id}/helpful`)),
  acceptAnswer: (id: string, commentId: string) =>
    unwrap(api.patch(`/discussions/${id}/accepted-answer`, { commentId })),
  addBookmark: (slug: string) => unwrap(api.post(`/problems/${slug}/bookmark`)),
  removeBookmark: (slug: string) => unwrap(api.delete(`/problems/${slug}/bookmark`)),
  bookmarks: () => unwrap<Bookmark[]>(api.get("/bookmarks")),
  getNote: (slug: string) => unwrap<{ id: string; content: string } | null>(api.get(`/problems/${slug}/notes`)),
  saveNote: (slug: string, content: string) =>
    unwrap<{ id: string; content: string }>(api.post(`/problems/${slug}/notes`, { content }))
};

export const practiceApi = {
  start: (payload: {
    type: PracticeSessionType;
    title?: string;
    durationSeconds?: number;
    problemIds?: string[];
    difficulty?: Problem["difficulty"];
    topic?: string;
    company?: string;
    count?: number;
    settings?: Record<string, unknown> | null;
  }) => unwrap<PracticeSession>(api.post("/practice/sessions", payload)),
  list: (params?: Record<string, string>) => unwrap<PracticeSession[]>(api.get("/practice/sessions", { params })),
  get: (id: string) => unwrap<PracticeSession>(api.get(`/practice/sessions/${id}`)),
  updateProblem: (
    sessionId: string,
    itemId: string,
    payload: { outcome?: PracticeOutcome | null; secondsSpent?: number | null; submissionId?: string | null }
  ) => unwrap(api.patch(`/practice/sessions/${sessionId}/problems/${itemId}`, payload)),
  finish: (id: string, summary?: Record<string, unknown> | null) =>
    unwrap<PracticeSession>(api.post(`/practice/sessions/${id}/finish`, summary ? { summary } : {})),
  cancel: (id: string) => unwrap<PracticeSession>(api.post(`/practice/sessions/${id}/cancel`))
};

export const adminApi = {
  problems: (params?: Record<string, string>) => unwrap<Problem[]>(api.get("/admin/problems", { params })),
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
    freezeStartsAt?: string | null;
    isRated?: boolean;
    ratingSeason?: string | null;
    ratingScheduledAt?: string | null;
  }) => unwrap<Contest>(api.post("/admin/contests", payload)),
  updateContest: (
    id: string,
    payload: Partial<
      Pick<
        Contest,
        | "title"
        | "slug"
        | "description"
        | "startTime"
        | "endTime"
        | "status"
        | "visibility"
        | "freezeStartsAt"
        | "isRated"
        | "ratingSeason"
        | "ratingScheduledAt"
      >
    >
  ) => unwrap<Contest>(api.patch(`/admin/contests/${id}`, payload)),
  deleteContest: (id: string) => unwrap(api.delete(`/admin/contests/${id}`)),
  addContestProblem: (id: string, payload: { problemId: string; points?: number }) =>
    unwrap(api.post(`/admin/contests/${id}/problems`, payload)),
  removeContestProblem: (id: string, problemId: string) =>
    unwrap(api.delete(`/admin/contests/${id}/problems/${problemId}`)),
  createContestAnnouncement: (id: string, payload: { title: string; content: string }) =>
    unwrap(api.post(`/admin/contests/${id}/announcements`, payload)),
  upsertEditorial: (problemId: string, payload: EditorialPayload) =>
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
    unwrap(api.patch(`/admin/problems/${problemId}/starter-code/${starterCodeId}`, { code })),
  rejudgeSubmission: (submissionId: string) =>
    unwrap<{ submissionId: string; status: string }>(api.post(`/admin/submissions/${submissionId}/rejudge`)),
  rejudgeSubmissions: (payload: {
    problemSlug?: string;
    status?: Submission["status"];
    language?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) => unwrap<{ queued: number; submissionIds: string[] }>(api.post("/admin/submissions/rejudge", payload)),
  reports: (params?: { status?: ModerationStatus; targetType?: ReportTargetType; limit?: string; page?: string }) =>
    unwrap<Report[]>(api.get("/admin/reports", { params })),
  updateReport: (id: string, payload: { status?: ModerationStatus; resolution?: string | null }) =>
    unwrap<Report>(api.patch(`/admin/reports/${id}`, payload)),
  auditLogs: (params?: Record<string, string>) => unwrap<AdminAuditLog[]>(api.get("/admin/audit-logs", { params })),
  abuseAnalytics: (hours = 24) => unwrap<AbuseAnalytics>(api.get("/admin/analytics/abuse", { params: { hours } })),
  backups: (params?: Record<string, string>) => unwrap<BackupRun[]>(api.get("/admin/backups", { params })),
  createBackup: () => unwrap<BackupRun>(api.post("/admin/backups")),
  productionStatus: () => unwrap<ProductionStatus>(api.get("/admin/monitoring/status")),
  snapshotHealth: () => unwrap<HealthCheckSnapshot>(api.post("/admin/monitoring/snapshots")),
  healthSnapshots: (params?: Record<string, string>) =>
    unwrap<HealthCheckSnapshot[]>(api.get("/admin/monitoring/snapshots", { params })),
  monitoringAlerts: (params?: Record<string, string>) =>
    unwrap<MonitoringAlert[]>(api.get("/admin/monitoring/alerts", { params })),
  acknowledgeAlert: (id: string) => unwrap<MonitoringAlert>(api.patch(`/admin/monitoring/alerts/${id}/acknowledge`)),
  resolveAlert: (id: string) => unwrap<MonitoringAlert>(api.patch(`/admin/monitoring/alerts/${id}/resolve`)),
  rateContest: (contestId: string) => unwrap<RatingEvent[]>(api.post(`/admin/contests/${contestId}/rate`)),
  rollbackContestRatings: (contestId: string) =>
    unwrap<{ contestId: string; deletedEvents: number; resetUsers: UserRating[] }>(
      api.post(`/admin/contests/${contestId}/ratings/rollback`)
    ),
  scheduleRatingJob: (contestId: string, scheduledAt?: string | null) =>
    unwrap<ContestRatingJob>(api.post(`/admin/contests/${contestId}/rating-jobs`, { scheduledAt })),
  ratingJobs: (params?: Record<string, string>) => unwrap<ContestRatingJob[]>(api.get("/admin/ratings/jobs", { params })),
  processRatingJobs: () => unwrap<{ processed: unknown[] }>(api.post("/admin/ratings/jobs/process")),
  ratings: (params?: Record<string, string>) => unwrap<UserRating[]>(api.get("/ratings", { params })),
  problemSets: (params?: Record<string, string>) =>
    unwrap<LearningCollection[]>(api.get("/admin/problem-sets", { params })),
  createProblemSet: (payload: LearningCollectionPayload) =>
    unwrap<LearningCollection>(api.post("/admin/problem-sets", payload)),
  studyPlans: (params?: Record<string, string>) =>
    unwrap<LearningCollection[]>(api.get("/admin/study-plans", { params })),
  createStudyPlan: (payload: LearningCollectionPayload) =>
    unwrap<LearningCollection>(api.post("/admin/study-plans", payload)),
  updateLearningCollection: (id: string, payload: Partial<LearningCollectionPayload>) =>
    unwrap<LearningCollection>(api.patch(`/admin/learning-collections/${id}`, payload)),
  deleteLearningCollection: (id: string) => unwrap(api.delete(`/admin/learning-collections/${id}`)),
  setLearningCollectionItems: (
    id: string,
    items: Array<{ problemId: string; order?: number; note?: string | null }>
  ) => unwrap(api.put(`/admin/learning-collections/${id}/items`, { items })),
  dailyChallenges: (params?: Record<string, string>) =>
    unwrap<DailyChallenge[]>(api.get("/admin/daily-challenges", { params })),
  upsertDailyChallenge: (date: string, payload: { problemId: string; rewardXp?: number }) =>
    unwrap(api.put(`/admin/daily-challenges/${date}`, payload)),
  badgeDefinitions: (includeInactive = true) =>
    unwrap<BadgeDefinition[]>(api.get("/admin/badges", { params: { includeInactive: String(includeInactive) } })),
  createBadgeDefinition: (payload: {
    key: string;
    name: string;
    description: string;
    icon?: string | null;
    triggerType: string;
    triggerValue?: number;
    isActive?: boolean;
  }) => unwrap<BadgeDefinition>(api.post("/admin/badges", payload)),
  updateBadgeDefinition: (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      icon: string | null;
      triggerType: string;
      triggerValue: number;
      isActive: boolean;
    }>
  ) => unwrap<BadgeDefinition>(api.patch(`/admin/badges/${id}`, payload))
};
