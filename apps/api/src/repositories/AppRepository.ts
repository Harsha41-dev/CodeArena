import type {
  Bookmark,
  Contest,
  ContestProblem,
  ContestRegistration,
  ContestSubmission,
  CheckerMode,
  Difficulty,
  Discussion,
  DiscussionComment,
  DiscussionVote,
  Editorial,
  GeneratedTestCaseBatch,
  GenerationJobStatus,
  LegacyLanguage,
  Note,
  Page,
  Problem,
  ProblemAsset,
  ProblemAssetType,
  ProblemList,
  ProblemListItem,
  ProblemSolvedStatus,
  ProblemStatus,
  ProblemVisibility,
  RefreshTokenRecord,
  Role,
  RankMovementDirection,
  StarterCode,
  Submission,
  SubmissionStatus,
  SubmissionTestCaseResult,
  Tag,
  TestCase,
  TestCaseGenerationJob,
  User,
  UserRankSnapshot,
  UserStatus
} from "../types/domain";

export interface CreateUserInput {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role?: Role;
}

export interface UpdateUserInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  countryCode?: string | null;
  role?: Role;
  status?: UserStatus;
  deletedAt?: Date | null;
}

export interface ListUsersInput {
  page: number;
  limit: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
}

export interface ProblemFilters {
  page: number;
  limit: number;
  difficulty?: Difficulty;
  tag?: string;
  status?: ProblemStatus;
  search?: string;
  userId?: string;
}

export interface CreateProblemInput {
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  constraints: string;
  inputFormat: string;
  outputFormat: string;
  starterCode: StarterCode;
  tags: string[];
  visibility: ProblemVisibility;
  checkerMode?: CheckerMode;
  timeLimitMs: number;
  memoryLimitMb: number;
  createdById?: string | null;
}

export type UpdateProblemInput = Partial<CreateProblemInput>;

export interface CreateTestCaseInput {
  problemId: string;
  batchId?: string | null;
  generatedByJobId?: string | null;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isStrict: boolean;
  explanation?: string | null;
  order: number;
  inputHash?: string | null;
  outputHash?: string | null;
  generatorSeed?: number | null;
  isGenerated?: boolean;
}

export type UpdateTestCaseInput = Partial<Omit<CreateTestCaseInput, "problemId">>;

export interface CreateSubmissionInput {
  userId: string;
  problemId: string;
  code: string;
  language: LegacyLanguage;
  languageId?: string | null;
  languageVersionId?: string | null;
  languageKeySnapshot?: string | null;
  languageNameSnapshot?: string | null;
  languageVersionSnapshot?: string | null;
}

export interface ListSubmissionsInput {
  page: number;
  limit: number;
  userId?: string;
  problemId?: string;
  status?: SubmissionStatus;
}

export interface CreateSubmissionResultInput {
  submissionId: string;
  testCaseId?: string | null;
  status: SubmissionStatus;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr?: string | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
}

export interface CreateProblemAssetInput {
  problemId: string;
  type: ProblemAssetType;
  languageId?: string | null;
  languageVersionId?: string | null;
  filename: string;
  sourceCode: string;
  createdById?: string | null;
}

export interface UpdateProblemAssetInput {
  languageId?: string | null;
  languageVersionId?: string | null;
  filename?: string;
  sourceCode?: string;
  isActive?: boolean;
}

export interface CreateTestCaseGenerationJobInput {
  problemId: string;
  requestedById: string;
  config: Record<string, unknown>;
  totalCases: number;
}

export interface UpdateTestCaseGenerationJobInput {
  status?: GenerationJobStatus;
  generatedCases?: number;
  errorMessage?: string | null;
  completedAt?: Date | null;
}

export interface CreateGeneratedTestCaseBatchInput {
  problemId: string;
  jobId: string;
  name: string;
  description?: string | null;
  createdById?: string | null;
}

export interface UserStats {
  solvedCount: number;
  attemptedCount: number;
  submissionsCount: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  currentStreak: number;
  longestStreak: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  submissionCalendar: Array<{ date: string; count: number }>;
  languageStats: Record<string, number>;
  difficultyStats: Record<Difficulty, number>;
}

export interface LeaderboardRow {
  user: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode">;
  solvedCount: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  rank: number;
  currentRank: number;
  previousRank?: number | null;
  rankMovement: number;
  rankMovementDirection: RankMovementDirection;
}

