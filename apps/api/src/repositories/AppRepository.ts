import type {
  AdminAuditLog,
  ApiUsageEvent,
  AuditOutcome,
  BadgeDefinition,
  BackupRun,
  BackupStatus,
  Bookmark,
  Company,
  Contest,
  ContestAnnouncement,
  ContestProblem,
  ContestRatingJob,
  ContestRegistration,
  ContestSubmission,
  CheckerMode,
  DailyChallenge,
  DailyChallengeCompletion,
  Difficulty,
  Discussion,
  DiscussionAcceptedAnswer,
  DiscussionComment,
  DiscussionHelpfulVote,
  DiscussionVote,
  Editorial,
  EditorialSectionType,
  GeneratedTestCaseBatch,
  GenerationJobStatus,
  LegacyLanguage,
  LearningCollection,
  LearningCollectionItem,
  LearningCollectionProgress,
  LearningCollectionType,
  MonitoringAlert,
  MonitoringAlertStatus,
  Note,
  Page,
  PracticeOutcome,
  PracticeSession,
  PracticeSessionProblem,
  PracticeSessionStatus,
  PracticeSessionType,
  Problem,
  ProblemCompanyTag,
  ProblemSort,
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
  RatingEvent,
  RatingJobStatus,
  StarterCode,
  HealthCheckSnapshot,
  HealthStatus,
  Submission,
  SubmissionStatus,
  SubmissionTestCaseResult,
  Tag,
  TestCase,
  TestCaseGenerationJob,
  User,
  UserBadge,
  UserFollow,
  UserRankSnapshot,
  UserRating,
  UserStatus,
  ModerationStatus,
  Notification,
  NotificationType,
  Report,
  ReportTargetType,
  Solution,
  SolutionVisibility,
  SolutionVote
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
  topic?: string;
  company?: string;
  visibility?: ProblemVisibility;
  includeNonPublic?: boolean;
  status?: ProblemStatus;
  search?: string;
  userId?: string;
  sort?: ProblemSort;
}

export interface ProblemCompanyInput {
  companyId?: string;
  name?: string;
  slug?: string;
  frequency?: number;
  isFeatured?: boolean;
}

export interface LearningCollectionWithItems extends LearningCollection {
  items: Array<LearningCollectionItem & { problem?: Problem }>;
  progress?: LearningCollectionProgress | null;
}

export interface CreateLearningCollectionInput {
  type: LearningCollectionType;
  slug: string;
  title: string;
  description: string;
  badge?: string | null;
  dailyUnlockCount?: number;
  visibility?: ProblemVisibility;
  createdById?: string | null;
}

export interface UpdateLearningCollectionInput {
  slug?: string;
  title?: string;
  description?: string;
  badge?: string | null;
  dailyUnlockCount?: number;
  visibility?: ProblemVisibility;
}

export interface LearningCollectionItemInput {
  problemId: string;
  order?: number;
  note?: string | null;
}

export interface DailyChallengeWithProblem extends DailyChallenge {
  problem?: Problem;
  completion?: DailyChallengeCompletion | null;
}

export interface UpsertDailyChallengeInput {
  date: Date;
  problemId: string;
  assignedById?: string | null;
  rewardXp?: number;
}

export interface UserBadgeWithDefinition extends UserBadge {
  badge?: BadgeDefinition;
}

export interface PracticeSessionWithProblems extends PracticeSession {
  problems: Array<PracticeSessionProblem & { problem?: Problem }>;
}

export interface CreatePracticeSessionInput {
  userId: string;
  type: PracticeSessionType;
  title: string;
  durationSeconds: number;
  problemIds: string[];
  settings?: Record<string, unknown> | null;
}

export interface UpdatePracticeSessionInput {
  status?: PracticeSessionStatus;
  finishedAt?: Date | null;
  summary?: Record<string, unknown> | null;
}

export interface UpdatePracticeSessionProblemInput {
  outcome?: PracticeOutcome | null;
  secondsSpent?: number | null;
  submissionId?: string | null;
}

