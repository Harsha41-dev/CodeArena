import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { problemFixtures } from "../constants/problemFixtures";
import { ApiError } from "../errors/ApiError";
import type {
  Bookmark,
  Contest,
  ContestProblem,
  ContestRegistration,
  ContestSubmission,
  Discussion,
  DiscussionComment,
  DiscussionVote,
  Editorial,
  GeneratedTestCaseBatch,
  Note,
  Problem,
  ProblemAsset,
  ProblemAssetType,
  ProblemList,
  ProblemListItem,
  ProblemSolvedStatus,
  ProblemStatus,
  RefreshTokenRecord,
  Submission,
  SubmissionStatus,
  SubmissionTestCaseResult,
  Tag,
  TestCase,
  TestCaseGenerationJob,
  User,
  UserRankSnapshot
} from "../types/domain";
import type {
  AppRepository,
  ContestLeaderboardRow,
  CreateProblemInput,
  CreateSubmissionInput,
  CreateSubmissionResultInput,
  CreateTestCaseInput,
  CreateUserInput,
  CreateGeneratedTestCaseBatchInput,
  CreateProblemAssetInput,
  CreateTestCaseGenerationJobInput,
  LeaderboardRow,
  ListUsersInput,
  ListSubmissionsInput,
  ProblemFilters,
  ProblemLeaderboardRow,
  UpdateProblemInput,
  UpdateTestCaseInput,
  UpdateProblemAssetInput,
  UpdateTestCaseGenerationJobInput,
  UpdateUserInput,
  UserStats
} from "./AppRepository";

// in-memory store used for tests + local runs without a DB
export class MemoryRepository implements AppRepository {
  private users: User[] = [];
  private refreshTokens: RefreshTokenRecord[] = [];
  private tags: Tag[] = [];
  private problems: Problem[] = [];
  private testCases: TestCase[] = [];
  private submissions: Submission[] = [];
  private submissionResults: SubmissionTestCaseResult[] = [];
  private solvedStatuses: ProblemSolvedStatus[] = [];
  private contests: Contest[] = [];
  private contestProblems: ContestProblem[] = [];
  private contestRegistrations: ContestRegistration[] = [];
  private contestSubmissions: ContestSubmission[] = [];
  private editorials: Editorial[] = [];
  private discussions: Discussion[] = [];
  private comments: DiscussionComment[] = [];
  private discussionVotes: DiscussionVote[] = [];
  private bookmarks: Bookmark[] = [];
  private problemLists: ProblemList[] = [];
  private problemListItems: ProblemListItem[] = [];
  private notes: Note[] = [];
  private rankSnapshots: UserRankSnapshot[] = [];
  private problemAssets: ProblemAsset[] = [];
  private testCaseGenerationJobs: TestCaseGenerationJob[] = [];
  private generatedTestCaseBatches: GeneratedTestCaseBatch[] = [];

  constructor(seed = true) {
    // seed demo problems/users so the app is usable without prisma
    if (seed) {
      this.seed();
    }
  }