export interface ProblemLeaderboardRow {
  user: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  runtimeMs: number;
  memoryKb: number;
  submittedAt: Date;
  rank: number;
}

export interface ContestLeaderboardRow {
  user: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode">;
  solvedCount: number;
  penaltyMinutes: number;
  rank: number;
}

// main data access interface — MemoryRepository + PrismaRepository both implement this
// services depend on this so tests can swap in the in-memory version easily
export interface AppRepository {
  // --- health ---
  healthCheck(): Promise<{ driver: "memory" | "prisma"; ok: boolean; message?: string }>;

  // --- users / auth tokens ---
  createUser(input: CreateUserInput): Promise<User>;
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  listUsers(input: ListUsersInput): Promise<Page<User>>;
  listUsers(): Promise<User[]>;

  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenRecord>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;

  // --- problems + test cases ---
  listProblems(filters: ProblemFilters): Promise<Page<Problem & { status?: ProblemStatus }>>;
  findProblemBySlug(slug: string): Promise<Problem | null>;
  findProblemById(id: string): Promise<Problem | null>;
  createProblem(input: CreateProblemInput): Promise<Problem>;
  updateProblem(id: string, input: UpdateProblemInput): Promise<Problem>;
  archiveProblem(id: string): Promise<void>;
  listTags(): Promise<Tag[]>;

  listTestCases(problemId: string, samplesOnly?: boolean): Promise<TestCase[]>;
  addTestCase(input: CreateTestCaseInput): Promise<TestCase>;
  updateTestCase(id: string, input: UpdateTestCaseInput): Promise<TestCase>;
  deleteTestCase(id: string): Promise<void>;
  findTestCaseByInputHash(problemId: string, inputHash: string): Promise<TestCase | null>;
  deleteGeneratedTestCases(problemId: string): Promise<void>;

  // --- problem assets / test generation ---
  listProblemAssets(problemId: string): Promise<ProblemAsset[]>;
  findProblemAssetById(id: string): Promise<ProblemAsset | null>;
  findActiveProblemAsset(problemId: string, type: ProblemAssetType): Promise<ProblemAsset | null>;
  createProblemAsset(input: CreateProblemAssetInput): Promise<ProblemAsset>;
  updateProblemAsset(id: string, input: UpdateProblemAssetInput): Promise<ProblemAsset>;
  deactivateProblemAsset(id: string): Promise<void>;

  createTestCaseGenerationJob(input: CreateTestCaseGenerationJobInput): Promise<TestCaseGenerationJob>;
  listTestCaseGenerationJobs(problemId: string): Promise<TestCaseGenerationJob[]>;
  findTestCaseGenerationJobById(id: string): Promise<TestCaseGenerationJob | null>;
  updateTestCaseGenerationJob(id: string, input: UpdateTestCaseGenerationJobInput): Promise<TestCaseGenerationJob>;
  createGeneratedTestCaseBatch(input: CreateGeneratedTestCaseBatchInput): Promise<GeneratedTestCaseBatch>;
  listGeneratedTestCaseBatches(problemId: string): Promise<GeneratedTestCaseBatch[]>;
  findGeneratedTestCaseBatchById(id: string): Promise<GeneratedTestCaseBatch | null>;
  deleteGeneratedTestCaseBatch(id: string): Promise<void>;

  // --- submissions ---
  createSubmission(input: CreateSubmissionInput): Promise<Submission>;
  findSubmissionById(id: string): Promise<Submission | null>;
  listSubmissions(input: ListSubmissionsInput): Promise<Page<Submission>>;
  updateSubmission(
    id: string,
    patch: Partial<Pick<Submission, "status" | "runtimeMs" | "memoryKb" | "errorMessage" | "completedAt">>
  ): Promise<Submission>;
  clearSubmissionResults(submissionId: string): Promise<void>;
  addSubmissionResult(input: CreateSubmissionResultInput): Promise<SubmissionTestCaseResult>;
  getSubmissionResults(submissionId: string): Promise<SubmissionTestCaseResult[]>;
  upsertSolvedStatus(userId: string, problemId: string, solved: boolean): Promise<ProblemSolvedStatus>;
  getUserStats(userId: string): Promise<UserStats>;

