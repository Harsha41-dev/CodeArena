export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type LegacyLanguage = "CPP" | "JAVA" | "PYTHON" | "JAVASCRIPT";
export type Language = string;
export type LanguageCategory =
  | "GENERAL_PURPOSE"
  | "SYSTEMS"
  | "SCRIPTING"
  | "FUNCTIONAL"
  | "JVM"
  | "DOTNET"
  | "DATABASE"
  | "SHELL"
  | "EDUCATIONAL"
  | "OTHER";
export type SubmissionStatus =
  | "PENDING"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILATION_ERROR"
  | "INTERNAL_ERROR";
export type ProblemAssetType = "GENERATOR" | "REFERENCE_SOLUTION" | "VALIDATOR" | "CHECKER";
export type CheckerMode = "STANDARD" | "CUSTOM_CHECKER";
export type GenerationJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ProblemSort =
  | "newest"
  | "oldest"
  | "title"
  | "difficulty"
  | "acceptance"
  | "submissions"
  | "solved"
  | "frequency";
export type SolutionVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
export type ReportTargetType = "PROBLEM" | "SUBMISSION" | "DISCUSSION" | "COMMENT" | "SOLUTION" | "USER";
export type ModerationStatus = "OPEN" | "TRIAGED" | "RESOLVED" | "DISMISSED";
export type BackupStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type HealthStatus = "HEALTHY" | "DEGRADED" | "DOWN";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta: Record<string, unknown>;
}

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  status?: UserStatus;
  bio?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  countryCode?: string | null;
  createdAt?: string;
}

export type PublicUserProfile = Omit<User, "email">;

