export type Role = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "DELETED";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
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
export type LegacyLanguage = "CPP" | "JAVA" | "PYTHON" | "JAVASCRIPT";
export type Language = LegacyLanguage;
export type ProblemVisibility = "PUBLIC" | "PRIVATE" | "ARCHIVED";
export type CheckerMode = "STANDARD" | "CUSTOM_CHECKER";
export type ContestStatus = "UPCOMING" | "LIVE" | "ENDED";
export type ProblemAssetType = "GENERATOR" | "REFERENCE_SOLUTION" | "VALIDATOR" | "CHECKER";
export type GenerationJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ProblemStatus = "NOT_ATTEMPTED" | "ATTEMPTED" | "SOLVED";
export type ProblemSort =
  | "newest"
  | "oldest"
  | "title"
  | "difficulty"
  | "acceptance"
  | "submissions"
  | "solved"
  | "frequency";
export type RankMovementDirection = "UP" | "DOWN" | "SAME" | "NEW";
export type ExecutorType = "MOCK" | "DOCKER" | "JUDGE0";
export type SolutionVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
export type ReportTargetType = "PROBLEM" | "SUBMISSION" | "DISCUSSION" | "COMMENT" | "SOLUTION" | "USER";
export type ModerationStatus = "OPEN" | "TRIAGED" | "RESOLVED" | "DISMISSED";
export type NotificationType = "FOLLOW" | "DISCUSSION_REPLY" | "SOLUTION_VOTE" | "REPORT_STATUS" | "SYSTEM";
export type BackupStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type HealthStatus = "HEALTHY" | "DEGRADED" | "DOWN";
export type AuditOutcome = "SUCCESS" | "FAILURE";
export type LearningCollectionType = "STUDY_PLAN" | "CURATED_LIST";
export type PracticeSessionType = "VIRTUAL_CONTEST" | "MOCK_INTERVIEW";
export type PracticeSessionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
export type PracticeOutcome = "SOLVED" | "REVIEW" | "SKIPPED";
export type EditorialSectionType = "TEXT" | "HINT" | "SOLUTION" | "COMPLEXITY" | "DIAGRAM";
export type RatingJobStatus = "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type MonitoringAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
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

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  bio?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  countryCode?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface StarterCode {
  CPP: string;
  JAVA: string;
  PYTHON: string;
  JAVASCRIPT: string;
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
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemLanguage {
  id: string;
  problemId: string;
  languageId: string;
  languageVersionId?: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemStarterCode {
  id: string;
  problemId: string;
  languageId: string;
  languageVersionId?: string | null;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionProfile {
  id: string;
  languageVersionId: string;
  executorType: ExecutorType;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  environment?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LanguageWithVersions extends CodeLanguage {
  versions: Array<CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] }>;
}

export interface ProblemLanguageOption {
  language: CodeLanguage;
  version: CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] };
  executionProfile?: ExecutionProfile | null;
  isEnabled: boolean;
  isPinnedVersion: boolean;
  starterCode?: string;
  hasProblemStarterCode: boolean;
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
  solution?: string | null;
  visibility: ProblemVisibility;
  checkerMode: CheckerMode;
  timeLimitMs: number;
  memoryLimitMb: number;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Tag[];
  totalSubmissions?: number;
  acceptedSubmissions?: number;
  solvedCount?: number;
  acceptanceRate?: number;
  frequency?: number;
  companies?: ProblemCompanyTag[];
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemCompany {
  id: string;
  problemId: string;
  companyId: string;
  frequency: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemCompanyTag extends ProblemCompany {
  company: Company;
}

export interface TestCase {
  id: string;
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
  isGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseGenerationJob {
  id: string;
  problemId: string;
  status: GenerationJobStatus;
  requestedById?: string | null;
  config: Record<string, unknown>;
  totalCases: number;
  generatedCases: number;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface GeneratedTestCaseBatch {
  id: string;
  problemId: string;
  jobId: string;
  name: string;
  description?: string | null;
  createdById?: string | null;
  createdAt: Date;
  testCases?: TestCase[];
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
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface SubmissionTestCaseResult {
  id: string;
  submissionId: string;
  testCaseId?: string | null;
  status: SubmissionStatus;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr?: string | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  createdAt: Date;
}

export interface ProblemSolvedStatus {
  id: string;
  userId: string;
  problemId: string;
  attempted: boolean;
  solved: boolean;
  attempts: number;
  firstSolvedAt?: Date | null;
  lastSubmittedAt?: Date | null;
}

export interface Contest {
  id: string;
  title: string;
  slug: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: ContestStatus;
  visibility?: ProblemVisibility;
  freezeStartsAt?: Date | null;
  isRated?: boolean;
  ratingSeason?: string | null;
  ratingScheduledAt?: Date | null;
  ratingsPublishedAt?: Date | null;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContestProblem {
  id: string;
  contestId: string;
  problemId: string;
  order: number;
  points: number;
}

export interface ContestRegistration {
  id: string;
  contestId: string;
  userId: string;
  registeredAt: Date;
}

export interface ContestSubmission {
  id: string;
  contestId: string;
  userId: string;
  problemId: string;
  submissionId: string;
  status: SubmissionStatus;
  penaltyMinutes: number;
  submittedAt: Date;
}

export interface Discussion {
  id: string;
  problemId?: string | null;
  contestId?: string | null;
  authorId: string;
  title: string;
  content: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionComment {
  id: string;
  discussionId: string;
  authorId: string;
  content: string;
  upvotes: number;
  helpfulVotes?: number;
  isAcceptedAnswer?: boolean;
  isHelpfulByMe?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionHelpfulVote {
  id: string;
  commentId: string;
  userId: string;
  createdAt: Date;
}

export interface DiscussionAcceptedAnswer {
  id: string;
  discussionId: string;
  commentId: string;
  acceptedById: string;
  createdAt: Date;
}

export interface Bookmark {
  id: string;
  userId: string;
  problemId: string;
  createdAt: Date;
}

export interface ProblemList {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemListItem {
  id: string;
  problemListId: string;
  problemId: string;
  order: number;
  createdAt: Date;
}

export interface Note {
  id: string;
  userId: string;
  problemId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Editorial {
  id: string;
  problemId: string;
  authorId?: string | null;
  title: string;
  content: string;
  isPublished: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sections?: EditorialSection[];
  officialSolutions?: EditorialOfficialSolution[];
}

export interface EditorialSection {
  id: string;
  editorialId: string;
  type: EditorialSectionType;
  title: string;
  content: string;
  language?: string | null;
  order: number;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionVote {
  id: string;
  discussionId: string;
  userId: string;
  value: 1 | -1;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface SolutionVote {
  id: string;
  solutionId: string;
  userId: string;
  value: 1 | -1;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningCollection {
  id: string;
  type: LearningCollectionType;
  slug: string;
  title: string;
  description: string;
  badge?: string | null;
  dailyUnlockCount: number;
  visibility: ProblemVisibility;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningCollectionItem {
  id: string;
  collectionId: string;
  problemId: string;
  order: number;
  note?: string | null;
  createdAt: Date;
}

export interface LearningCollectionProgress {
  id: string;
  collectionId: string;
  userId: string;
  startedAt: Date;
  lastViewedAt: Date;
  unlockedCount: number;
  completedCount: number;
  completedAt?: Date | null;
}

export interface DailyChallenge {
  id: string;
  date: Date;
  problemId: string;
  assignedById?: string | null;
  rewardXp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyChallengeCompletion {
  id: string;
  challengeId: string;
  userId: string;
  problemId: string;
  submissionId?: string | null;
  completedAt: Date;
  xpAwarded: number;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  sourceType?: string | null;
  sourceId?: string | null;
  awardedAt: Date;
  badge?: BadgeDefinition;
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
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
}

export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  readAt?: Date | null;
  createdAt: Date;
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
  outcome: AuditOutcome;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface ApiUsageEvent {
  id: string;
  userId?: string | null;
  method: string;
  path: string;
  route?: string | null;
  statusCode: number;
  durationMs: number;
  ip?: string | null;
  userAgent?: string | null;
  rateLimited: boolean;
  createdAt: Date;
}

export interface BackupRun {
  id: string;
  requestedById?: string | null;
  status: BackupStatus;
  filename?: string | null;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
}

export interface HealthCheckSnapshot {
  id: string;
  status: HealthStatus;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface UserRating {
  id: string;
  userId: string;
  rating: number;
  volatility: number;
  contestsRated: number;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
}

export interface PracticeSession {
  id: string;
  userId: string;
  type: PracticeSessionType;
  status: PracticeSessionStatus;
  title: string;
  durationSeconds: number;
  startedAt: Date;
  finishedAt?: Date | null;
  settings?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticeSessionProblem {
  id: string;
  sessionId: string;
  problemId: string;
  order: number;
  outcome?: PracticeOutcome | null;
  secondsSpent?: number | null;
  submissionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContestAnnouncement {
  id: string;
  contestId: string;
  authorId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContestRatingJob {
  id: string;
  contestId: string;
  requestedById?: string | null;
  status: RatingJobStatus;
  scheduledAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitoringAlert {
  id: string;
  status: MonitoringAlertStatus;
  severity: string;
  source: string;
  title: string;
  message: string;
  details?: Record<string, unknown> | null;
  acknowledgedById?: string | null;
  acknowledgedAt?: Date | null;
  resolvedById?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRankSnapshot {
  id: string;
  userId: string;
  rank: number;
  solvedCount: number;
  acceptanceRate: number;
  snapshotDate: Date;
  createdAt: Date;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