export interface EditorialStructureInput {
  sections?: Array<{
    type?: EditorialSectionType;
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
  companies?: ProblemCompanyInput[];
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
  language?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export type DiscussionSort = "newest" | "top" | "unanswered";

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

export interface CreateSolutionInput {
  problemId: string;
  authorId: string;
  submissionId?: string | null;
  title: string;
  content: string;
  code: string;
  language: string;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  visibility?: SolutionVisibility;
  isPinned?: boolean;
}

export interface UpdateSolutionInput {
  title?: string;
  content?: string;
  code?: string;
  language?: string;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  visibility?: SolutionVisibility;
  isPinned?: boolean;
}

export interface ListSolutionsInput {
  page: number;
  limit: number;
  problemId?: string;
  authorId?: string;
  viewerId?: string;
  includePrivate?: boolean;
}

export interface SolutionWithRelations extends Solution {
  author?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  problem?: Pick<Problem, "id" | "slug" | "title" | "difficulty">;
}

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reporterId?: string | null;
  reason: string;
  details?: string | null;
}

export interface UpdateReportInput {
  status?: ModerationStatus;
  moderatorId?: string | null;
  resolution?: string | null;
  resolvedAt?: Date | null;
}

export interface ListReportsInput {
  page: number;
  limit: number;
  status?: ModerationStatus;
  targetType?: ReportTargetType;
  reporterId?: string;
}

export interface CreateNotificationInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

export interface ListNotificationsInput {
  userId: string;
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export interface CreateAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestMethod?: string | null;
  path?: string | null;
  statusCode?: number | null;
  outcome?: AuditOutcome;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ListAuditLogsInput {
  page: number;
  limit: number;
  actorId?: string;
  entityType?: string;
}

export interface CreateApiUsageEventInput {
  userId?: string | null;
  method: string;
  path: string;
  route?: string | null;
  statusCode: number;
  durationMs: number;
  ip?: string | null;
  userAgent?: string | null;
  rateLimited?: boolean;
}

export interface ListApiUsageEventsInput {
  page: number;
  limit: number;
  userId?: string;
  path?: string;
  statusCode?: number;
  since?: Date;
  rateLimited?: boolean;
}

export interface CreateBackupRunInput {
  requestedById?: string | null;
  status: BackupStatus;
  filename?: string | null;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  startedAt?: Date;
  completedAt?: Date | null;
}

export interface UpdateBackupRunInput {
  status?: BackupStatus;
  filename?: string | null;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  completedAt?: Date | null;
}

export interface ListBackupRunsInput {
  page: number;
  limit: number;
  status?: BackupStatus;
}

export interface CreateHealthCheckSnapshotInput {
  status: HealthStatus;
  details: Record<string, unknown>;
}

export interface ListHealthCheckSnapshotsInput {
  page: number;
  limit: number;
  status?: HealthStatus;
}

export interface UpsertUserRatingInput {
  userId: string;
  rating: number;
  volatility: number;
  contestsRated: number;
}

export interface CreateRatingEventInput {
  userId: string;
  contestId?: string | null;
  oldRating: number;
  newRating: number;
  delta: number;
  rank: number;
  participants: number;
}

export interface ListRatingEventsInput {
  page: number;
  limit: number;
  userId?: string;
  contestId?: string;
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

// main data access interface - MemoryRepository + PrismaRepository both implement this
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
  listCompanies(): Promise<Company[]>;
  setProblemCompanies(problemId: string, companies: ProblemCompanyInput[]): Promise<ProblemCompanyTag[]>;

  listLearningCollections(input: {
    type: LearningCollectionType;
    page: number;
    limit: number;
    includeNonPublic?: boolean;
    userId?: string;
  }): Promise<Page<LearningCollectionWithItems>>;
  findLearningCollectionBySlug(input: {
    type: LearningCollectionType;
    slug: string;
    includeNonPublic?: boolean;
    userId?: string;
  }): Promise<LearningCollectionWithItems | null>;
  createLearningCollection(input: CreateLearningCollectionInput): Promise<LearningCollection>;
  updateLearningCollection(id: string, input: UpdateLearningCollectionInput): Promise<LearningCollection>;
  deleteLearningCollection(id: string): Promise<void>;
  setLearningCollectionItems(collectionId: string, items: LearningCollectionItemInput[]): Promise<LearningCollectionItem[]>;
  upsertLearningProgress(input: {
    collectionId: string;
    userId: string;
    unlockedCount: number;
    completedCount: number;
    completedAt?: Date | null;
  }): Promise<LearningCollectionProgress>;