  // --- contests ---
  listContests(): Promise<Array<Contest & { problems: ContestProblem[] }>>;
  findContestById(id: string): Promise<(Contest & { problems: ContestProblem[] }) | null>;
  createContest(input: {
    title: string;
    slug: string;
    description: string;
    startTime: Date;
    endTime: Date;
    createdById?: string | null;
    problemIds: string[];
    visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  }): Promise<Contest>;
  updateContest(
    id: string,
    input: Partial<Pick<Contest, "title" | "slug" | "description" | "startTime" | "endTime" | "status" | "visibility">>
  ): Promise<Contest & { problems: ContestProblem[] }>;
  deleteContest(id: string): Promise<void>;
  addContestProblem(contestId: string, problemId: string, points: number): Promise<ContestProblem>;
  removeContestProblem(contestId: string, problemId: string): Promise<void>;
  registerForContest(contestId: string, userId: string): Promise<ContestRegistration>;
  isContestRegistered(contestId: string, userId: string): Promise<boolean>;
  addContestSubmission(input: {
    contestId: string;
    userId: string;
    problemId: string;
    submissionId: string;
    status: SubmissionStatus;
    penaltyMinutes: number;
  }): Promise<ContestSubmission>;
  updateContestSubmissionStatus(submissionId: string, status: SubmissionStatus, penaltyMinutes?: number): Promise<void>;

  // --- leaderboards ---
  getGlobalLeaderboard(): Promise<LeaderboardRow[]>;
  getProblemLeaderboard(problemId: string): Promise<ProblemLeaderboardRow[]>;
  getContestLeaderboard(contestId: string): Promise<ContestLeaderboardRow[]>;
  generateLeaderboardSnapshot(snapshotDate?: Date): Promise<UserRankSnapshot[]>;

  // --- social: editorials / discussions / bookmarks / notes ---
  getEditorial(problemId: string, includeDraft?: boolean): Promise<Editorial | null>;
  upsertEditorial(input: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isPublished?: boolean;
  }): Promise<Editorial>;
  updateEditorial(id: string, input: { title?: string; content?: string }): Promise<Editorial>;
  deleteEditorial(id: string): Promise<void>;
  setEditorialPublished(id: string, isPublished: boolean): Promise<Editorial>;

  listDiscussions(input: {
    problemId?: string | null;
    contestId?: string | null;
    page: number;
    limit: number;
    search?: string;
  }): Promise<
    Page<
      Discussion & {
        comments: DiscussionComment[];
        author?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
      }
    >
  >;
  findDiscussionById(id: string): Promise<
    | (Discussion & {
        comments: DiscussionComment[];
        author?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
      })
    | null
  >;
  createDiscussion(input: {
    problemId?: string | null;
    contestId?: string | null;
    authorId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<Discussion>;
  addDiscussionComment(input: { discussionId: string; authorId: string; content: string }): Promise<DiscussionComment>;
  updateDiscussion(
    id: string,
    authorId: string,
    isAdmin: boolean,
    patch: { title?: string; content?: string; tags?: string[] }
  ): Promise<Discussion>;
  deleteDiscussion(id: string, authorId: string, isAdmin: boolean): Promise<void>;
  updateDiscussionComment(id: string, authorId: string, isAdmin: boolean, content: string): Promise<DiscussionComment>;
  deleteDiscussionComment(id: string, authorId: string, isAdmin: boolean): Promise<void>;
  voteDiscussion(discussionId: string, userId: string, value: 1 | -1): Promise<DiscussionVote>;

  listBookmarks(userId: string): Promise<Array<Bookmark & { problem: Problem }>>;
  addBookmark(userId: string, problemId: string): Promise<Bookmark>;
  removeBookmark(userId: string, problemId: string): Promise<void>;

  listProblemLists(userId: string): Promise<Array<ProblemList & { items: ProblemListItem[] }>>;
  createProblemList(input: {
    userId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<ProblemList>;
  addProblemToList(problemListId: string, problemId: string): Promise<ProblemListItem>;
  removeProblemFromList(problemListId: string, problemId: string): Promise<void>;

  getNote(userId: string, problemId: string): Promise<Note | null>;
  upsertNote(userId: string, problemId: string, content: string): Promise<Note>;
  updateNote(id: string, userId: string, content: string): Promise<Note>;
  deleteNote(id: string, userId: string): Promise<void>;
}
