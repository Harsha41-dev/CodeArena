import { Prisma, PrismaClient } from "@prisma/client";
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

type PrismaProblemWithTags = Prisma.ProblemGetPayload<{
  include: { problemTags: { include: { tag: true } } };
}>;

type PrismaBookmarkWithProblem = Prisma.BookmarkGetPayload<{
  include: { problem: { include: { problemTags: { include: { tag: true } } } } };
}>;

type PrismaDiscussionWithRelations = Prisma.DiscussionGetPayload<{
  include: { comments: true; author: true };
}>;

// real DB-backed repository — same interface as MemoryRepository
export class PrismaRepository implements AppRepository {
  constructor(private readonly prisma = new PrismaClient()) {}

  async healthCheck(): Promise<{ driver: "prisma"; ok: boolean; message?: string }> {
    try {
      // simple ping so /health can report db status
      await this.prisma.$queryRaw`SELECT 1`;
      return { driver: "prisma", ok: true };
    } catch {
      return { driver: "prisma", ok: false, message: "Database ping failed" };
    }
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        ...input,
        status: "ACTIVE"
      }
    });
    return user as User;
  }

  async findUserById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user as User | null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    return user as User | null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    return user as User | null;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: input
    });
    return user as User;
  }

  async listUsers(input: ListUsersInput): Promise<{ items: User[]; total: number; page: number; limit: number }>;
  async listUsers(): Promise<User[]>;
  async listUsers(input?: ListUsersInput) {
    // default: hide soft-deleted users unless status filter is set
    const where: Prisma.UserWhereInput = {};

    if (input && input.status) {
      where.status = input.status;
    } else {
      where.status = { not: "DELETED" };
    }

    if (input && input.role) {
      where.role = input.role;
    }

    if (input && input.search) {
      where.OR = [
        { username: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } },
        { displayName: { contains: input.search, mode: "insensitive" } }
      ];
    }

    // no pagination → return full list
    if (!input) {
      const all = await this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" }
      });
      return all as User[];
    }

    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<User[]>,
      this.prisma.user.count({ where })
    ]);

    return {
      items,
      total,
      page: input.page,
      limit: input.limit
    };
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenRecord> {
    const token = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt }
    });
    return token as RefreshTokenRecord;
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return token as RefreshTokenRecord | null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() }
    });
  }

  async listProblems(filters: ProblemFilters) {
    const where: Prisma.ProblemWhereInput = {
      visibility: "PUBLIC",
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { slug: { contains: filters.search, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(filters.tag
        ? {
            problemTags: {
              some: {
                tag: {
                  OR: [{ slug: filters.tag }, { name: { equals: filters.tag, mode: "insensitive" } }]
                }
              }
            }
          }
        : {})
    };

    const all = await this.prisma.problem.findMany({
      where,
      include: { problemTags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" }
    });
    const statuses = filters.userId
      ? await this.prisma.problemSolvedStatus.findMany({ where: { userId: filters.userId } })
      : [];
    const statusByProblem = new Map(
      statuses.map(
        (status) =>
          [status.problemId, status.solved ? "SOLVED" : status.attempted ? "ATTEMPTED" : "NOT_ATTEMPTED"] as const
      )
    );
    const enriched = all.map((problem) => ({
      ...this.mapProblem(problem),
      status: statusByProblem.get(problem.id) ?? "NOT_ATTEMPTED"
    }));
    const filtered = filters.status ? enriched.filter((problem) => problem.status === filters.status) : enriched;
    const start = (filters.page - 1) * filters.limit;
    return {
      items: filtered.slice(start, start + filters.limit),
      total: filtered.length,
      page: filters.page,
      limit: filters.limit
    };
  }

  async findProblemBySlug(slug: string): Promise<Problem | null> {
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: { problemTags: { include: { tag: true } } }
    });
    return problem ? this.mapProblem(problem) : null;
  }

  async findProblemById(id: string): Promise<Problem | null> {
    const problem = await this.prisma.problem.findUnique({
      where: { id },
      include: { problemTags: { include: { tag: true } } }
    });
    return problem ? this.mapProblem(problem) : null;
  }

  async createProblem(input: CreateProblemInput): Promise<Problem> {
    const tags = await Promise.all(input.tags.map((name) => this.upsertTag(name)));
    const problem = await this.prisma.problem.create({
      data: {
        slug: input.slug,
        title: input.title,
        difficulty: input.difficulty,
        description: input.description,
        constraints: input.constraints,
        inputFormat: input.inputFormat,
        outputFormat: input.outputFormat,
        starterCode: input.starterCode as unknown as Prisma.InputJsonValue,
        visibility: input.visibility,
        checkerMode: input.checkerMode ?? "STANDARD",
        timeLimitMs: input.timeLimitMs,
        memoryLimitMb: input.memoryLimitMb,
        createdById: input.createdById,
        problemTags: { create: tags.map((tag) => ({ tagId: tag.id })) }
      },
      include: { problemTags: { include: { tag: true } } }
    });
    return this.mapProblem(problem);
  }

  async updateProblem(id: string, input: UpdateProblemInput): Promise<Problem> {
    const tags = input.tags ? await Promise.all(input.tags.map((name) => this.upsertTag(name))) : null;
    if (tags) {
      await this.prisma.problemTag.deleteMany({ where: { problemId: id } });
    }
    const problem = await this.prisma.problem.update({
      where: { id },
      data: {
        slug: input.slug,
        title: input.title,
        difficulty: input.difficulty,
        description: input.description,
        constraints: input.constraints,
        inputFormat: input.inputFormat,
        outputFormat: input.outputFormat,
        starterCode: input.starterCode as unknown as Prisma.InputJsonValue | undefined,
        visibility: input.visibility,
        checkerMode: input.checkerMode,
        timeLimitMs: input.timeLimitMs,
        memoryLimitMb: input.memoryLimitMb,
        ...(tags ? { problemTags: { create: tags.map((tag) => ({ tagId: tag.id })) } } : {})
      },
      include: { problemTags: { include: { tag: true } } }
    });
    return this.mapProblem(problem);
  }

  async archiveProblem(id: string): Promise<void> {
    await this.prisma.problem.update({ where: { id }, data: { visibility: "ARCHIVED" } });
  }

  async listTags(): Promise<Tag[]> {
    return this.prisma.tag.findMany({ orderBy: { name: "asc" } }) as Promise<Tag[]>;
  }

  async listTestCases(problemId: string, samplesOnly = false): Promise<TestCase[]> {
    return this.prisma.testCase.findMany({
      where: { problemId, ...(samplesOnly ? { isSample: true } : {}) },
      orderBy: { order: "asc" }
    }) as Promise<TestCase[]>;
  }

  async addTestCase(input: CreateTestCaseInput): Promise<TestCase> {
    return this.prisma.testCase.create({ data: input }) as Promise<TestCase>;
  }

  async updateTestCase(id: string, input: UpdateTestCaseInput): Promise<TestCase> {
    return this.prisma.testCase.update({ where: { id }, data: input }) as Promise<TestCase>;
  }

  async deleteTestCase(id: string): Promise<void> {
    await this.prisma.testCase.delete({ where: { id } });
  }

  async findTestCaseByInputHash(problemId: string, inputHash: string): Promise<TestCase | null> {
    return this.prisma.testCase.findFirst({ where: { problemId, inputHash } }) as Promise<TestCase | null>;
  }

  async deleteGeneratedTestCases(problemId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.testCase.deleteMany({ where: { problemId, isGenerated: true } }),
      this.prisma.generatedTestCaseBatch.deleteMany({ where: { problemId } })
    ]);
  }

  async listProblemAssets(problemId: string): Promise<ProblemAsset[]> {
    return this.prisma.problemAsset.findMany({
      where: { problemId },
      orderBy: { updatedAt: "desc" }
    }) as Promise<ProblemAsset[]>;
  }

  async findProblemAssetById(id: string): Promise<ProblemAsset | null> {
    return this.prisma.problemAsset.findUnique({ where: { id } }) as Promise<ProblemAsset | null>;
  }

  async findActiveProblemAsset(problemId: string, type: ProblemAssetType): Promise<ProblemAsset | null> {
    return this.prisma.problemAsset.findFirst({
      where: { problemId, type, isActive: true },
      orderBy: { updatedAt: "desc" }
    }) as Promise<ProblemAsset | null>;
  }

  async createProblemAsset(input: CreateProblemAssetInput): Promise<ProblemAsset> {
    await this.prisma.problemAsset.updateMany({
      where: { problemId: input.problemId, type: input.type, isActive: true },
      data: { isActive: false }
    });
    return this.prisma.problemAsset.create({
      data: {
        problemId: input.problemId,
        type: input.type,
        languageId: input.languageId,
        languageVersionId: input.languageVersionId,
        filename: input.filename,
        sourceCode: input.sourceCode,
        createdById: input.createdById,
        isActive: true
      }
    }) as Promise<ProblemAsset>;
  }

  async updateProblemAsset(id: string, input: UpdateProblemAssetInput): Promise<ProblemAsset> {
    return this.prisma.problemAsset.update({ where: { id }, data: input }) as Promise<ProblemAsset>;
  }

  async deactivateProblemAsset(id: string): Promise<void> {
    await this.prisma.problemAsset.update({ where: { id }, data: { isActive: false } });
  }

  async createTestCaseGenerationJob(input: CreateTestCaseGenerationJobInput): Promise<TestCaseGenerationJob> {
    return this.prisma.testCaseGenerationJob.create({
      data: {
        problemId: input.problemId,
        requestedById: input.requestedById,
        config: input.config as Prisma.InputJsonValue,
        totalCases: input.totalCases,
        generatedCases: 0,
        status: "PENDING"
      }
    }) as unknown as Promise<TestCaseGenerationJob>;
  }

  async listTestCaseGenerationJobs(problemId: string): Promise<TestCaseGenerationJob[]> {
    return this.prisma.testCaseGenerationJob.findMany({
      where: { problemId },
      orderBy: { createdAt: "desc" }
    }) as unknown as Promise<TestCaseGenerationJob[]>;
  }

  async findTestCaseGenerationJobById(id: string): Promise<TestCaseGenerationJob | null> {
    return this.prisma.testCaseGenerationJob.findUnique({
      where: { id }
    }) as unknown as Promise<TestCaseGenerationJob | null>;
  }

  async updateTestCaseGenerationJob(
    id: string,
    input: UpdateTestCaseGenerationJobInput
  ): Promise<TestCaseGenerationJob> {
    return this.prisma.testCaseGenerationJob.update({
      where: { id },
      data: input
    }) as unknown as Promise<TestCaseGenerationJob>;
  }

  async createGeneratedTestCaseBatch(input: CreateGeneratedTestCaseBatchInput): Promise<GeneratedTestCaseBatch> {
    return this.prisma.generatedTestCaseBatch.create({
      data: {
        problemId: input.problemId,
        jobId: input.jobId,
        name: input.name,
        description: input.description,
        createdById: input.createdById
      }
    }) as Promise<GeneratedTestCaseBatch>;
  }

  async listGeneratedTestCaseBatches(problemId: string): Promise<GeneratedTestCaseBatch[]> {
    return this.prisma.generatedTestCaseBatch.findMany({
      where: { problemId },
      include: { testCases: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" }
    }) as unknown as Promise<GeneratedTestCaseBatch[]>;
  }

  async findGeneratedTestCaseBatchById(id: string): Promise<GeneratedTestCaseBatch | null> {
    return this.prisma.generatedTestCaseBatch.findUnique({
      where: { id },
      include: { testCases: { orderBy: { order: "asc" } } }
    }) as unknown as Promise<GeneratedTestCaseBatch | null>;
  }

  async deleteGeneratedTestCaseBatch(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.testCase.deleteMany({ where: { batchId: id } }),
      this.prisma.generatedTestCaseBatch.delete({ where: { id } })
    ]);
  }

  async createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    return this.prisma.submission.create({ data: input }) as Promise<Submission>;
  }

  async findSubmissionById(id: string): Promise<Submission | null> {
    return this.prisma.submission.findUnique({ where: { id } }) as Promise<Submission | null>;
  }

  async listSubmissions(input: ListSubmissionsInput) {
    const where: Prisma.SubmissionWhereInput = {
      userId: input.userId,
      problemId: input.problemId,
      status: input.status
    };
    const [items, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<Submission[]>,
      this.prisma.submission.count({ where })
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async updateSubmission(
    id: string,
    patch: Partial<Pick<Submission, "status" | "runtimeMs" | "memoryKb" | "errorMessage" | "completedAt">>
  ): Promise<Submission> {
    return this.prisma.submission.update({ where: { id }, data: patch }) as Promise<Submission>;
  }

  async clearSubmissionResults(submissionId: string): Promise<void> {
    await this.prisma.submissionTestCaseResult.deleteMany({ where: { submissionId } });
  }

  async addSubmissionResult(input: CreateSubmissionResultInput): Promise<SubmissionTestCaseResult> {
    return this.prisma.submissionTestCaseResult.create({ data: input }) as Promise<SubmissionTestCaseResult>;
  }

  async getSubmissionResults(submissionId: string): Promise<SubmissionTestCaseResult[]> {
    return this.prisma.submissionTestCaseResult.findMany({
      where: { submissionId },
      orderBy: { createdAt: "asc" }
    }) as Promise<SubmissionTestCaseResult[]>;
  }

  async upsertSolvedStatus(userId: string, problemId: string, solved: boolean): Promise<ProblemSolvedStatus> {
    const existing = await this.prisma.problemSolvedStatus.findUnique({
      where: { userId_problemId: { userId, problemId } }
    });
    return this.prisma.problemSolvedStatus.upsert({
      where: { userId_problemId: { userId, problemId } },
      update: {
        attempted: true,
        solved: existing?.solved || solved,
        attempts: { increment: 1 },
        firstSolvedAt: existing?.firstSolvedAt ?? (solved ? new Date() : null),
        lastSubmittedAt: new Date()
      },
      create: {
        userId,
        problemId,
        attempted: true,
        solved,
        attempts: 1,
        firstSolvedAt: solved ? new Date() : null,
        lastSubmittedAt: new Date()
      }
    }) as Promise<ProblemSolvedStatus>;
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const [submissions, statuses] = await Promise.all([
      this.prisma.submission.findMany({ where: { userId } }) as Promise<Submission[]>,
      this.prisma.problemSolvedStatus.findMany({ where: { userId } })
    ]);
    const languageStats: Record<string, number> = {};
    submissions.forEach((submission) => {
      const key = submission.languageNameSnapshot ?? submission.languageKeySnapshot ?? submission.language;
      languageStats[key] = (languageStats[key] ?? 0) + 1;
    });
    const difficultyStats = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const status of statuses.filter((item) => item.solved)) {
      const problem = await this.prisma.problem.findUnique({ where: { id: status.problemId } });
      if (problem) difficultyStats[problem.difficulty] += 1;
    }
    const acceptedSubmissions = submissions.filter((submission) => submission.status === "ACCEPTED");
    const submissionCalendar = this.buildSubmissionCalendar(acceptedSubmissions);
    const streaks = this.calculateStreaks(submissionCalendar.map((item) => item.date));
    return {
      solvedCount: statuses.filter((status) => status.solved).length,
      attemptedCount: statuses.filter((status) => status.attempted).length,
      submissionsCount: submissions.length,
      totalSubmissions: submissions.length,
      acceptedSubmissions: acceptedSubmissions.length,
      acceptanceRate: submissions.length ? Math.round((acceptedSubmissions.length / submissions.length) * 100) : 0,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      easySolved: difficultyStats.EASY,
      mediumSolved: difficultyStats.MEDIUM,
      hardSolved: difficultyStats.HARD,
      submissionCalendar,
      languageStats,
      difficultyStats
    };
  }

  async listContests(): Promise<Array<Contest & { problems: ContestProblem[] }>> {
    const contests = await this.prisma.contest.findMany({
      include: { problems: true },
      orderBy: { startTime: "desc" }
    });
    return contests.map((contest) => ({ ...contest, problems: contest.problems })) as Array<
      Contest & { problems: ContestProblem[] }
    >;
  }

  async findContestById(id: string): Promise<(Contest & { problems: ContestProblem[] }) | null> {
    const contest = await this.prisma.contest.findUnique({ where: { id }, include: { problems: true } });
    return contest ? ({ ...contest, problems: contest.problems } as Contest & { problems: ContestProblem[] }) : null;
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
    const now = Date.now();
    const status = now < input.startTime.getTime() ? "UPCOMING" : now > input.endTime.getTime() ? "ENDED" : "LIVE";
    return this.prisma.contest.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        startTime: input.startTime,
        endTime: input.endTime,
        createdById: input.createdById,
        status,
        visibility: input.visibility ?? "PUBLIC",
        problems: {
          create: input.problemIds.map((problemId, index) => ({
            problemId,
            order: index + 1,
            points: 100
          }))
        }
      }
    }) as Promise<Contest>;
  }

  async updateContest(
    id: string,
    input: Partial<Pick<Contest, "title" | "slug" | "description" | "startTime" | "endTime" | "status" | "visibility">>
  ): Promise<Contest & { problems: ContestProblem[] }> {
    const contest = await this.prisma.contest.update({
      where: { id },
      data: input,
      include: { problems: true }
    });
    return { ...contest, problems: contest.problems } as Contest & { problems: ContestProblem[] };
  }

  async deleteContest(id: string): Promise<void> {
    await this.prisma.contest.update({ where: { id }, data: { visibility: "ARCHIVED" } });
  }

  async addContestProblem(contestId: string, problemId: string, points: number): Promise<ContestProblem> {
    const exists = await this.prisma.contestProblem.findUnique({
      where: { contestId_problemId: { contestId, problemId } }
    });
    if (exists) throw ApiError.conflict("Problem is already assigned to this contest");
    const order = (await this.prisma.contestProblem.count({ where: { contestId } })) + 1;
    return this.prisma.contestProblem.create({
      data: { contestId, problemId, points, order }
    }) as Promise<ContestProblem>;
  }

  async removeContestProblem(contestId: string, problemId: string): Promise<void> {
    await this.prisma.contestProblem.deleteMany({ where: { contestId, problemId } });
  }

  async registerForContest(contestId: string, userId: string): Promise<ContestRegistration> {
    return this.prisma.contestRegistration.upsert({
      where: { contestId_userId: { contestId, userId } },
      update: {},
      create: { contestId, userId }
    }) as Promise<ContestRegistration>;
  }

  async isContestRegistered(contestId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.contestRegistration.count({ where: { contestId, userId } });
    return count > 0;
  }

  async addContestSubmission(input: {
    contestId: string;
    userId: string;
    problemId: string;
    submissionId: string;
    status: SubmissionStatus;
    penaltyMinutes: number;
  }): Promise<ContestSubmission> {
    return this.prisma.contestSubmission.create({ data: input }) as Promise<ContestSubmission>;
  }

  async updateContestSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus,
    penaltyMinutes?: number
  ): Promise<void> {
    await this.prisma.contestSubmission.updateMany({
      where: { submissionId },
      data: { status, ...(penaltyMinutes !== undefined ? { penaltyMinutes } : {}) }
    });
  }

  async getGlobalLeaderboard(): Promise<LeaderboardRow[]> {
    const users = await this.prisma.user.findMany();
    const rows = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return {
          user: this.publicLeaderboardUser(user as User),
          solvedCount: stats.solvedCount,
          acceptedSubmissions: stats.acceptedSubmissions,
          acceptanceRate: stats.acceptanceRate,
          rank: 0
        };
      })
    );
    const snapshots = (await this.prisma.userRankSnapshot.findMany({
      orderBy: { snapshotDate: "desc" }
    })) as UserRankSnapshot[];
    return rows
      .sort((a, b) => b.solvedCount - a.solvedCount || b.acceptedSubmissions - a.acceptedSubmissions)
      .map((row, index) => ({ ...row, rank: index + 1, currentRank: index + 1 }))
      .map((row) => this.withRankMovement(row, snapshots));
  }

  async generateLeaderboardSnapshot(snapshotDate = new Date()): Promise<UserRankSnapshot[]> {
    const rows = await this.getGlobalLeaderboard();
    const normalized = new Date(`${snapshotDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
    await this.prisma.userRankSnapshot.deleteMany({ where: { snapshotDate: normalized } });
    return Promise.all(
      rows.map(
        (row) =>
          this.prisma.userRankSnapshot.create({
            data: {
              userId: row.user.id,
              rank: row.rank,
              solvedCount: row.solvedCount,
              acceptanceRate: row.acceptanceRate,
              snapshotDate: normalized
            }
          }) as Promise<UserRankSnapshot>
      )
    );
  }

  async getProblemLeaderboard(problemId: string): Promise<ProblemLeaderboardRow[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { problemId, status: "ACCEPTED" },
      include: { user: true },
      orderBy: [{ runtimeMs: "asc" }, { createdAt: "asc" }]
    });
    const seen = new Set<string>();
    const rows: ProblemLeaderboardRow[] = [];
    for (const submission of submissions) {
      if (seen.has(submission.userId)) continue;
      seen.add(submission.userId);
      rows.push({
        user: this.publicLeaderboardUser(submission.user as User),
        runtimeMs: submission.runtimeMs ?? 0,
        memoryKb: submission.memoryKb ?? 0,
        submittedAt: submission.completedAt ?? submission.updatedAt,
        rank: rows.length + 1
      });
    }
    return rows;
  }

  async getContestLeaderboard(contestId: string): Promise<ContestLeaderboardRow[]> {
    const submissions = await this.prisma.contestSubmission.findMany({
      where: { contestId },
      include: { user: true },
      orderBy: { submittedAt: "asc" }
    });
    const byUser = new Map<string, { user: User; solved: Set<string>; penalty: number }>();
    for (const submission of submissions) {
      const entry = byUser.get(submission.userId) ?? {
        user: submission.user as User,
        solved: new Set<string>(),
        penalty: 0
      };
      if (submission.status === "ACCEPTED" && !entry.solved.has(submission.problemId)) {
        entry.solved.add(submission.problemId);
        entry.penalty += submission.penaltyMinutes;
      }
      byUser.set(submission.userId, entry);
    }
    return [...byUser.values()]
      .map((entry) => ({
        user: this.publicLeaderboardUser(entry.user),
        solvedCount: entry.solved.size,
        penaltyMinutes: entry.penalty,
        rank: 0
      }))
      .sort((a, b) => b.solvedCount - a.solvedCount || a.penaltyMinutes - b.penaltyMinutes)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async getEditorial(problemId: string, includeDraft = false): Promise<Editorial | null> {
    return this.prisma.editorial.findFirst({
      where: { problemId, ...(includeDraft ? {} : { isPublished: true }) }
    }) as Promise<Editorial | null>;
  }

  async upsertEditorial(input: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isPublished?: boolean;
  }): Promise<Editorial> {
    const now = new Date();
    return this.prisma.editorial.upsert({
      where: { problemId: input.problemId },
      update: {
        title: input.title,
        content: input.content,
        authorId: input.authorId,
        isPublished: input.isPublished,
        publishedAt: input.isPublished ? now : undefined
      },
      create: {
        problemId: input.problemId,
        authorId: input.authorId,
        title: input.title,
        content: input.content,
        isPublished: input.isPublished ?? false,
        publishedAt: input.isPublished ? now : null
      }
    }) as Promise<Editorial>;
  }

  async updateEditorial(id: string, input: { title?: string; content?: string }): Promise<Editorial> {
    return this.prisma.editorial.update({ where: { id }, data: input }) as Promise<Editorial>;
  }

  async deleteEditorial(id: string): Promise<void> {
    await this.prisma.editorial.delete({ where: { id } });
  }

  async setEditorialPublished(id: string, isPublished: boolean): Promise<Editorial> {
    return this.prisma.editorial.update({
      where: { id },
      data: { isPublished, publishedAt: isPublished ? new Date() : null }
    }) as Promise<Editorial>;
  }

  async listDiscussions(input: {
    problemId?: string | null;
    contestId?: string | null;
    page: number;
    limit: number;
    search?: string;
  }) {
    const where: Prisma.DiscussionWhereInput = {
      ...(input.problemId !== undefined ? { problemId: input.problemId } : {}),
      ...(input.contestId !== undefined ? { contestId: input.contestId } : {}),
      ...(input.problemId === undefined && input.contestId === undefined ? { problemId: null, contestId: null } : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: "insensitive" } },
              { content: { contains: input.search, mode: "insensitive" } },
              { tags: { has: input.search } }
            ]
          }
        : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.discussion.findMany({
        where,
        include: { comments: true, author: true },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<PrismaDiscussionWithRelations[]>,
      this.prisma.discussion.count({ where })
    ]);
    return {
      items: items.map((discussion) => this.mapDiscussion(discussion)),
      total,
      page: input.page,
      limit: input.limit
    };
  }

  async findDiscussionById(id: string) {
    const discussion = await this.prisma.discussion.findUnique({
      where: { id },
      include: { comments: true, author: true }
    });
    return discussion ? this.mapDiscussion(discussion) : null;
  }

  async createDiscussion(input: {
    problemId?: string | null;
    contestId?: string | null;
    authorId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<Discussion> {
    return this.prisma.discussion.create({ data: input }) as Promise<Discussion>;
  }

  async addDiscussionComment(input: {
    discussionId: string;
    authorId: string;
    content: string;
  }): Promise<DiscussionComment> {
    return this.prisma.discussionComment.create({ data: input }) as Promise<DiscussionComment>;
  }

  async updateDiscussion(
    id: string,
    authorId: string,
    isAdmin: boolean,
    patch: { title?: string; content?: string; tags?: string[] }
  ): Promise<Discussion> {
    const discussion = await this.prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw ApiError.notFound("Discussion not found");
    if (!isAdmin && discussion.authorId !== authorId)
      throw ApiError.forbidden("Only the author can update this discussion");
    return this.prisma.discussion.update({ where: { id }, data: patch }) as Promise<Discussion>;
  }

  async deleteDiscussion(id: string, authorId: string, isAdmin: boolean): Promise<void> {
    const discussion = await this.prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw ApiError.notFound("Discussion not found");
    if (!isAdmin && discussion.authorId !== authorId)
      throw ApiError.forbidden("Only the author can delete this discussion");
    await this.prisma.discussion.delete({ where: { id } });
  }

  async updateDiscussionComment(
    id: string,
    authorId: string,
    isAdmin: boolean,
    content: string
  ): Promise<DiscussionComment> {
    const comment = await this.prisma.discussionComment.findUnique({ where: { id } });
    if (!comment) throw ApiError.notFound("Discussion comment not found");
    if (!isAdmin && comment.authorId !== authorId) throw ApiError.forbidden("Only the author can update this comment");
    return this.prisma.discussionComment.update({ where: { id }, data: { content } }) as Promise<DiscussionComment>;
  }

  async deleteDiscussionComment(id: string, authorId: string, isAdmin: boolean): Promise<void> {
    const comment = await this.prisma.discussionComment.findUnique({ where: { id } });
    if (!comment) throw ApiError.notFound("Discussion comment not found");
    if (!isAdmin && comment.authorId !== authorId) throw ApiError.forbidden("Only the author can delete this comment");
    await this.prisma.discussionComment.delete({ where: { id } });
  }

  async voteDiscussion(discussionId: string, userId: string, value: 1 | -1): Promise<DiscussionVote> {
    const vote = await this.prisma.discussionVote.upsert({
      where: { discussionId_userId: { discussionId, userId } },
      update: { value },
      create: { discussionId, userId, value }
    });
    const [upvotes, downvotes] = await Promise.all([
      this.prisma.discussionVote.count({ where: { discussionId, value: 1 } }),
      this.prisma.discussionVote.count({ where: { discussionId, value: -1 } })
    ]);
    await this.prisma.discussion.update({ where: { id: discussionId }, data: { upvotes, downvotes } });
    return vote as DiscussionVote;
  }

  async listBookmarks(userId: string): Promise<Array<Bookmark & { problem: Problem }>> {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: { problem: { include: { problemTags: { include: { tag: true } } } } }
    });
    return bookmarks.map((bookmark) => this.mapBookmark(bookmark));
  }

  async addBookmark(userId: string, problemId: string): Promise<Bookmark> {
    return this.prisma.bookmark.upsert({
      where: { userId_problemId: { userId, problemId } },
      update: {},
      create: { userId, problemId }
    }) as Promise<Bookmark>;
  }

  async removeBookmark(userId: string, problemId: string): Promise<void> {
    await this.prisma.bookmark.deleteMany({ where: { userId, problemId } });
  }

  async listProblemLists(userId: string): Promise<Array<ProblemList & { items: ProblemListItem[] }>> {
    const lists = await this.prisma.problemList.findMany({ where: { userId }, include: { items: true } });
    return lists.map((list) => ({ ...list, items: list.items })) as Array<ProblemList & { items: ProblemListItem[] }>;
  }

  async createProblemList(input: {
    userId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<ProblemList> {
    return this.prisma.problemList.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        isPublic: input.isPublic ?? false
      }
    }) as Promise<ProblemList>;
  }

  async addProblemToList(problemListId: string, problemId: string): Promise<ProblemListItem> {
    return this.prisma.problemListItem.upsert({
      where: { problemListId_problemId: { problemListId, problemId } },
      update: {},
      create: { problemListId, problemId }
    }) as Promise<ProblemListItem>;
  }

  async removeProblemFromList(problemListId: string, problemId: string): Promise<void> {
    await this.prisma.problemListItem.deleteMany({ where: { problemListId, problemId } });
  }

  async getNote(userId: string, problemId: string): Promise<Note | null> {
    return this.prisma.note.findUnique({ where: { userId_problemId: { userId, problemId } } }) as Promise<Note | null>;
  }

  async upsertNote(userId: string, problemId: string, content: string): Promise<Note> {
    return this.prisma.note.upsert({
      where: { userId_problemId: { userId, problemId } },
      update: { content },
      create: { userId, problemId, content }
    }) as Promise<Note>;
  }

  async updateNote(id: string, userId: string, content: string): Promise<Note> {
    const note = await this.prisma.note.findFirst({ where: { id, userId } });
    if (!note) throw ApiError.notFound("Note not found");
    return this.prisma.note.update({ where: { id }, data: { content } }) as Promise<Note>;
  }

  async deleteNote(id: string, userId: string): Promise<void> {
    await this.prisma.note.deleteMany({ where: { id, userId } });
  }

  // create tag if missing, update name if it already exists
  private async upsertTag(name: string): Promise<Tag> {
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    slug = slug.replace(/(^-|-$)/g, "");

    const tag = await this.prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug }
    });
    return tag as Tag;
  }

  // flatten problemTags join into a plain tags array
  private mapProblem(problem: PrismaProblemWithTags): Problem {
    const tags = [];
    for (let i = 0; i < problem.problemTags.length; i++) {
      tags.push(problem.problemTags[i].tag);
    }

    return {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      constraints: problem.constraints,
      inputFormat: problem.inputFormat,
      outputFormat: problem.outputFormat,
      starterCode: problem.starterCode as unknown as Problem["starterCode"],
      solution: problem.solution,
      visibility: problem.visibility,
      checkerMode: problem.checkerMode,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      createdById: problem.createdById,
      createdAt: problem.createdAt,
      updatedAt: problem.updatedAt,
      tags
    };
  }

  private mapBookmark(bookmark: PrismaBookmarkWithProblem): Bookmark & { problem: Problem } {
    return {
      id: bookmark.id,
      userId: bookmark.userId,
      problemId: bookmark.problemId,
      createdAt: bookmark.createdAt,
      problem: this.mapProblem(bookmark.problem)
    };
  }

  private mapDiscussion(discussion: PrismaDiscussionWithRelations): Discussion & {
    comments: DiscussionComment[];
    author: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  } {
    return {
      id: discussion.id,
      problemId: discussion.problemId,
      contestId: discussion.contestId,
      authorId: discussion.authorId,
      title: discussion.title,
      content: discussion.content,
      tags: discussion.tags,
      upvotes: discussion.upvotes,
      downvotes: discussion.downvotes,
      createdAt: discussion.createdAt,
      updatedAt: discussion.updatedAt,
      comments: discussion.comments as DiscussionComment[],
      author: {
        id: discussion.author.id,
        username: discussion.author.username,
        displayName: discussion.author.displayName,
        avatarUrl: discussion.author.avatarUrl
      }
    };
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

    // walk back from today for the current streak
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

  private withRankMovement(
    row: Omit<LeaderboardRow, "previousRank" | "rankMovement" | "rankMovementDirection">,
    snapshots: UserRankSnapshot[]
  ): LeaderboardRow {
    let previous: UserRankSnapshot | undefined = undefined;
    for (let i = 0; i < snapshots.length; i++) {
      if (snapshots[i].userId === row.user.id) {
        previous = snapshots[i];
        break;
      }
    }

    if (!previous) {
      return {
        ...row,
        previousRank: null,
        rankMovement: 0,
        rankMovementDirection: "NEW"
      };
    }

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

  // only public-ish fields for leaderboard rows
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
}