  findDailyChallengeByDate(date: Date, userId?: string): Promise<DailyChallengeWithProblem | null>;
  upsertDailyChallenge(input: UpsertDailyChallengeInput): Promise<DailyChallenge>;
  listDailyChallenges(input: { page: number; limit: number }): Promise<Page<DailyChallengeWithProblem>>;
  completeDailyChallengeForProblem(input: {
    userId: string;
    problemId: string;
    submissionId?: string | null;
    completedAt?: Date;
  }): Promise<DailyChallengeCompletion | null>;
  listDailyChallengeCompletions(userId: string): Promise<DailyChallengeCompletion[]>;

  listBadgeDefinitions(includeInactive?: boolean): Promise<BadgeDefinition[]>;
  createBadgeDefinition(input: {
    key: string;
    name: string;
    description: string;
    icon?: string | null;
    triggerType: string;
    triggerValue?: number;
    isActive?: boolean;
    createdById?: string | null;
  }): Promise<BadgeDefinition>;
  updateBadgeDefinition(id: string, input: Partial<Pick<BadgeDefinition, "name" | "description" | "icon" | "triggerType" | "triggerValue" | "isActive">>): Promise<BadgeDefinition>;
  awardBadge(input: {
    userId: string;
    badgeKey: string;
    sourceType?: string | null;
    sourceId?: string | null;
  }): Promise<UserBadgeWithDefinition | null>;
  listUserBadges(userId: string): Promise<UserBadgeWithDefinition[]>;

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
  getProblemSolvedStatus(userId: string, problemId: string): Promise<ProblemSolvedStatus | null>;
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
    freezeStartsAt?: Date | null;
    isRated?: boolean;
    ratingSeason?: string | null;
    ratingScheduledAt?: Date | null;
  }): Promise<Contest>;
  updateContest(
    id: string,
    input: Partial<
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
        | "ratingsPublishedAt"
      >
    >
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
  getContestLeaderboard(contestId: string, options?: { before?: Date }): Promise<ContestLeaderboardRow[]>;
  generateLeaderboardSnapshot(snapshotDate?: Date): Promise<UserRankSnapshot[]>;

  // --- social: editorials / discussions / bookmarks / notes ---
  getEditorial(problemId: string, includeDraft?: boolean): Promise<Editorial | null>;
  upsertEditorial(input: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isPublished?: boolean;
    structure?: EditorialStructureInput;
  }): Promise<Editorial>;
  updateEditorial(id: string, input: { title?: string; content?: string }): Promise<Editorial>;
  deleteEditorial(id: string): Promise<void>;
  setEditorialPublished(id: string, isPublished: boolean): Promise<Editorial>;
  setEditorialStructure(editorialId: string, input: EditorialStructureInput): Promise<Editorial>;