  async healthCheck(): Promise<{ driver: "memory"; ok: boolean; message?: string }> {
    // memory repo is always "up"
    return { driver: "memory", ok: true };
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const now = new Date();
    let role = input.role;
    if (!role) {
      role = "USER";
    }

    const user: User = {
      id: uuid(),
      email: input.email.toLowerCase(),
      username: input.username,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role,
      status: "ACTIVE",
      bio: null,
      avatarUrl: null,
      country: null,
      countryCode: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.users.push(user);
    return user;
  }

  async findUserById(id: string): Promise<User | null> {
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].id === id) {
        return this.users[i];
      }
    }
    return null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].email === normalized) {
        return this.users[i];
      }
    }
    return null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].username === username) {
        return this.users[i];
      }
    }
    return null;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = this.requireUser(id);
    Object.assign(user, input, { updatedAt: new Date() });
    return user;
  }

  async listUsers(input: ListUsersInput): Promise<{ items: User[]; total: number; page: number; limit: number }>;
  async listUsers(): Promise<User[]>;
  async listUsers(input?: ListUsersInput) {
    // start with non-deleted users
    let items: User[] = [];
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].status !== "DELETED") {
        items.push(this.users[i]);
      }
    }

    if (input && input.role) {
      const role = input.role;
      const filtered: User[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].role === role) {
          filtered.push(items[i]);
        }
      }
      items = filtered;
    }

    if (input && input.status) {
      const status = input.status;
      const filtered: User[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === status) {
          filtered.push(items[i]);
        }
      }
      items = filtered;
    }

    if (input && input.search) {
      const needle = input.search.toLowerCase();
      const filtered: User[] = [];
      for (let i = 0; i < items.length; i++) {
        const user = items[i];
        const matchUsername = user.username.toLowerCase().includes(needle);
        const matchEmail = user.email.toLowerCase().includes(needle);
        const matchName = user.displayName.toLowerCase().includes(needle);
        if (matchUsername || matchEmail || matchName) {
          filtered.push(user);
        }
      }
      items = filtered;
    }

    // newest first
    items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // no pagination args → return full array (used by some admin helpers)
    if (!input) {
      return items;
    }

    const start = (input.page - 1) * input.limit;
    return {
      items: items.slice(start, start + input.limit),
      total: items.length,
      page: input.page,
      limit: input.limit
    };
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenRecord> {
    const token: RefreshTokenRecord = {
      id: uuid(),
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: new Date()
    };
    this.refreshTokens.push(token);
    return token;
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (let i = 0; i < this.refreshTokens.length; i++) {
      if (this.refreshTokens[i].tokenHash === tokenHash) {
        return this.refreshTokens[i];
      }
    }
    return null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    for (let i = 0; i < this.refreshTokens.length; i++) {
      if (this.refreshTokens[i].tokenHash === tokenHash) {
        this.refreshTokens[i].revokedAt = new Date();
        break;
      }
    }
  }

  async listProblems(filters: ProblemFilters) {
    const page = filters.page;
    const limit = filters.limit;
    const statusByProblem = new Map<string, ProblemStatus>();

    // if we know the user, attach solved/attempted status
    if (filters.userId) {
      for (let i = 0; i < this.solvedStatuses.length; i++) {
        const status = this.solvedStatuses[i];
        if (status.userId !== filters.userId) {
          continue;
        }
        let problemStatus: ProblemStatus = "NOT_ATTEMPTED";
        if (status.solved) {
          problemStatus = "SOLVED";
        } else if (status.attempted) {
          problemStatus = "ATTEMPTED";
        }
        statusByProblem.set(status.problemId, problemStatus);
      }
    }

    // only public problems on the list endpoint
    let items: Problem[] = [];
    for (let i = 0; i < this.problems.length; i++) {
      if (this.problems[i].visibility === "PUBLIC") {
        items.push(this.problems[i]);
      }
    }

    if (filters.difficulty) {
      const difficulty = filters.difficulty;
      const filtered: Problem[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].difficulty === difficulty) {
          filtered.push(items[i]);
        }
      }
      items = filtered;
    }

    if (filters.tag) {
      const tagFilter = filters.tag;
      const filtered: Problem[] = [];
      for (let i = 0; i < items.length; i++) {
        const problem = items[i];
        let hasTag = false;
        for (let j = 0; j < problem.tags.length; j++) {
          const tag = problem.tags[j];
          if (tag.slug === tagFilter || tag.name.toLowerCase() === tagFilter.toLowerCase()) {
            hasTag = true;
            break;
          }
        }
        if (hasTag) {
          filtered.push(problem);
        }
      }
      items = filtered;
    }

    if (filters.search) {
      const needle = filters.search.toLowerCase();
      const filtered: Problem[] = [];
      for (let i = 0; i < items.length; i++) {
        const problem = items[i];
        if (problem.title.toLowerCase().includes(needle) || problem.slug.includes(needle)) {
          filtered.push(problem);
        }
      }
      items = filtered;
    }

    // attach status for the requesting user
    const enriched = [];
    for (let i = 0; i < items.length; i++) {
      const problem = items[i];
      const status = statusByProblem.get(problem.id) ?? "NOT_ATTEMPTED";
      enriched.push({
        ...problem,
        status
      });
    }

    let statusFiltered = enriched;
    if (filters.status) {
      statusFiltered = [];
      for (let i = 0; i < enriched.length; i++) {
        if (enriched[i].status === filters.status) {
          statusFiltered.push(enriched[i]);
        }
      }
    }

    const start = (page - 1) * limit;
    return {
      items: statusFiltered.slice(start, start + limit),
      total: statusFiltered.length,
      page,
      limit
    };
  }

  async findProblemBySlug(slug: string): Promise<Problem | null> {
    return this.problems.find((problem) => problem.slug === slug) ?? null;
  }

  async findProblemById(id: string): Promise<Problem | null> {
    return this.problems.find((problem) => problem.id === id) ?? null;
  }

  async createProblem(input: CreateProblemInput): Promise<Problem> {
    if (this.problems.some((problem) => problem.slug === input.slug)) {
      throw ApiError.conflict("Problem slug already exists");
    }
    const now = new Date();
    const tags = this.ensureTags(input.tags);
    const problem: Problem = {
      id: uuid(),
      slug: input.slug,
      title: input.title,
      difficulty: input.difficulty,
      description: input.description,
      constraints: input.constraints,
      inputFormat: input.inputFormat,
      outputFormat: input.outputFormat,
      starterCode: input.starterCode,
      solution: null,
      visibility: input.visibility,
      checkerMode: input.checkerMode ?? "STANDARD",
      timeLimitMs: input.timeLimitMs,
      memoryLimitMb: input.memoryLimitMb,
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now,
      tags
    };
    this.problems.push(problem);
    return problem;
  }

  async updateProblem(id: string, input: UpdateProblemInput): Promise<Problem> {
    const problem = this.requireProblem(id);
    const updatedTags = input.tags ? this.ensureTags(input.tags) : problem.tags;
    Object.assign(problem, input, { tags: updatedTags, updatedAt: new Date() });
    return problem;
  }

  async archiveProblem(id: string): Promise<void> {
    const problem = this.requireProblem(id);
    problem.visibility = "ARCHIVED";
    problem.updatedAt = new Date();
  }

  async listTags(): Promise<Tag[]> {
    return [...this.tags].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listTestCases(problemId: string, samplesOnly = false): Promise<TestCase[]> {
    return this.testCases
      .filter((testCase) => testCase.problemId === problemId && (!samplesOnly || testCase.isSample))
      .sort((a, b) => a.order - b.order);
  }

  async addTestCase(input: CreateTestCaseInput): Promise<TestCase> {
    this.requireProblem(input.problemId);
    const now = new Date();
    const testCase: TestCase = {
      id: uuid(),
      ...input,
      batchId: input.batchId ?? null,
      generatedByJobId: input.generatedByJobId ?? null,
      explanation: input.explanation ?? null,
      inputHash: input.inputHash ?? null,
      outputHash: input.outputHash ?? null,
      generatorSeed: input.generatorSeed ?? null,
      isGenerated: input.isGenerated ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.testCases.push(testCase);
    return testCase;
  }

  async updateTestCase(id: string, input: UpdateTestCaseInput): Promise<TestCase> {
    const testCase = this.requireTestCase(id);
    Object.assign(testCase, input, { updatedAt: new Date() });
    return testCase;
  }

  async deleteTestCase(id: string): Promise<void> {
    this.testCases = this.testCases.filter((testCase) => testCase.id !== id);
  }

  async findTestCaseByInputHash(problemId: string, inputHash: string): Promise<TestCase | null> {
    return (
      this.testCases.find((testCase) => testCase.problemId === problemId && testCase.inputHash === inputHash) ?? null
    );
  }

  async deleteGeneratedTestCases(problemId: string): Promise<void> {
    this.testCases = this.testCases.filter((testCase) => !(testCase.problemId === problemId && testCase.isGenerated));
    this.generatedTestCaseBatches = this.generatedTestCaseBatches.filter((batch) => batch.problemId !== problemId);
  }

  async listProblemAssets(problemId: string): Promise<ProblemAsset[]> {
    return this.problemAssets
      .filter((asset) => asset.problemId === problemId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async findProblemAssetById(id: string): Promise<ProblemAsset | null> {
    return this.problemAssets.find((asset) => asset.id === id) ?? null;
  }

  async findActiveProblemAsset(problemId: string, type: ProblemAssetType): Promise<ProblemAsset | null> {
    return (
      [...this.problemAssets]
        .filter((asset) => asset.problemId === problemId && asset.type === type && asset.isActive)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
    );
  }

  async createProblemAsset(input: CreateProblemAssetInput): Promise<ProblemAsset> {
    this.requireProblem(input.problemId);
    this.problemAssets
      .filter((asset) => asset.problemId === input.problemId && asset.type === input.type)
      .forEach((asset) => {
        asset.isActive = false;
        asset.updatedAt = new Date();
      });
    const now = new Date();
    const asset: ProblemAsset = {
      id: uuid(),
      ...input,
      languageId: input.languageId ?? null,
      languageVersionId: input.languageVersionId ?? null,
      createdById: input.createdById ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    this.problemAssets.push(asset);
    return asset;
  }

  async updateProblemAsset(id: string, input: UpdateProblemAssetInput): Promise<ProblemAsset> {
    const asset = this.requireProblemAsset(id);
    if (Object.prototype.hasOwnProperty.call(input, "languageId")) asset.languageId = input.languageId ?? null;
    if (Object.prototype.hasOwnProperty.call(input, "languageVersionId"))
      asset.languageVersionId = input.languageVersionId ?? null;
    if (input.filename !== undefined) asset.filename = input.filename;
    if (input.sourceCode !== undefined) asset.sourceCode = input.sourceCode;
    if (input.isActive !== undefined) asset.isActive = input.isActive;
    asset.updatedAt = new Date();
    return asset;
  }

  async deactivateProblemAsset(id: string): Promise<void> {
    const asset = this.requireProblemAsset(id);
    asset.isActive = false;
    asset.updatedAt = new Date();
  }

  async createTestCaseGenerationJob(input: CreateTestCaseGenerationJobInput): Promise<TestCaseGenerationJob> {
    this.requireProblem(input.problemId);
    const now = new Date();
    const job: TestCaseGenerationJob = {
      id: uuid(),
      problemId: input.problemId,
      requestedById: input.requestedById,
      config: input.config,
      totalCases: input.totalCases,
      generatedCases: 0,
      status: "PENDING",
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    this.testCaseGenerationJobs.push(job);
    return job;
  }

  async listTestCaseGenerationJobs(problemId: string): Promise<TestCaseGenerationJob[]> {
    return this.testCaseGenerationJobs
      .filter((job) => job.problemId === problemId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findTestCaseGenerationJobById(id: string): Promise<TestCaseGenerationJob | null> {
    return this.testCaseGenerationJobs.find((job) => job.id === id) ?? null;
  }

  async updateTestCaseGenerationJob(
    id: string,
    input: UpdateTestCaseGenerationJobInput
  ): Promise<TestCaseGenerationJob> {
    const job = this.requireGenerationJob(id);
    Object.assign(job, input, { updatedAt: new Date() });
    return job;
  }

  async createGeneratedTestCaseBatch(input: CreateGeneratedTestCaseBatchInput): Promise<GeneratedTestCaseBatch> {
    this.requireProblem(input.problemId);
    this.requireGenerationJob(input.jobId);
    const batch: GeneratedTestCaseBatch = {
      id: uuid(),
      problemId: input.problemId,
      jobId: input.jobId,
      name: input.name,
      description: input.description ?? null,
      createdById: input.createdById ?? null,
      createdAt: new Date()
    };
    this.generatedTestCaseBatches.push(batch);
    return batch;
  }

  async listGeneratedTestCaseBatches(problemId: string): Promise<GeneratedTestCaseBatch[]> {
    return this.generatedTestCaseBatches
      .filter((batch) => batch.problemId === problemId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((batch) => ({
        ...batch,
        testCases: this.testCases.filter((testCase) => testCase.batchId === batch.id)
      }));
  }

  async findGeneratedTestCaseBatchById(id: string): Promise<GeneratedTestCaseBatch | null> {
    const batch = this.generatedTestCaseBatches.find((item) => item.id === id);
    return batch ? { ...batch, testCases: this.testCases.filter((testCase) => testCase.batchId === batch.id) } : null;
  }

  async deleteGeneratedTestCaseBatch(id: string): Promise<void> {
    this.requireGeneratedBatch(id);
    this.testCases = this.testCases.filter((testCase) => testCase.batchId !== id);
    this.generatedTestCaseBatches = this.generatedTestCaseBatches.filter((batch) => batch.id !== id);
  }

  async createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    const now = new Date();
    const submission: Submission = {
      id: uuid(),
      ...input,
      status: "PENDING",
      runtimeMs: null,
      memoryKb: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    this.submissions.push(submission);
    return submission;
  }

  async findSubmissionById(id: string): Promise<Submission | null> {
    return this.submissions.find((submission) => submission.id === id) ?? null;
  }

  async listSubmissions(input: ListSubmissionsInput) {
    let items = [...this.submissions];
    if (input.userId) items = items.filter((submission) => submission.userId === input.userId);
    if (input.problemId) items = items.filter((submission) => submission.problemId === input.problemId);
    if (input.status) items = items.filter((submission) => submission.status === input.status);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return {
      items: items.slice(start, start + input.limit),
      total: items.length,
      page: input.page,
      limit: input.limit
    };
  }

  async updateSubmission(
    id: string,
    patch: Partial<Pick<Submission, "status" | "runtimeMs" | "memoryKb" | "errorMessage" | "completedAt">>
  ): Promise<Submission> {
    const submission = this.requireSubmission(id);
    Object.assign(submission, patch, { updatedAt: new Date() });
    return submission;
  }

  async clearSubmissionResults(submissionId: string): Promise<void> {
    this.submissionResults = this.submissionResults.filter((result) => result.submissionId !== submissionId);
  }

  async addSubmissionResult(input: CreateSubmissionResultInput): Promise<SubmissionTestCaseResult> {
    const result: SubmissionTestCaseResult = {
      id: uuid(),
      ...input,
      testCaseId: input.testCaseId ?? null,
      stderr: input.stderr ?? null,
      runtimeMs: input.runtimeMs ?? null,
      memoryKb: input.memoryKb ?? null,
      createdAt: new Date()
    };
    this.submissionResults.push(result);
    return result;
  }

  async getSubmissionResults(submissionId: string): Promise<SubmissionTestCaseResult[]> {
    return this.submissionResults.filter((result) => result.submissionId === submissionId);
  }

  async upsertSolvedStatus(userId: string, problemId: string, solved: boolean): Promise<ProblemSolvedStatus> {
    let status = this.solvedStatuses.find((item) => item.userId === userId && item.problemId === problemId);
    const now = new Date();
    if (!status) {
      status = {
        id: uuid(),
        userId,
        problemId,
        attempted: true,
        solved,
        attempts: 1,
        firstSolvedAt: solved ? now : null,
        lastSubmittedAt: now
      };
      this.solvedStatuses.push(status);
      return status;
    }
    status.attempted = true;
    status.solved = status.solved || solved;
    status.attempts += 1;
    status.firstSolvedAt = status.firstSolvedAt ?? (solved ? now : null);
    status.lastSubmittedAt = now;
    return status;
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const userSubmissions = this.submissions.filter((submission) => submission.userId === userId);
    const statuses = this.solvedStatuses.filter((status) => status.userId === userId);
    const languageStats: Record<string, number> = {};
    for (const submission of userSubmissions) {
      const key = submission.languageNameSnapshot ?? submission.languageKeySnapshot ?? submission.language;
      languageStats[key] = (languageStats[key] ?? 0) + 1;
    }
    const difficultyStats = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0
    };
    for (const status of statuses.filter((item) => item.solved)) {
      const problem = this.problems.find((item) => item.id === status.problemId);
      if (problem) difficultyStats[problem.difficulty] += 1;
    }
    const acceptedSubmissions = userSubmissions.filter((submission) => submission.status === "ACCEPTED");
    const submissionCalendar = this.buildSubmissionCalendar(acceptedSubmissions);
    const { currentStreak, longestStreak } = this.calculateStreaks(submissionCalendar.map((item) => item.date));
    return {
      solvedCount: statuses.filter((status) => status.solved).length,
      attemptedCount: statuses.filter((status) => status.attempted).length,
      submissionsCount: userSubmissions.length,
      totalSubmissions: userSubmissions.length,
      acceptedSubmissions: acceptedSubmissions.length,
      acceptanceRate: userSubmissions.length
        ? Math.round((acceptedSubmissions.length / userSubmissions.length) * 100)
        : 0,
      currentStreak,
      longestStreak,
      easySolved: difficultyStats.EASY,
      mediumSolved: difficultyStats.MEDIUM,
      hardSolved: difficultyStats.HARD,
      submissionCalendar,
      languageStats,
      difficultyStats
    };
  }

  async listContests(): Promise<Array<Contest & { problems: ContestProblem[] }>> {
    return this.contests.map((contest) => ({
      ...contest,
      problems: this.contestProblems.filter((item) => item.contestId === contest.id)
    }));
  }

  async findContestById(id: string): Promise<(Contest & { problems: ContestProblem[] }) | null> {
    const contest = this.contests.find((item) => item.id === id);
    if (!contest) return null;
    return {
      ...contest,
      problems: this.contestProblems.filter((item) => item.contestId === contest.id)
    };
  }

  async createContest(input: {
    title: string;
    slug: string;
    description: string;
    startTime: Date;
    endTime: Date;
    createdById?: string | null;
    problemIds: string[];
    visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  }): Promise<Contest> {
    if (this.contests.some((contest) => contest.slug === input.slug)) {
      throw ApiError.conflict("Contest slug already exists");
    }
    const now = new Date();
    const contest: Contest = {
      id: uuid(),
      title: input.title,
      slug: input.slug,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      status: this.deriveContestStatus(input.startTime, input.endTime),
      visibility: input.visibility ?? "PUBLIC",
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.contests.push(contest);
    input.problemIds.forEach((problemId, index) => {
      this.contestProblems.push({ id: uuid(), contestId: contest.id, problemId, order: index + 1, points: 100 });
    });
    return contest;
  }

  async updateContest(
    id: string,
    input: Partial<Pick<Contest, "title" | "slug" | "description" | "startTime" | "endTime" | "status" | "visibility">>
  ): Promise<Contest & { problems: ContestProblem[] }> {
    const contest = this.requireContest(id);
    if (input.slug && this.contests.some((item) => item.id !== id && item.slug === input.slug)) {
      throw ApiError.conflict("Contest slug already exists");
    }
    Object.assign(contest, input, { updatedAt: new Date() });
    return {
      ...contest,
      problems: this.contestProblems.filter((item) => item.contestId === contest.id)
    };
  }

  async deleteContest(id: string): Promise<void> {
    this.requireContest(id);
    this.contests = this.contests.filter((contest) => contest.id !== id);
    this.contestProblems = this.contestProblems.filter((item) => item.contestId !== id);
    this.contestRegistrations = this.contestRegistrations.filter((item) => item.contestId !== id);
    this.contestSubmissions = this.contestSubmissions.filter((item) => item.contestId !== id);
  }

  async addContestProblem(contestId: string, problemId: string, points: number): Promise<ContestProblem> {
    this.requireContest(contestId);
    this.requireProblem(problemId);
    const existing = this.contestProblems.find((item) => item.contestId === contestId && item.problemId === problemId);
    if (existing) throw ApiError.conflict("Problem is already assigned to this contest");
    const order = this.contestProblems.filter((item) => item.contestId === contestId).length + 1;
    const contestProblem = { id: uuid(), contestId, problemId, order, points };
    this.contestProblems.push(contestProblem);
    return contestProblem;
  }

  async removeContestProblem(contestId: string, problemId: string): Promise<void> {
    this.requireContest(contestId);
    this.contestProblems = this.contestProblems.filter(
      (item) => !(item.contestId === contestId && item.problemId === problemId)
    );
  }

  async registerForContest(contestId: string, userId: string): Promise<ContestRegistration> {
    const existing = this.contestRegistrations.find((item) => item.contestId === contestId && item.userId === userId);
    if (existing) return existing;
    const registration = { id: uuid(), contestId, userId, registeredAt: new Date() };
    this.contestRegistrations.push(registration);
    return registration;
  }

  async isContestRegistered(contestId: string, userId: string): Promise<boolean> {
    return this.contestRegistrations.some((item) => item.contestId === contestId && item.userId === userId);
  }

  async addContestSubmission(input: {
    contestId: string;
    userId: string;
    problemId: string;
    submissionId: string;
    status: SubmissionStatus;
    penaltyMinutes: number;
  }): Promise<ContestSubmission> {
    const contestSubmission: ContestSubmission = {
      id: uuid(),
      ...input,
      submittedAt: new Date()
    };
    this.contestSubmissions.push(contestSubmission);
    return contestSubmission;
  }

  async updateContestSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus,
    penaltyMinutes?: number
  ): Promise<void> {
    const contestSubmission = this.contestSubmissions.find((item) => item.submissionId === submissionId);
    if (contestSubmission) {
      contestSubmission.status = status;
      if (penaltyMinutes !== undefined) contestSubmission.penaltyMinutes = penaltyMinutes;
    }
  }

  async getGlobalLeaderboard(): Promise<LeaderboardRow[]> {
    const rows = await Promise.all(
      this.users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return {
          user: this.publicLeaderboardUser(user),
          solvedCount: stats.solvedCount,
          acceptedSubmissions: stats.acceptedSubmissions,
          acceptanceRate: stats.acceptanceRate,
          rank: 0
        };
      })
    );
    return rows
      .sort((a, b) => b.solvedCount - a.solvedCount || b.acceptedSubmissions - a.acceptedSubmissions)
      .map((row, index) => this.withRankMovement({ ...row, rank: index + 1, currentRank: index + 1 }));
  }

  async generateLeaderboardSnapshot(snapshotDate = new Date()): Promise<UserRankSnapshot[]> {
    const rows = await this.getGlobalLeaderboard();
    const normalizedDate = this.dayKey(snapshotDate);
    this.rankSnapshots = this.rankSnapshots.filter((snapshot) => this.dayKey(snapshot.snapshotDate) !== normalizedDate);
    const snapshots = rows.map((row) => ({
      id: uuid(),
      userId: row.user.id,
      rank: row.rank,
      solvedCount: row.solvedCount,
      acceptanceRate: row.acceptanceRate,
      snapshotDate,
      createdAt: new Date()
    }));
    this.rankSnapshots.push(...snapshots);
    return snapshots;
  }

  async getProblemLeaderboard(problemId: string): Promise<ProblemLeaderboardRow[]> {
    const accepted = this.submissions
      .filter((submission) => submission.problemId === problemId && submission.status === "ACCEPTED")
      .sort((a, b) => (a.runtimeMs ?? Number.MAX_SAFE_INTEGER) - (b.runtimeMs ?? Number.MAX_SAFE_INTEGER));
    const fastestByUser = new Map<string, Submission>();
    for (const submission of accepted) {
      if (!fastestByUser.has(submission.userId)) fastestByUser.set(submission.userId, submission);
    }
    return [...fastestByUser.values()].map((submission, index) => {
      const user = this.requireUser(submission.userId);
      return {
        user: this.publicLeaderboardUser(user),
        runtimeMs: submission.runtimeMs ?? 0,
        memoryKb: submission.memoryKb ?? 0,
        submittedAt: submission.completedAt ?? submission.updatedAt,
        rank: index + 1
      };
    });
  }

  async getContestLeaderboard(contestId: string): Promise<ContestLeaderboardRow[]> {
    const byUser = new Map<string, { solved: Set<string>; penalty: number }>();
    for (const item of this.contestSubmissions.filter((submission) => submission.contestId === contestId)) {
      const entry = byUser.get(item.userId) ?? { solved: new Set<string>(), penalty: 0 };
      if (item.status === "ACCEPTED" && !entry.solved.has(item.problemId)) {
        entry.solved.add(item.problemId);
        entry.penalty += item.penaltyMinutes;
      }
      byUser.set(item.userId, entry);
    }
    return [...byUser.entries()]
      .map(([userId, entry]) => ({
        user: this.publicLeaderboardUser(this.requireUser(userId)),
        solvedCount: entry.solved.size,
        penaltyMinutes: entry.penalty,
        rank: 0
      }))
      .sort((a, b) => b.solvedCount - a.solvedCount || a.penaltyMinutes - b.penaltyMinutes)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async getEditorial(problemId: string, includeDraft = false): Promise<Editorial | null> {
    const editorial = this.editorials.find((item) => item.problemId === problemId) ?? null;
    if (!editorial) return null;
    return includeDraft || editorial.isPublished ? editorial : null;
  }

  async upsertEditorial(input: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isPublished?: boolean;
  }): Promise<Editorial> {
    this.requireProblem(input.problemId);
    const existing = this.editorials.find((item) => item.problemId === input.problemId);
    const now = new Date();
    if (existing) {
      Object.assign(existing, {
        title: input.title,
        content: input.content,
        authorId: input.authorId,
        isPublished: input.isPublished ?? existing.isPublished,
        publishedAt: input.isPublished ? (existing.publishedAt ?? now) : existing.publishedAt,
        updatedAt: now
      });
      return existing;
    }
    const editorial: Editorial = {
      id: uuid(),
      problemId: input.problemId,
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      isPublished: input.isPublished ?? false,
      publishedAt: input.isPublished ? now : null,
      createdAt: now,
      updatedAt: now
    };
    this.editorials.push(editorial);
    return editorial;
  }

  async updateEditorial(id: string, input: { title?: string; content?: string }): Promise<Editorial> {
    const editorial = this.requireEditorial(id);
    Object.assign(editorial, input, { updatedAt: new Date() });
    return editorial;
  }

  async deleteEditorial(id: string): Promise<void> {
    this.requireEditorial(id);
    this.editorials = this.editorials.filter((editorial) => editorial.id !== id);
  }

  async setEditorialPublished(id: string, isPublished: boolean): Promise<Editorial> {
    const editorial = this.requireEditorial(id);
    editorial.isPublished = isPublished;
    editorial.publishedAt = isPublished ? (editorial.publishedAt ?? new Date()) : null;
    editorial.updatedAt = new Date();
    return editorial;
  }

  async listDiscussions(input: {
    problemId?: string | null;
    contestId?: string | null;
    page: number;
    limit: number;
    search?: string;
  }) {
    let items = this.discussions.filter((discussion) => {
      if (input.problemId !== undefined) return discussion.problemId === input.problemId;
      if (input.contestId !== undefined) return discussion.contestId === input.contestId;
      return !discussion.problemId && !discussion.contestId;
    });
    if (input.search) {
      const needle = input.search.toLowerCase();
      items = items.filter(
        (discussion) =>
          discussion.title.toLowerCase().includes(needle) ||
          discussion.content.toLowerCase().includes(needle) ||
          discussion.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    }
    items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return {
      items: items.slice(start, start + input.limit).map((discussion) => this.withDiscussionRelations(discussion)),
      total: items.length,
      page: input.page,
      limit: input.limit
    };
  }

  async findDiscussionById(id: string) {
    const discussion = this.discussions.find((item) => item.id === id);
    return discussion ? this.withDiscussionRelations(discussion) : null;
  }

  async createDiscussion(input: {
    problemId?: string | null;
    contestId?: string | null;
    authorId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<Discussion> {
    const now = new Date();
    const discussion: Discussion = {
      id: uuid(),
      ...input,
      problemId: input.problemId ?? null,
      contestId: input.contestId ?? null,
      tags: input.tags ?? [],
      upvotes: 0,
      downvotes: 0,
      createdAt: now,
      updatedAt: now
    };
    this.discussions.push(discussion);
    return discussion;
  }

  async addDiscussionComment(input: {
    discussionId: string;
    authorId: string;
    content: string;
  }): Promise<DiscussionComment> {
    this.requireDiscussion(input.discussionId);
    const now = new Date();
    const comment: DiscussionComment = {
      id: uuid(),
      ...input,
      upvotes: 0,
      createdAt: now,
      updatedAt: now
    };
    this.comments.push(comment);
    return comment;
  }

  async updateDiscussion(
    id: string,
    authorId: string,
    isAdmin: boolean,
    patch: { title?: string; content?: string; tags?: string[] }
  ): Promise<Discussion> {
    const discussion = this.requireDiscussion(id);
    if (!isAdmin && discussion.authorId !== authorId)
      throw ApiError.forbidden("Only the author can update this discussion");
    Object.assign(discussion, patch, { updatedAt: new Date() });
    return discussion;
  }

  async deleteDiscussion(id: string, authorId: string, isAdmin: boolean): Promise<void> {
    const discussion = this.requireDiscussion(id);
    if (!isAdmin && discussion.authorId !== authorId)
      throw ApiError.forbidden("Only the author can delete this discussion");
    this.discussions = this.discussions.filter((item) => item.id !== id);
    this.comments = this.comments.filter((item) => item.discussionId !== id);
    this.discussionVotes = this.discussionVotes.filter((item) => item.discussionId !== id);
  }

  async updateDiscussionComment(
    id: string,
    authorId: string,
    isAdmin: boolean,
    content: string
  ): Promise<DiscussionComment> {
    const comment = this.requireDiscussionComment(id);
    if (!isAdmin && comment.authorId !== authorId) throw ApiError.forbidden("Only the author can update this comment");
    comment.content = content;
    comment.updatedAt = new Date();
    return comment;
  }

  async deleteDiscussionComment(id: string, authorId: string, isAdmin: boolean): Promise<void> {
    const comment = this.requireDiscussionComment(id);
    if (!isAdmin && comment.authorId !== authorId) throw ApiError.forbidden("Only the author can delete this comment");
    this.comments = this.comments.filter((item) => item.id !== id);
  }

  async voteDiscussion(discussionId: string, userId: string, value: 1 | -1): Promise<DiscussionVote> {
    const discussion = this.requireDiscussion(discussionId);
    let vote = this.discussionVotes.find((item) => item.discussionId === discussionId && item.userId === userId);
    const now = new Date();
    if (!vote) {
      vote = { id: uuid(), discussionId, userId, value, createdAt: now, updatedAt: now };
      this.discussionVotes.push(vote);
    } else {
      vote.value = value;
      vote.updatedAt = now;
    }
    const votes = this.discussionVotes.filter((item) => item.discussionId === discussionId);
    discussion.upvotes = votes.filter((item) => item.value === 1).length;
    discussion.downvotes = votes.filter((item) => item.value === -1).length;
    discussion.updatedAt = now;
    return vote;
  }

  async listBookmarks(userId: string): Promise<Array<Bookmark & { problem: Problem }>> {
    return this.bookmarks
      .filter((bookmark) => bookmark.userId === userId)
      .map((bookmark) => ({ ...bookmark, problem: this.requireProblem(bookmark.problemId) }));
  }

  async addBookmark(userId: string, problemId: string): Promise<Bookmark> {
    const existing = this.bookmarks.find((item) => item.userId === userId && item.problemId === problemId);
    if (existing) return existing;
    const bookmark = { id: uuid(), userId, problemId, createdAt: new Date() };
    this.bookmarks.push(bookmark);
    return bookmark;
  }

  async removeBookmark(userId: string, problemId: string): Promise<void> {
    this.bookmarks = this.bookmarks.filter((item) => !(item.userId === userId && item.problemId === problemId));
  }

  async listProblemLists(userId: string): Promise<Array<ProblemList & { items: ProblemListItem[] }>> {
    return this.problemLists
      .filter((list) => list.userId === userId)
      .map((list) => ({ ...list, items: this.problemListItems.filter((item) => item.problemListId === list.id) }));
  }

  async createProblemList(input: {
    userId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<ProblemList> {
    const now = new Date();
    const list: ProblemList = {
      id: uuid(),
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.problemLists.push(list);
    return list;
  }

  async addProblemToList(problemListId: string, problemId: string): Promise<ProblemListItem> {
    const existing = this.problemListItems.find(
      (item) => item.problemListId === problemListId && item.problemId === problemId
    );
    if (existing) return existing;
    const item: ProblemListItem = {
      id: uuid(),
      problemListId,
      problemId,
      order: this.problemListItems.filter((listItem) => listItem.problemListId === problemListId).length + 1,
      createdAt: new Date()
    };
    this.problemListItems.push(item);
    return item;
  }

  async removeProblemFromList(problemListId: string, problemId: string): Promise<void> {
    this.problemListItems = this.problemListItems.filter(
      (item) => !(item.problemListId === problemListId && item.problemId === problemId)
    );
  }

  async getNote(userId: string, problemId: string): Promise<Note | null> {
    return this.notes.find((note) => note.userId === userId && note.problemId === problemId) ?? null;
  }

  async upsertNote(userId: string, problemId: string, content: string): Promise<Note> {
    const existing = await this.getNote(userId, problemId);
    if (existing) {
      existing.content = content;
      existing.updatedAt = new Date();
      return existing;
    }
    const now = new Date();
    const note = { id: uuid(), userId, problemId, content, createdAt: now, updatedAt: now };
    this.notes.push(note);
    return note;
  }

  async updateNote(id: string, userId: string, content: string): Promise<Note> {
    const note = this.notes.find((item) => item.id === id && item.userId === userId);
    if (!note) throw ApiError.notFound("Note not found");
    note.content = content;
    note.updatedAt = new Date();
    return note;
  }

  async deleteNote(id: string, userId: string): Promise<void> {
    this.notes = this.notes.filter((note) => !(note.id === id && note.userId === userId));
  }

  private seed(): void {
    const admin: User = this.makeUser("admin@codearena.dev", "admin", "CodeArena Admin", "ADMIN");
    const user: User = this.makeUser("demo@codearena.dev", "demo", "Demo User", "USER");
    this.users.push(admin, user);

    for (const fixture of problemFixtures) {
      const tags = this.ensureTags(fixture.tags);
      const now = new Date();
      const problem: Problem = {
        id: uuid(),
        slug: fixture.slug,
        title: fixture.title,
        difficulty: fixture.difficulty,
        description: fixture.description,
        constraints: fixture.constraints,
        inputFormat: fixture.inputFormat,
        outputFormat: fixture.outputFormat,
        starterCode: fixture.starterCode,
        solution: null,
        visibility: "PUBLIC",
        checkerMode: "STANDARD",
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        createdById: admin.id,
        createdAt: now,
        updatedAt: now,
        tags
      };
      this.problems.push(problem);
      this.editorials.push({
        id: uuid(),
        problemId: problem.id,
        authorId: admin.id,
        title: `${fixture.title} Editorial`,
        content: fixture.editorial,
        isPublished: true,
        publishedAt: now,
        createdAt: now,
        updatedAt: now
      });
      [
        ...fixture.sampleCases.map((item) => ({ ...item, isSample: true })),
        ...fixture.hiddenCases.map((item) => ({ ...item, isSample: false }))
      ].forEach((testCase, index) => {
        this.testCases.push({
          id: uuid(),
          problemId: problem.id,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isSample: testCase.isSample,
          isStrict: true,
          explanation:
            "explanation" in testCase && typeof testCase.explanation === "string" ? testCase.explanation : null,
          order: index + 1,
          batchId: null,
          generatedByJobId: null,
          inputHash: null,
          outputHash: null,
          generatorSeed: null,
          isGenerated: false,
          createdAt: now,
          updatedAt: now
        });
      });
    }

    const contestStart = new Date(Date.now() - 60 * 60 * 1000);
    const contestEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const contest: Contest = {
      id: uuid(),
      title: "CodeArena Starter Contest",
      slug: "starter-contest",
      description: "A short contest using the first three warm-up problems.",
      startTime: contestStart,
      endTime: contestEnd,
      status: "LIVE",
      visibility: "PUBLIC",
      createdById: admin.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.contests.push(contest);
    this.problems.slice(0, 3).forEach((problem, index) => {
      this.contestProblems.push({
        id: uuid(),
        contestId: contest.id,
        problemId: problem.id,
        order: index + 1,
        points: 100
      });
    });
    this.contestRegistrations.push({ id: uuid(), contestId: contest.id, userId: user.id, registeredAt: new Date() });
    const firstProblem = this.problems[0];
    if (firstProblem) {
      this.discussions.push({
        id: uuid(),
        problemId: firstProblem.id,
        contestId: null,
        authorId: user.id,
        title: "Hash map intuition",
        content: "The complement lookup is the key idea for linear time.",
        tags: ["two-sum", "hash-map"],
        upvotes: 3,
        downvotes: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    this.discussions.push({
      id: uuid(),
      problemId: null,
      contestId: null,
      authorId: user.id,
      title: "How should I warm up before a contest?",
      content: "I usually solve one implementation task and one binary-search task before a live contest.",
      tags: ["contest", "beginner"],
      upvotes: 2,
      downvotes: 0,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });
  }

  // seed helper — password is always Password123! for demo accounts
  private makeUser(email: string, username: string, displayName: string, role: "USER" | "ADMIN"): User {
    const now = new Date();

    let bio = "Practicing DSA";
    let country = "United States";
    let countryCode = "US";
    if (role === "ADMIN") {
      bio = "Platform administrator";
      country = "India";
      countryCode = "IN";
    }

    return {
      id: uuid(),
      email,
      username,
      displayName,
      passwordHash: bcrypt.hashSync("Password123!", 10),
      role,
      status: "ACTIVE",
      bio,
      avatarUrl: null,
      country,
      countryCode,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    };
  }

  // get-or-create tags by slug when seeding / creating problems
  private ensureTags(names: string[]): Tag[] {
    const result: Tag[] = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      slug = slug.replace(/(^-|-$)/g, "");

      let tag: Tag | undefined = undefined;
      for (let j = 0; j < this.tags.length; j++) {
        if (this.tags[j].slug === slug) {
          tag = this.tags[j];
          break;
        }
      }

      if (!tag) {
        tag = { id: uuid(), name, slug };
        this.tags.push(tag);
      }
      result.push(tag);
    }
    return result;
  }

  // heatmap calendar: count submissions per day
  private buildSubmissionCalendar(submissions: Submission[]): Array<{ date: string; count: number }> {
    const byDay = new Map<string, number>();

    for (let i = 0; i < submissions.length; i++) {
      const submission = submissions[i];
      let when = submission.createdAt;
      if (submission.updatedAt) {
        when = submission.updatedAt;
      }
      if (submission.completedAt) {
        when = submission.completedAt;
      }
      const day = this.dayKey(when);
      const prev = byDay.get(day) ?? 0;
      byDay.set(day, prev + 1);
    }

    const entries = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const result: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < entries.length; i++) {
      result.push({ date: entries[i][0], count: entries[i][1] });
    }
    return result;
  }

  private calculateStreaks(days: string[]): { currentStreak: number; longestStreak: number } {
    const uniqueDays = [...new Set(days)].sort();
    if (uniqueDays.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // longest run of consecutive calendar days
    let longestStreak = 1;
    let run = 1;
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let index = 1; index < uniqueDays.length; index += 1) {
      const previous = new Date(`${uniqueDays[index - 1]}T00:00:00.000Z`).getTime();
      const current = new Date(`${uniqueDays[index]}T00:00:00.000Z`).getTime();
      if (current - previous === oneDayMs) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longestStreak) {
        longestStreak = run;
      }
    }

    // current streak counts back from today
    const daySet = new Set(uniqueDays);
    let cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    let currentStreak = 0;
    while (daySet.has(this.dayKey(cursor))) {
      currentStreak += 1;
      cursor = new Date(cursor.getTime() - oneDayMs);
    }

    return { currentStreak, longestStreak };
  }

  private dayKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private withDiscussionRelations(discussion: Discussion): Discussion & {
    comments: DiscussionComment[];
    author: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  } {
    const author = this.requireUser(discussion.authorId);

    const comments: DiscussionComment[] = [];
    for (let i = 0; i < this.comments.length; i++) {
      if (this.comments[i].discussionId === discussion.id) {
        comments.push(this.comments[i]);
      }
    }

    return {
      ...discussion,
      comments,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl
      }
    };
  }

  // compare current rank against the latest snapshot for this user
  private withRankMovement(
    row: Omit<LeaderboardRow, "previousRank" | "rankMovement" | "rankMovementDirection">
  ): LeaderboardRow {
    const userSnapshots = [];
    for (let i = 0; i < this.rankSnapshots.length; i++) {
      if (this.rankSnapshots[i].userId === row.user.id) {
        userSnapshots.push(this.rankSnapshots[i]);
      }
    }
    userSnapshots.sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
    const previous = userSnapshots[0];

    if (!previous) {
      return {
        ...row,
        previousRank: null,
        rankMovement: 0,
        rankMovementDirection: "NEW"
      };
    }

    // positive movement means rank number went down (better)
    const movement = previous.rank - row.rank;
    let direction: "UP" | "DOWN" | "SAME" = "SAME";
    if (movement > 0) {
      direction = "UP";
    } else if (movement < 0) {
      direction = "DOWN";
    }

    return {
      ...row,
      previousRank: previous.rank,
      rankMovement: Math.abs(movement),
      rankMovementDirection: direction
    };
  }

  // --- small require* helpers so call sites stay readable ---

  private requireUser(id: string): User {
    const user = this.users.find((item) => item.id === id);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return user;
  }

  private requireProblem(id: string): Problem {
    const problem = this.problems.find((item) => item.id === id);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }

  private requireTestCase(id: string): TestCase {
    const testCase = this.testCases.find((item) => item.id === id);
    if (!testCase) {
      throw ApiError.notFound("Test case not found");
    }
    return testCase;
  }

  private requireSubmission(id: string): Submission {
    const submission = this.submissions.find((item) => item.id === id);
    if (!submission) {
      throw ApiError.notFound("Submission not found");
    }
    return submission;
  }

  private requireContest(id: string): Contest {
    const contest = this.contests.find((item) => item.id === id);
    if (!contest) {
      throw ApiError.notFound("Contest not found");
    }
    return contest;
  }

  private requireDiscussion(id: string): Discussion {
    const discussion = this.discussions.find((item) => item.id === id);
    if (!discussion) {
      throw ApiError.notFound("Discussion not found");
    }
    return discussion;
  }

  private requireDiscussionComment(id: string): DiscussionComment {
    const comment = this.comments.find((item) => item.id === id);
    if (!comment) {
      throw ApiError.notFound("Discussion comment not found");
    }
    return comment;
  }

  private requireEditorial(id: string): Editorial {
    const editorial = this.editorials.find((item) => item.id === id);
    if (!editorial) {
      throw ApiError.notFound("Editorial not found");
    }
    return editorial;
  }

  private requireProblemAsset(id: string): ProblemAsset {
    const asset = this.problemAssets.find((item) => item.id === id);
    if (!asset) {
      throw ApiError.notFound("Problem asset not found");
    }
    return asset;
  }

  private requireGenerationJob(id: string): TestCaseGenerationJob {
    const job = this.testCaseGenerationJobs.find((item) => item.id === id);
    if (!job) {
      throw ApiError.notFound("Test generation job not found");
    }
    return job;
  }

  private requireGeneratedBatch(id: string): GeneratedTestCaseBatch {
    const batch = this.generatedTestCaseBatches.find((item) => item.id === id);
    if (!batch) {
      throw ApiError.notFound("Generated test case batch not found");
    }
    return batch;
  }

  // strip private fields before putting a user on the leaderboard
  private publicLeaderboardUser(user: User): LeaderboardRow["user"] {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      country: user.country,
      countryCode: user.countryCode
    };
  }

  private deriveContestStatus(startTime: Date, endTime: Date): Contest["status"] {
    const now = Date.now();
    if (now < startTime.getTime()) {
      return "UPCOMING";
    }
    if (now > endTime.getTime()) {
      return "ENDED";
    }
    return "LIVE";
  }
}
