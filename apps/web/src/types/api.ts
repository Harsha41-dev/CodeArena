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
  problems: Array<{ problemId: string; order: number; points: number }>;
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
  comments: Array<{ id: string; content: string; upvotes: number; createdAt: string; authorId?: string }>;
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
}

export interface Bookmark {
  id: string;
  userId: string;
  problemId: string;
  createdAt: string;
  problem: Problem;
}