export interface AuthResult {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProblemCompany {
  id: string;
  problemId: string;
  companyId: string;
  frequency: number;
  isFeatured: boolean;
  company: Company;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isStrict?: boolean;
  explanation?: string | null;
  batchId?: string | null;
  generatedByJobId?: string | null;
  inputHash?: string | null;
  outputHash?: string | null;
  generatorSeed?: number | null;
  isGenerated?: boolean;
}

export interface ProblemAsset {
  id: string;
  problemId: string;
  type: ProblemAssetType;
  languageId?: string | null;
  languageVersionId?: string | null;
  filename: string;
  sourceCode: string;
  isActive: boolean;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationConfig {
  batchName: string;
  description?: string | null;
  visibility: "SAMPLE" | "HIDDEN";
  count: number;
  seedStart: number;
  seedEnd: number;
  inputMode: "STDIN";
  replaceExistingGenerated: boolean;
  runValidator: boolean;
  allowEmptyInput: boolean;
  allowEmptyOutput: boolean;
  skipDuplicates: boolean;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface TestCaseGenerationJob {
  id: string;
  problemId: string;
  requestedById?: string | null;
  status: GenerationJobStatus;
  config: GenerationConfig;
  totalCases: number;
  generatedCases: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedTestCaseBatch {
  id: string;
  problemId: string;
  jobId: string;
  name: string;
  description?: string | null;
  generatedCases: number;
  createdById?: string | null;
  createdAt: string;
}

export interface GenerationPreview {
  seed: number;
  generatedInput: string;
  expectedOutput: string;
  inputHash: string;
  outputHash: string;
  generatorStatus: SubmissionStatus;
  referenceStatus: SubmissionStatus;
}

export interface CheckerPreviewResult {
  verdict: "ACCEPTED" | "WRONG_ANSWER" | "CHECKER_ERROR";
  message: string;
  runtimeMs: number;
  memoryKb: number;
}

export interface StarterCode {
  CPP: string;
  JAVA: string;
  PYTHON: string;
  JAVASCRIPT: string;
}

export interface CodeLanguageVersion {
  id: string;
  languageId: string;
  version: string;
  label: string;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  timeLimitMultiplier: number;
  memoryLimitMultiplier: number;
  sourceFileName: string;
  executableFileName?: string | null;
  starterTemplate?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface CodeLanguage {
  id: string;
  key: string;
  displayName: string;
  monacoId: string;
  fileExtension: string;
  category: LanguageCategory;
  isActive: boolean;
  isCompiled: boolean;
  sortOrder: number;
  versions: CodeLanguageVersion[];
}

export interface ProblemLanguageOption {
  language: CodeLanguage;
  version: CodeLanguageVersion;
  isEnabled: boolean;
  isPinnedVersion: boolean;
  starterCode?: string;
  hasProblemStarterCode: boolean;
}

export interface ExecutorCapabilityEntry {
  language: Pick<CodeLanguage, "id" | "key" | "displayName" | "category" | "isActive">;
  version: Pick<CodeLanguageVersion, "id" | "version" | "label" | "isActive">;
  canRun: boolean;
  canSubmit: boolean;
  reason?: string;
  admin?: {
    executorType: "MOCK" | "DOCKER" | "JUDGE0";
    executionProfileId?: string | null;
    executionProfileActive?: boolean;
    judge0Id?: number | null;
    dockerImage?: string | null;
    hasCompileCommand: boolean;
    hasRunCommand: boolean;
    languageActive: boolean;
    versionActive: boolean;
    problemEnabled?: boolean;
    missingConfigReason?: string;
  };
}

export interface ExecutorCapabilityResponse {
  executorMode: "mock" | "docker" | "judge0";
  executorType: "MOCK" | "DOCKER" | "JUDGE0";
  executorConfigured: boolean;
  executorConfigurationReason?: string;
  summary: {
    activeSupportedLanguageVersions: number;
    unsupportedLanguageVersions: number;
    missingJudge0Ids: number;
    missingDockerProfiles: number;
    inactiveExecutionProfiles: number;
    globallyDisabledLanguages: number;
    problemDisabledLanguages: number;
  };
  languages: ExecutorCapabilityEntry[];
}

export interface ExecutorHealthResponse {
  executorMode: "mock" | "docker" | "judge0";
  executorType: "MOCK" | "DOCKER" | "JUDGE0";
  executorConfigured: boolean;
  executorConfigurationReason?: string;
  isProductionJudge: boolean;
  baseUrlConfigured?: boolean;
  judge0Reachable?: boolean;
  judge0LanguagesCount?: number;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  constraints: string;
  inputFormat: string;
  outputFormat: string;
  starterCode: StarterCode;
  tags: Tag[];
  status?: "NOT_ATTEMPTED" | "ATTEMPTED" | "SOLVED";
  sampleTestCases?: TestCase[];
  visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  checkerMode?: CheckerMode;
  timeLimitMs: number;
  memoryLimitMb: number;
  totalSubmissions?: number;
  acceptedSubmissions?: number;
  solvedCount?: number;
  acceptanceRate?: number;
  frequency?: number;
  companies?: ProblemCompany[];
}

export interface DailyChallenge {
  date: string;
  problem: Problem | null;
  completion?: DailyChallengeCompletion | null;
  rewardXp?: number;
}

export interface DailyChallengeCompletion {
  id: string;
  challengeId: string;
  userId: string;
  problemId: string;
  submissionId?: string | null;
  completedAt: string;
  xpAwarded: number;
}

export interface ProblemSetSummary {
  id?: string;
  slug: string;
  title: string;
  description: string;
  visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  totalProblems: number;
  solvedCount: number;
  progressPercent: number;
}

export interface ProblemSetDetail extends ProblemSetSummary {
  problems: Problem[];
}

export interface ProblemRecommendation {
  problem: Problem | null;
  reason: string;
  recommendedTag: string | null;
}

export interface StudyPlanSummary {
  id?: string;
  slug: string;
  title: string;
  description: string;
  badge?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  totalProblems: number;
  solvedCount: number;
  progressPercent: number;
  dailyUnlockCount: number;
  unlockedCount: number;
  todayProblem: Problem | null;
  progress?: LearningCollectionProgress | null;
}

export interface StudyPlanProblem extends Problem {
  locked?: boolean;
}

export interface StudyPlanDetail extends StudyPlanSummary {
  problems: StudyPlanProblem[];
}

export type LearningCollectionType = "STUDY_PLAN" | "CURATED_LIST";

export interface LearningCollectionProgress {
  id: string;
  collectionId: string;
  userId: string;
  startedAt: string;
  lastViewedAt: string;
  unlockedCount: number;
  completedCount: number;
  completedAt?: string | null;
}

export interface LearningCollection {
  id: string;
  type: LearningCollectionType;
  slug: string;
  title: string;
  description: string;
  badge?: string | null;
  dailyUnlockCount: number;
  visibility: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: Array<{ id: string; collectionId: string; problemId: string; order: number; note?: string | null; problem?: Problem }>;
  progress?: LearningCollectionProgress | null;
}

export interface BadgeDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  icon?: string | null;
  triggerType: string;
  triggerValue: number;
  isActive: boolean;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  sourceType?: string | null;
  sourceId?: string | null;
  awardedAt: string;
  badge?: BadgeDefinition;
}

export interface RevisionQueue {
  title: string;
  reason: string;
  totalProblems: number;
  problems: Problem[];
}

export interface RunResult {
  status: SubmissionStatus;
  results: Array<{
    testCaseId: string;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    status: SubmissionStatus;
    runtimeMs: number;
    memoryKb: number;
    stderr?: string | null;
  }>;
}

export interface CustomRunResult {
  status: SubmissionStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  runtime: number;
  memory: number;
}

export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  code: string;
  language: LegacyLanguage;
  languageId?: string | null;
  languageVersionId?: string | null;
  languageKeySnapshot?: string | null;
  languageNameSnapshot?: string | null;
  languageVersionSnapshot?: string | null;
  status: SubmissionStatus;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  results?: RunResult["results"];
  problem?: Problem;
}

export interface SubmissionStatusEvent {
  submissionId: string;
  status: SubmissionStatus;
  passedTestCases: number;
  totalTestCases: number;
  runtime: number | null;
  memory: number | null;
  updatedAt: string;
}

export interface Contest {
  id: string;
  title: string;
  slug: string;
  description: string;
  startTime: string;
  endTime: string;
  status: "UPCOMING" | "LIVE" | "ENDED";
  visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  freezeStartsAt?: string | null;
  isRated?: boolean;
  ratingSeason?: string | null;
  ratingScheduledAt?: string | null;
  ratingsPublishedAt?: string | null;
  problems: Array<{ problemId: string; order: number; points: number }>;
}

export interface ContestAnnouncement {
  id: string;
  contestId: string;
  title: string;
  content: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardRow {
  rank: number;
  currentRank?: number;
  previousRank?: number | null;
  rankMovement?: number;
  rankMovementDirection?: "UP" | "DOWN" | "SAME" | "NEW";
  user: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode">;
  solvedCount: number;
  acceptedSubmissions: number;
  acceptanceRate?: number;
  penaltyMinutes?: number;
}

export interface ProblemLeaderboardRow {
  rank: number;
  user: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  runtimeMs: number;
  memoryKb: number;
  submittedAt: string;
}

export interface UserStats {
  solvedCount: number;
  attemptedCount: number;
  submissionsCount: number;
  totalSubmissions?: number;
  acceptedSubmissions: number;
  acceptanceRate?: number;
  currentStreak?: number;
  longestStreak?: number;
  easySolved?: number;
  mediumSolved?: number;
  hardSolved?: number;
  submissionCalendar?: Array<{ date: string; count: number }>;
  languageStats: Record<string, number>;
  difficultyStats: Record<Difficulty, number>;
}

export interface Discussion {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  author?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  upvotes: number;
  downvotes?: number;
  createdAt: string;
  updatedAt?: string;
  comments: Array<{
    id: string;
    content: string;
    upvotes: number;
    helpfulVotes?: number;
    isAcceptedAnswer?: boolean;
    isHelpfulByMe?: boolean;
    createdAt: string;
    authorId?: string;
  }>;
}

export interface Editorial {
  id: string;
  problemId: string;
  title: string;
  content: string;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: EditorialSection[];
  officialSolutions?: EditorialOfficialSolution[];
}

export interface EditorialSection {
  id: string;
  editorialId: string;
  type: "TEXT" | "HINT" | "SOLUTION" | "COMPLEXITY" | "DIAGRAM";
  title: string;
  content: string;
  language?: string | null;
  order: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialOfficialSolution {
  id: string;
  editorialId: string;
  language: string;
  code: string;
  explanation?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  problemId: string;
  createdAt: string;
  problem: Problem;
}

export interface Solution {
  id: string;
  problemId: string;
  authorId: string;
  submissionId?: string | null;
  title: string;
  content: string;
  code: string;
  language: string;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  visibility: SolutionVisibility;
  upvotes: number;
  downvotes: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  problem?: Pick<Problem, "id" | "slug" | "title" | "difficulty">;
}

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reporterId?: string | null;
  reason: string;
  details?: string | null;
  status: ModerationStatus;
  moderatorId?: string | null;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface FollowStatus {
  isFollowing: boolean;
  followers: number;
  following: number;
}

export interface Notification {
  id: string;
  userId: string;
  actorId?: string | null;
  type: "FOLLOW" | "DISCUSSION_REPLY" | "SOLUTION_VOTE" | "REPORT_STATUS" | "SYSTEM";
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestMethod?: string | null;
  path?: string | null;
  statusCode?: number | null;
  outcome: "SUCCESS" | "FAILURE";
  createdAt: string;
}

export interface AbuseAnalytics {
  windowHours: number;
  totalRequests: number;
  sampledRequests: number;
  errorRequests: number;
  rateLimitedRequests: number;
  averageDurationMs: number;
  openReports: number;
  generatedAt: string;
  topPaths: Array<{ path: string; count: number; errors: number; avgDurationMs: number }>;
  suspiciousUsers: Array<{ key: string; requests: number; errors: number; rateLimited: number; codeRuns: number }>;
}

export interface BackupRun {
  id: string;
  requestedById?: string | null;
  status: BackupStatus;
  filename?: string | null;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
}

export interface QueueMetrics {
  driver: "memory" | "bullmq";
  waiting: number;
  pending: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  workerStatus?: "inline" | "external" | "unavailable";
}

export interface HealthCheckSnapshot {
  id: string;
  status: HealthStatus;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ProductionStatus {
  status: HealthStatus;
  uptimeSeconds: number;
  timestamp: string;
  database: { driver: "memory" | "prisma"; ok: boolean; message?: string };
  executor: ExecutorHealthResponse;
  redis: { configured: boolean; ok?: boolean };
  queue: QueueMetrics;
  reports: { open: number };
  backups: BackupRun[];
  snapshots: HealthCheckSnapshot[];
  abuse: AbuseAnalytics | null;
}

export interface MonitoringAlert {
  id: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  severity: string;
  source: string;
  title: string;
  message: string;
  details?: Record<string, unknown> | null;
  acknowledgedById?: string | null;
  acknowledgedAt?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContestRatingJob {
  id: string;
  contestId: string;
  requestedById?: string | null;
  status: "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  scheduledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRating {
  id: string;
  userId: string;
  rating: number;
  volatility: number;
  contestsRated: number;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode">;
}

export interface RatingEvent {
  id: string;
  userId: string;
  contestId?: string | null;
  oldRating: number;
  newRating: number;
  delta: number;
  rank: number;
  participants: number;
  createdAt: string;
  user?: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode">;
}

export type PracticeSessionType = "VIRTUAL_CONTEST" | "MOCK_INTERVIEW";
export type PracticeOutcome = "SOLVED" | "REVIEW" | "SKIPPED";

export interface PracticeSessionProblem {
  id: string;
  sessionId: string;
  problemId: string;
  order: number;
  outcome?: PracticeOutcome | null;
  secondsSpent?: number | null;
  submissionId?: string | null;
  createdAt: string;
  updatedAt: string;
  problem?: Problem;
}

export interface PracticeSession {
  id: string;
  userId: string;
  type: PracticeSessionType;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  title: string;
  durationSeconds: number;
  startedAt: string;
  finishedAt?: string | null;
  settings?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  problems: PracticeSessionProblem[];
  leaderboard?: Array<{ userId: string; solvedCount: number; penaltyMinutes: number; rank: number }>;
}
