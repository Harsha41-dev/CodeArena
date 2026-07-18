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
export type RankMovementDirection = "UP" | "DOWN" | "SAME" | "NEW";
export type ExecutorType = "MOCK" | "DOCKER" | "JUDGE0";
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
  createdAt: Date;
  updatedAt: Date;
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
}

export interface DiscussionVote {
  id: string;
  discussionId: string;
  userId: string;
  value: 1 | -1;
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