  listDiscussions(input: {
    problemId?: string | null;
    contestId?: string | null;
    page: number;
    limit: number;
    search?: string;
    sort?: DiscussionSort;
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
  findDiscussionCommentById(id: string): Promise<DiscussionComment | null>;
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
  hasDiscussionCommentHelpfulVote(commentId: string, userId: string): Promise<boolean>;
  voteDiscussionCommentHelpful(commentId: string, userId: string): Promise<DiscussionHelpfulVote>;
  unvoteDiscussionCommentHelpful(commentId: string, userId: string): Promise<void>;
  acceptDiscussionAnswer(discussionId: string, commentId: string, actorId: string): Promise<DiscussionAcceptedAnswer>;

  // --- solutions, moderation, notifications, ops ---
  listSolutions(input: ListSolutionsInput): Promise<Page<SolutionWithRelations>>;
  findSolutionById(id: string): Promise<SolutionWithRelations | null>;
  createSolution(input: CreateSolutionInput): Promise<Solution>;
  updateSolution(id: string, input: UpdateSolutionInput): Promise<Solution>;
  deleteSolution(id: string): Promise<void>;
  voteSolution(solutionId: string, userId: string, value: 1 | -1): Promise<SolutionVote>;

  createReport(input: CreateReportInput): Promise<Report>;
  listReports(input: ListReportsInput): Promise<Page<Report>>;
  updateReport(id: string, input: UpdateReportInput): Promise<Report>;

  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;
  listFollowers(userId: string, input: { page: number; limit: number }): Promise<Page<User>>;
  listFollowing(userId: string, input: { page: number; limit: number }): Promise<Page<User>>;

  createNotification(input: CreateNotificationInput): Promise<Notification>;
  listNotifications(input: ListNotificationsInput): Promise<Page<Notification>>;
  markNotificationRead(id: string, userId: string): Promise<Notification>;
  markAllNotificationsRead(userId: string): Promise<number>;

  createAuditLog(input: CreateAuditLogInput): Promise<AdminAuditLog>;
  listAuditLogs(input: ListAuditLogsInput): Promise<Page<AdminAuditLog>>;

  recordApiUsageEvent(input: CreateApiUsageEventInput): Promise<ApiUsageEvent>;
  listApiUsageEvents(input: ListApiUsageEventsInput): Promise<Page<ApiUsageEvent>>;
  deleteApiUsageEventsBefore(cutoff: Date): Promise<number>;

  createBackupRun(input: CreateBackupRunInput): Promise<BackupRun>;
  updateBackupRun(id: string, input: UpdateBackupRunInput): Promise<BackupRun>;
  listBackupRuns(input: ListBackupRunsInput): Promise<Page<BackupRun>>;

  createHealthCheckSnapshot(input: CreateHealthCheckSnapshotInput): Promise<HealthCheckSnapshot>;
  listHealthCheckSnapshots(input: ListHealthCheckSnapshotsInput): Promise<Page<HealthCheckSnapshot>>;

  createPracticeSession(input: CreatePracticeSessionInput): Promise<PracticeSessionWithProblems>;
  listPracticeSessions(input: {
    userId: string;
    type?: PracticeSessionType;
    page: number;
    limit: number;
  }): Promise<Page<PracticeSessionWithProblems>>;
  findPracticeSessionById(id: string): Promise<PracticeSessionWithProblems | null>;
  updatePracticeSession(id: string, input: UpdatePracticeSessionInput): Promise<PracticeSessionWithProblems>;
  updatePracticeSessionProblem(
    sessionProblemId: string,
    input: UpdatePracticeSessionProblemInput
  ): Promise<PracticeSessionProblem>;

  createContestAnnouncement(input: {
    contestId: string;
    authorId: string;
    title: string;
    content: string;
  }): Promise<ContestAnnouncement>;
  listContestAnnouncements(contestId: string): Promise<ContestAnnouncement[]>;
  createContestRatingJob(input: {
    contestId: string;
    requestedById?: string | null;
    scheduledAt: Date;
  }): Promise<ContestRatingJob>;
  listContestRatingJobs(input: {
    status?: RatingJobStatus;
    page: number;
    limit: number;
  }): Promise<Page<ContestRatingJob>>;
  updateContestRatingJob(
    id: string,
    input: Partial<Pick<ContestRatingJob, "status" | "startedAt" | "completedAt" | "errorMessage">>
  ): Promise<ContestRatingJob>;

  createMonitoringAlert(input: {
    severity: string;
    source: string;
    title: string;
    message: string;
    details?: Record<string, unknown> | null;
  }): Promise<MonitoringAlert>;
  listMonitoringAlerts(input: {
    status?: MonitoringAlertStatus;
    page: number;
    limit: number;
  }): Promise<Page<MonitoringAlert>>;
  updateMonitoringAlert(
    id: string,
    input: Partial<Pick<MonitoringAlert, "status" | "acknowledgedById" | "acknowledgedAt" | "resolvedById" | "resolvedAt">>
  ): Promise<MonitoringAlert>;

  getUserRating(userId: string): Promise<UserRating | null>;
  upsertUserRating(input: UpsertUserRatingInput): Promise<UserRating>;
  listUserRatings(input: { page: number; limit: number }): Promise<Page<UserRating & { user?: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode"> }>>;
  createRatingEvent(input: CreateRatingEventInput): Promise<RatingEvent>;
  listRatingEvents(input: ListRatingEventsInput): Promise<Page<RatingEvent>>;
  deleteRatingEventsByContest(contestId: string): Promise<number>;

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
