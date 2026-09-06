import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../errors/ApiError";
import type {
  AdminAuditLog,
  ApiUsageEvent,
  BadgeDefinition,
  BackupRun,
  Bookmark,
  Company,
  Contest,
  ContestAnnouncement,
  ContestProblem,
  ContestRatingJob,
  ContestRegistration,
  ContestSubmission,
  DailyChallenge,
  DailyChallengeCompletion,
  Difficulty,
  Discussion,
  DiscussionAcceptedAnswer,
  DiscussionComment,
  DiscussionHelpfulVote,
  DiscussionVote,
  Editorial,
  GeneratedTestCaseBatch,
  HealthCheckSnapshot,
  LearningCollection,
  LearningCollectionItem,
  LearningCollectionProgress,
  MonitoringAlert,
  Note,
  Notification,
  PracticeSession,
  PracticeSessionProblem,
  Problem,
  ProblemCompanyTag,
  ProblemAsset,
  ProblemAssetType,
  ProblemList,
  ProblemListItem,
  ProblemSolvedStatus,
  ProblemStatus,
  RatingEvent,
  Report,
  RefreshTokenRecord,
  Solution,
  SolutionVote,
  Submission,
  SubmissionStatus,
  SubmissionTestCaseResult,
  Tag,
  TestCase,
  TestCaseGenerationJob,
  User,
  UserFollow,
  UserRankSnapshot,
  UserRating
} from "../types/domain";
import type {
  AppRepository,
  ContestLeaderboardRow,
  CreateApiUsageEventInput,
  CreateAuditLogInput,
  CreateBackupRunInput,
  CreateHealthCheckSnapshotInput,
  CreateLearningCollectionInput,
  CreateNotificationInput,
  CreatePracticeSessionInput,
  CreateProblemInput,
  CreateRatingEventInput,
  CreateReportInput,
  CreateSolutionInput,
  CreateSubmissionInput,
  CreateSubmissionResultInput,
  CreateTestCaseInput,
  CreateUserInput,
  DailyChallengeWithProblem,
  DiscussionSort,
  EditorialStructureInput,
  CreateGeneratedTestCaseBatchInput,
  CreateProblemAssetInput,
  CreateTestCaseGenerationJobInput,
  LeaderboardRow,
  LearningCollectionItemInput,
  LearningCollectionWithItems,
  ListApiUsageEventsInput,
  ListAuditLogsInput,
  ListBackupRunsInput,
  ListHealthCheckSnapshotsInput,
  ListNotificationsInput,
  ListRatingEventsInput,
  ListReportsInput,
  ListSolutionsInput,
  ListUsersInput,
  ListSubmissionsInput,
  ProblemFilters,
  ProblemCompanyInput,
  ProblemLeaderboardRow,
  PracticeSessionWithProblems,
  SolutionWithRelations,
  UpdateBackupRunInput,
  UpdateLearningCollectionInput,
  UpdatePracticeSessionInput,
  UpdatePracticeSessionProblemInput,
  UpdateReportInput,
  UpdateSolutionInput,
  UpdateProblemInput,
  UpdateTestCaseInput,
  UpdateProblemAssetInput,
  UpdateTestCaseGenerationJobInput,
  UpsertUserRatingInput,
  UpsertDailyChallengeInput,
  UpdateUserInput,
  UserBadgeWithDefinition,
  UserStats
} from "./AppRepository";

type PrismaProblemWithTags = Prisma.ProblemGetPayload<{
  include: { problemTags: { include: { tag: true } }; companyTags: { include: { company: true } } };
}>;

type PrismaBookmarkWithProblem = Prisma.BookmarkGetPayload<{
  include: {
    problem: { include: { problemTags: { include: { tag: true } }; companyTags: { include: { company: true } } } };
  };
}>;

type PrismaPracticeSessionWithProblems = Prisma.PracticeSessionGetPayload<{
  include: {
    problems: {
      include: {
        problem: { include: { problemTags: { include: { tag: true } }; companyTags: { include: { company: true } } } };
      };
    };
  };
}>;

type PrismaDiscussionWithRelations = Prisma.DiscussionGetPayload<{
  include: { comments: true; author: true; acceptedAnswer: true };
}>;

// real DB-backed repository - same interface as MemoryRepository
function emptyProblemStats() {
  return {
    totalSubmissions: 0,
    acceptedSubmissions: 0,
    solvedCount: 0,
    acceptanceRate: 0,
    frequency: 0
  };
}

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

    // no pagination - return full list
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
    const tagFilter = filters.tag ?? filters.topic;
    const visibilityWhere: Prisma.ProblemWhereInput = filters.includeNonPublic
      ? filters.visibility
        ? { visibility: filters.visibility }
        : {}
      : { visibility: "PUBLIC" };
    const and: Prisma.ProblemWhereInput[] = [];
    if (filters.search) {
      and.push({
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { slug: { contains: filters.search, mode: "insensitive" } }
        ]
      });
    }
    if (filters.company) {
      and.push({
        OR: [
          {
            companyTags: {
              some: {
                company: {
                  OR: [{ slug: filters.company }, { name: { equals: filters.company, mode: "insensitive" } }]
                }
              }
            }
          },
          {
            problemTags: {
              some: {
                tag: {
                  OR: [{ slug: filters.company }, { name: { equals: filters.company, mode: "insensitive" } }]
                }
              }
            }
          }
        ]
      });
    }
    if (tagFilter) {
      and.push({
        problemTags: {
          some: {
            tag: {
              OR: [{ slug: tagFilter }, { name: { equals: tagFilter, mode: "insensitive" } }]
            }
          }
        }
      });
    }
    const where: Prisma.ProblemWhereInput = {
      ...visibilityWhere,
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
      ...(and.length ? { AND: and } : {})
    };

    const all = await this.prisma.problem.findMany({
      where,
      include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } },
      orderBy: { createdAt: "desc" }
    });
    const problemIds = all.map((problem) => problem.id);
    const [statuses, statsByProblem] = await Promise.all([
      filters.userId ? this.prisma.problemSolvedStatus.findMany({ where: { userId: filters.userId } }) : [],
      this.problemStatsById(problemIds)
    ]);
    const statusByProblem = new Map(
      statuses.map(
        (status) =>
          [status.problemId, status.solved ? "SOLVED" : status.attempted ? "ATTEMPTED" : "NOT_ATTEMPTED"] as const
      )
    );
    const enriched = all.map((problem) => ({
      ...this.mapProblem(problem),
      status: statusByProblem.get(problem.id) ?? "NOT_ATTEMPTED",
      ...(statsByProblem.get(problem.id) ?? emptyProblemStats())
    }));
    const filtered = filters.status ? enriched.filter((problem) => problem.status === filters.status) : enriched;
    const sorted = this.sortProblems(filtered, filters.sort ?? "newest");
    const start = (filters.page - 1) * filters.limit;
    return {
      items: sorted.slice(start, start + filters.limit),
      total: sorted.length,
      page: filters.page,
      limit: filters.limit
    };
  }

  async findProblemBySlug(slug: string): Promise<Problem | null> {
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
    });
    return problem ? this.mapProblem(problem) : null;
  }

  async findProblemById(id: string): Promise<Problem | null> {
    const problem = await this.prisma.problem.findUnique({
      where: { id },
      include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
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
      include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
    });
    if (input.companies) {
      await this.setProblemCompanies(problem.id, input.companies);
      return (await this.findProblemById(problem.id)) ?? this.mapProblem(problem);
    }
    return this.mapProblem(problem);
  }

  async updateProblem(id: string, input: UpdateProblemInput): Promise<Problem> {
    const tags = input.tags ? await Promise.all(input.tags.map((name) => this.upsertTag(name))) : null;
    const { companies, ...patch } = input;
    if (tags) {
      await this.prisma.problemTag.deleteMany({ where: { problemId: id } });
    }
    const problem = await this.prisma.problem.update({
      where: { id },
      data: {
        slug: patch.slug,
        title: patch.title,
        difficulty: patch.difficulty,
        description: patch.description,
        constraints: patch.constraints,
        inputFormat: patch.inputFormat,
        outputFormat: patch.outputFormat,
        starterCode: patch.starterCode as unknown as Prisma.InputJsonValue | undefined,
        visibility: patch.visibility,
        checkerMode: patch.checkerMode,
        timeLimitMs: patch.timeLimitMs,
        memoryLimitMb: patch.memoryLimitMb,
        ...(tags ? { problemTags: { create: tags.map((tag) => ({ tagId: tag.id })) } } : {})
      },
      include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
    });
    if (companies) {
      await this.setProblemCompanies(id, companies);
      return (await this.findProblemById(id)) ?? this.mapProblem(problem);
    }
    return this.mapProblem(problem);
  }

  async archiveProblem(id: string): Promise<void> {
    await this.prisma.problem.update({ where: { id }, data: { visibility: "ARCHIVED" } });
  }

  async listTags(): Promise<Tag[]> {
    return this.prisma.tag.findMany({ orderBy: { name: "asc" } }) as Promise<Tag[]>;
  }

  async listCompanies(): Promise<Company[]> {
    const db = this.prisma;
    return db.company.findMany({ orderBy: { name: "asc" } }) as Promise<Company[]>;
  }

  async setProblemCompanies(problemId: string, companies: ProblemCompanyInput[]): Promise<ProblemCompanyTag[]> {
    const db = this.prisma;
    await this.prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    await db.problemCompany.deleteMany({ where: { problemId } });
    for (const input of companies) {
      const company = await this.ensureCompany(input);
      await db.problemCompany.create({
        data: {
          problemId,
          companyId: company.id,
          frequency: input.frequency ?? 0,
          isFeatured: input.isFeatured ?? false
        }
      });
    }
    return this.problemCompaniesFor(problemId);
  }

  async listLearningCollections(input: {
    type: LearningCollection["type"];
    page: number;
    limit: number;
    includeNonPublic?: boolean;
    userId?: string;
  }): Promise<{ items: LearningCollectionWithItems[]; total: number; page: number; limit: number }> {
    const db = this.prisma;
    const where: Prisma.LearningCollectionWhereInput = {
      type: input.type,
      ...(input.includeNonPublic ? {} : { visibility: "PUBLIC" as const })
    };
    const [collections, total] = await Promise.all([
      db.learningCollection.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: [{ title: "asc" }]
      }) as Promise<LearningCollection[]>,
      db.learningCollection.count({ where }) as Promise<number>
    ]);
    const items = await Promise.all(
      collections.map((collection) => this.mapLearningCollection(collection, input.userId))
    );
    return { items, total, page: input.page, limit: input.limit };
  }

  async findLearningCollectionBySlug(input: {
    type: LearningCollection["type"];
    slug: string;
    includeNonPublic?: boolean;
    userId?: string;
  }): Promise<LearningCollectionWithItems | null> {
    const db = this.prisma;
    const collection = (await db.learningCollection.findUnique({
      where: { type_slug: { type: input.type, slug: input.slug } }
    })) as LearningCollection | null;
    if (!collection) return null;
    if (!input.includeNonPublic && collection.visibility !== "PUBLIC") return null;
    return this.mapLearningCollection(collection, input.userId);
  }

  async createLearningCollection(input: CreateLearningCollectionInput): Promise<LearningCollection> {
    const db = this.prisma;
    return db.learningCollection.create({
      data: {
        type: input.type,
        slug: input.slug,
        title: input.title,
        description: input.description,
        badge: input.badge,
        dailyUnlockCount: input.dailyUnlockCount ?? 0,
        visibility: input.visibility ?? "PUBLIC",
        createdById: input.createdById
      }
    }) as Promise<LearningCollection>;
  }

  async updateLearningCollection(id: string, input: UpdateLearningCollectionInput): Promise<LearningCollection> {
    const db = this.prisma;
    return db.learningCollection.update({ where: { id }, data: input }) as Promise<LearningCollection>;
  }

  async deleteLearningCollection(id: string): Promise<void> {
    const db = this.prisma;
    await db.learningCollection.delete({ where: { id } });
  }

  async setLearningCollectionItems(
    collectionId: string,
    items: LearningCollectionItemInput[]
  ): Promise<LearningCollectionItem[]> {
    const db = this.prisma;
    await db.learningCollection.findUniqueOrThrow({ where: { id: collectionId } });
    await db.learningCollectionItem.deleteMany({ where: { collectionId } });
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      await db.learningCollectionItem.create({
        data: {
          collectionId,
          problemId: item.problemId,
          order: item.order ?? index,
          note: item.note
        }
      });
    }
    return db.learningCollectionItem.findMany({
      where: { collectionId },
      orderBy: { order: "asc" }
    }) as Promise<LearningCollectionItem[]>;
  }

  async upsertLearningProgress(input: {
    collectionId: string;
    userId: string;
    unlockedCount: number;
    completedCount: number;
    completedAt?: Date | null;
  }): Promise<LearningCollectionProgress> {
    const db = this.prisma;
    return db.learningCollectionProgress.upsert({
      where: { collectionId_userId: { collectionId: input.collectionId, userId: input.userId } },
      update: {
        lastViewedAt: new Date(),
        unlockedCount: input.unlockedCount,
        completedCount: input.completedCount,
        completedAt: input.completedAt
      },
      create: {
        collectionId: input.collectionId,
        userId: input.userId,
        unlockedCount: input.unlockedCount,
        completedCount: input.completedCount,
        completedAt: input.completedAt
      }
    }) as Promise<LearningCollectionProgress>;
  }

  async findDailyChallengeByDate(date: Date, userId?: string): Promise<DailyChallengeWithProblem | null> {
    const db = this.prisma;
    const challenge = (await db.dailyChallenge.findUnique({
      where: { date: this.normalizedDay(date) },
      include: { problem: { include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } } } }
    })) as (DailyChallenge & { problem?: PrismaProblemWithTags }) | null;
    if (!challenge) return null;
    const completion = userId
      ? ((await db.dailyChallengeCompletion.findUnique({
          where: { challengeId_userId: { challengeId: challenge.id, userId } }
        })) as DailyChallengeCompletion | null)
      : null;
    return this.mapDailyChallenge(challenge, completion);
  }

  async upsertDailyChallenge(input: UpsertDailyChallengeInput): Promise<DailyChallenge> {
    const db = this.prisma;
    return db.dailyChallenge.upsert({
      where: { date: this.normalizedDay(input.date) },
      update: {
        problemId: input.problemId,
        assignedById: input.assignedById,
        rewardXp: input.rewardXp
      },
      create: {
        date: this.normalizedDay(input.date),
        problemId: input.problemId,
        assignedById: input.assignedById,
        rewardXp: input.rewardXp ?? 10
      }
    }) as Promise<DailyChallenge>;
  }

  async listDailyChallenges(input: { page: number; limit: number }): Promise<{ items: DailyChallengeWithProblem[]; total: number; page: number; limit: number }> {
    const db = this.prisma;
    const [challenges, total] = await Promise.all([
      db.dailyChallenge.findMany({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { problem: { include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } } } },
        orderBy: { date: "desc" }
      }) as Promise<Array<DailyChallenge & { problem?: PrismaProblemWithTags }>>,
      db.dailyChallenge.count() as Promise<number>
    ]);
    return { items: challenges.map((challenge) => this.mapDailyChallenge(challenge)), total, page: input.page, limit: input.limit };
  }

  async completeDailyChallengeForProblem(input: {
    userId: string;
    problemId: string;
    submissionId?: string | null;
    completedAt?: Date;
  }): Promise<DailyChallengeCompletion | null> {
    const db = this.prisma;
    const completedAt = input.completedAt ?? new Date();
    const challenge = (await db.dailyChallenge.findFirst({
      where: { problemId: input.problemId, date: this.normalizedDay(completedAt) }
    })) as DailyChallenge | null;
    if (!challenge) return null;
    return db.dailyChallengeCompletion.upsert({
      where: { challengeId_userId: { challengeId: challenge.id, userId: input.userId } },
      update: {},
      create: {
        challengeId: challenge.id,
        userId: input.userId,
        problemId: input.problemId,
        submissionId: input.submissionId,
        completedAt,
        xpAwarded: challenge.rewardXp
      }
    }) as Promise<DailyChallengeCompletion>;
  }

  async listDailyChallengeCompletions(userId: string): Promise<DailyChallengeCompletion[]> {
    const db = this.prisma;
    return db.dailyChallengeCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" }
    }) as Promise<DailyChallengeCompletion[]>;
  }

  async listBadgeDefinitions(includeInactive = false): Promise<BadgeDefinition[]> {
    await this.ensureDefaultBadges();
    const db = this.prisma;
    return db.badgeDefinition.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" }
    }) as Promise<BadgeDefinition[]>;
  }

  async createBadgeDefinition(input: {
    key: string;
    name: string;
    description: string;
    icon?: string | null;
    triggerType: string;
    triggerValue?: number;
    isActive?: boolean;
    createdById?: string | null;
  }): Promise<BadgeDefinition> {
    const db = this.prisma;
    return db.badgeDefinition.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description,
        icon: input.icon,
        triggerType: input.triggerType,
        triggerValue: input.triggerValue ?? 1,
        isActive: input.isActive ?? true,
        createdById: input.createdById
      }
    }) as Promise<BadgeDefinition>;
  }

  async updateBadgeDefinition(
    id: string,
    input: Partial<Pick<BadgeDefinition, "name" | "description" | "icon" | "triggerType" | "triggerValue" | "isActive">>
  ): Promise<BadgeDefinition> {
    const db = this.prisma;
    return db.badgeDefinition.update({ where: { id }, data: input }) as Promise<BadgeDefinition>;
  }

  async awardBadge(input: {
    userId: string;
    badgeKey: string;
    sourceType?: string | null;
    sourceId?: string | null;
  }): Promise<UserBadgeWithDefinition | null> {
    await this.ensureDefaultBadges();
    const db = this.prisma;
    const badge = (await db.badgeDefinition.findFirst({
      where: { key: input.badgeKey, isActive: true }
    })) as BadgeDefinition | null;
    if (!badge) return null;
    const sourceType = input.sourceType ?? null;
    const sourceId = input.sourceId ?? null;
    const existing = (await db.userBadge.findFirst({
      where: {
        userId: input.userId,
        badgeId: badge.id,
        ...(sourceType ? { sourceType, sourceId } : {})
      },
      include: { badge: true }
    })) as UserBadgeWithDefinition | null;
    if (existing) return existing;
    return db.userBadge.create({
      data: {
        userId: input.userId,
        badgeId: badge.id,
        sourceType,
        sourceId
      },
      include: { badge: true }
    }) as Promise<UserBadgeWithDefinition>;
  }

  async listUserBadges(userId: string): Promise<UserBadgeWithDefinition[]> {
    await this.ensureDefaultBadges();
    const db = this.prisma;
    return db.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: "desc" }
    }) as Promise<UserBadgeWithDefinition[]>;
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

    if (input.language) {
      where.OR = [
        { languageKeySnapshot: { equals: input.language, mode: "insensitive" } },
        { languageNameSnapshot: { contains: input.language, mode: "insensitive" } },
        { languageVersionSnapshot: { contains: input.language, mode: "insensitive" } }
      ];
    }

    if (input.dateFrom || input.dateTo) {
      where.createdAt = {
        ...(input.dateFrom ? { gte: input.dateFrom } : {}),
        ...(input.dateTo ? { lte: input.dateTo } : {})
      };
    }

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

  async getProblemSolvedStatus(userId: string, problemId: string): Promise<ProblemSolvedStatus | null> {
    return this.prisma.problemSolvedStatus.findUnique({
      where: { userId_problemId: { userId, problemId } }
    }) as Promise<ProblemSolvedStatus | null>;
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
    freezeStartsAt?: Date | null;
    isRated?: boolean;
    ratingSeason?: string | null;
    ratingScheduledAt?: Date | null;
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
        freezeStartsAt: input.freezeStartsAt,
        isRated: input.isRated ?? true,
        ratingSeason: input.ratingSeason,
        ratingScheduledAt: input.ratingScheduledAt,
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

  async getContestLeaderboard(contestId: string, options: { before?: Date } = {}): Promise<ContestLeaderboardRow[]> {
    const submissions = await this.prisma.contestSubmission.findMany({
      where: { contestId, ...(options.before ? { submittedAt: { lte: options.before } } : {}) },
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
    const db = this.prisma;
    const editorial = (await db.editorial.findFirst({
      where: { problemId, ...(includeDraft ? {} : { isPublished: true }) },
      include: { sections: { orderBy: { order: "asc" } }, officialSolutions: { orderBy: { order: "asc" } } }
    })) as Editorial | null;
    return editorial;
  }

  async upsertEditorial(input: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isPublished?: boolean;
    structure?: EditorialStructureInput;
  }): Promise<Editorial> {
    const db = this.prisma;
    const now = new Date();
    const editorial = (await db.editorial.upsert({
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
      },
      include: { sections: { orderBy: { order: "asc" } }, officialSolutions: { orderBy: { order: "asc" } } }
    })) as Editorial;
    if (input.structure) {
      return this.setEditorialStructure(editorial.id, input.structure);
    }
    return editorial;
  }

  async updateEditorial(id: string, input: { title?: string; content?: string }): Promise<Editorial> {
    return this.prisma.editorial.update({ where: { id }, data: input }) as Promise<Editorial>;
  }

  async deleteEditorial(id: string): Promise<void> {
    await this.prisma.editorial.delete({ where: { id } });
  }

  async setEditorialPublished(id: string, isPublished: boolean): Promise<Editorial> {
    const db = this.prisma;
    return db.editorial.update({
      where: { id },
      data: { isPublished, publishedAt: isPublished ? new Date() : null },
      include: { sections: { orderBy: { order: "asc" } }, officialSolutions: { orderBy: { order: "asc" } } }
    }) as Promise<Editorial>;
  }

  async setEditorialStructure(editorialId: string, input: EditorialStructureInput): Promise<Editorial> {
    const db = this.prisma;
    await db.editorial.findUniqueOrThrow({ where: { id: editorialId } });
    await this.prisma.$transaction([
      db.editorialSection.deleteMany({ where: { editorialId } }),
      db.editorialOfficialSolution.deleteMany({ where: { editorialId } })
    ]);
    for (let index = 0; index < (input.sections ?? []).length; index += 1) {
      const section = input.sections?.[index];
      if (!section) continue;
      await db.editorialSection.create({
        data: {
          editorialId,
          type: section.type ?? "TEXT",
          title: section.title,
          content: section.content,
          language: section.language,
          order: section.order ?? index,
          isLocked: section.isLocked ?? false
        }
      });
    }
    for (let index = 0; index < (input.officialSolutions ?? []).length; index += 1) {
      const solution = input.officialSolutions?.[index];
      if (!solution) continue;
      await db.editorialOfficialSolution.create({
        data: {
          editorialId,
          language: solution.language,
          code: solution.code,
          explanation: solution.explanation,
          timeComplexity: solution.timeComplexity,
          spaceComplexity: solution.spaceComplexity,
          order: solution.order ?? index
        }
      });
    }
    return db.editorial.findUnique({
      where: { id: editorialId },
      include: { sections: { orderBy: { order: "asc" } }, officialSolutions: { orderBy: { order: "asc" } } }
    }) as Promise<Editorial>;
  }

  async listDiscussions(input: {
    problemId?: string | null;
    contestId?: string | null;
    page: number;
    limit: number;
    search?: string;
    sort?: DiscussionSort;
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

    if (input.sort === "unanswered") {
      where.comments = { none: {} };
    }

    const orderBy: Prisma.DiscussionOrderByWithRelationInput[] =
      input.sort === "top" ? [{ upvotes: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }];

    const [items, total] = await Promise.all([
      this.prisma.discussion.findMany({
        where,
        include: { comments: true, author: true, acceptedAnswer: true },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy
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
      include: { comments: true, author: true, acceptedAnswer: true }
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

  async findDiscussionCommentById(id: string): Promise<DiscussionComment | null> {
    const comment = await this.prisma.discussionComment.findUnique({ where: { id } });
    return comment as DiscussionComment | null;
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

  async hasDiscussionCommentHelpfulVote(commentId: string, userId: string): Promise<boolean> {
    const db = this.prisma;
    const count = (await db.discussionHelpfulVote.count({ where: { commentId, userId } })) as number;
    return count > 0;
  }

  async voteDiscussionCommentHelpful(commentId: string, userId: string): Promise<DiscussionHelpfulVote> {
    const db = this.prisma;
    const vote = (await db.discussionHelpfulVote.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: {},
      create: { commentId, userId }
    })) as DiscussionHelpfulVote;
    const helpfulVotes = (await db.discussionHelpfulVote.count({ where: { commentId } })) as number;
    await db.discussionComment.update({ where: { id: commentId }, data: { helpfulVotes } });
    return vote;
  }

  async unvoteDiscussionCommentHelpful(commentId: string, userId: string): Promise<void> {
    const db = this.prisma;
    await db.discussionHelpfulVote.deleteMany({ where: { commentId, userId } });
    const helpfulVotes = (await db.discussionHelpfulVote.count({ where: { commentId } })) as number;
    await db.discussionComment.update({ where: { id: commentId }, data: { helpfulVotes } });
  }

  async acceptDiscussionAnswer(
    discussionId: string,
    commentId: string,
    actorId: string
  ): Promise<DiscussionAcceptedAnswer> {
    const db = this.prisma;
    const [discussion, comment, actor] = await Promise.all([
      db.discussion.findUnique({ where: { id: discussionId } }) as Promise<Discussion | null>,
      db.discussionComment.findUnique({ where: { id: commentId } }) as Promise<DiscussionComment | null>,
      this.prisma.user.findUnique({ where: { id: actorId } }) as Promise<User | null>
    ]);
    if (!discussion) throw ApiError.notFound("Discussion not found");
    if (!comment || comment.discussionId !== discussionId) throw ApiError.notFound("Discussion comment not found");
    if (!actor) throw ApiError.notFound("User not found");
    if (discussion.authorId !== actorId && actor.role !== "ADMIN") {
      throw ApiError.forbidden("Only the discussion author or an admin can accept an answer");
    }
    return db.discussionAcceptedAnswer.upsert({
      where: { discussionId },
      update: { commentId, acceptedById: actorId },
      create: { discussionId, commentId, acceptedById: actorId }
    }) as Promise<DiscussionAcceptedAnswer>;
  }

  async listSolutions(input: ListSolutionsInput) {
    const db = this.prisma;
    const where: Record<string, unknown> = {
      ...(input.problemId ? { problemId: input.problemId } : {}),
      ...(input.authorId ? { authorId: input.authorId } : {})
    };
    if (!input.includePrivate) {
      where.OR = input.viewerId
        ? [{ visibility: "PUBLIC" }, { authorId: input.viewerId }]
        : [{ visibility: "PUBLIC" }];
    }
    const [items, total] = await Promise.all([
      db.solution.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }]
      }) as Promise<Solution[]>,
      db.solution.count({ where }) as Promise<number>
    ]);
    return {
      items: await Promise.all(items.map((solution) => this.mapSolution(solution))),
      total,
      page: input.page,
      limit: input.limit
    };
  }

  async findSolutionById(id: string): Promise<SolutionWithRelations | null> {
    const db = this.prisma;
    const solution = (await db.solution.findUnique({ where: { id } })) as Solution | null;
    return solution ? this.mapSolution(solution) : null;
  }

  async createSolution(input: CreateSolutionInput): Promise<Solution> {
    const db = this.prisma;
    return db.solution.create({
      data: {
        problemId: input.problemId,
        authorId: input.authorId,
        submissionId: input.submissionId,
        title: input.title,
        content: input.content,
        code: input.code,
        language: input.language,
        timeComplexity: input.timeComplexity,
        spaceComplexity: input.spaceComplexity,
        visibility: input.visibility ?? "PUBLIC",
        isPinned: input.isPinned ?? false
      }
    }) as Promise<Solution>;
  }

  async updateSolution(id: string, input: UpdateSolutionInput): Promise<Solution> {
    const db = this.prisma;
    return db.solution.update({ where: { id }, data: input }) as Promise<Solution>;
  }

  async deleteSolution(id: string): Promise<void> {
    const db = this.prisma;
    await this.prisma.$transaction([
      db.solutionVote.deleteMany({ where: { solutionId: id } }),
      db.solution.delete({ where: { id } })
    ]);
  }

  async voteSolution(solutionId: string, userId: string, value: 1 | -1): Promise<SolutionVote> {
    const db = this.prisma;
    const vote = (await db.solutionVote.upsert({
      where: { solutionId_userId: { solutionId, userId } },
      update: { value },
      create: { solutionId, userId, value }
    })) as SolutionVote;
    const [upvotes, downvotes] = await Promise.all([
      db.solutionVote.count({ where: { solutionId, value: 1 } }) as Promise<number>,
      db.solutionVote.count({ where: { solutionId, value: -1 } }) as Promise<number>
    ]);
    await db.solution.update({ where: { id: solutionId }, data: { upvotes, downvotes } });
    return vote;
  }

  async createReport(input: CreateReportInput): Promise<Report> {
    const db = this.prisma;
    return db.report.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        reporterId: input.reporterId,
        reason: input.reason,
        details: input.details
      }
    }) as Promise<Report>;
  }

  async listReports(input: ListReportsInput): Promise<{ items: Report[]; total: number; page: number; limit: number }> {
    const db = this.prisma;
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.reporterId ? { reporterId: input.reporterId } : {})
    };
    const [items, total] = await Promise.all([
      db.report.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<Report[]>,
      db.report.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async updateReport(id: string, input: UpdateReportInput): Promise<Report> {
    const db = this.prisma;
    return db.report.update({ where: { id }, data: input }) as Promise<Report>;
  }

  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const db = this.prisma;
    return db.userFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId }
    }) as Promise<UserFollow>;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const db = this.prisma;
    await db.userFollow.deleteMany({ where: { followerId, followingId } });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const db = this.prisma;
    const count = (await db.userFollow.count({ where: { followerId, followingId } })) as number;
    return count > 0;
  }

  async countFollowers(userId: string): Promise<number> {
    const db = this.prisma;
    return db.userFollow.count({ where: { followingId: userId } }) as Promise<number>;
  }

  async countFollowing(userId: string): Promise<number> {
    const db = this.prisma;
    return db.userFollow.count({ where: { followerId: userId } }) as Promise<number>;
  }

  async listFollowers(userId: string, input: { page: number; limit: number }) {
    const db = this.prisma;
    const follows = (await db.userFollow.findMany({
      where: { followingId: userId },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy: { createdAt: "desc" }
    })) as UserFollow[];
    const total = (await db.userFollow.count({ where: { followingId: userId } })) as number;
    const users = await this.prisma.user.findMany({ where: { id: { in: follows.map((follow) => follow.followerId) } } });
    return { items: users as User[], total, page: input.page, limit: input.limit };
  }

  async listFollowing(userId: string, input: { page: number; limit: number }) {
    const db = this.prisma;
    const follows = (await db.userFollow.findMany({
      where: { followerId: userId },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy: { createdAt: "desc" }
    })) as UserFollow[];
    const total = (await db.userFollow.count({ where: { followerId: userId } })) as number;
    const users = await this.prisma.user.findMany({ where: { id: { in: follows.map((follow) => follow.followingId) } } });
    return { items: users as User[], total, page: input.page, limit: input.limit };
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const db = this.prisma;
    return db.notification.create({ data: input }) as Promise<Notification>;
  }

  async listNotifications(input: ListNotificationsInput) {
    const db = this.prisma;
    const where = {
      userId: input.userId,
      ...(input.unreadOnly ? { readAt: null } : {})
    };
    const [items, total] = await Promise.all([
      db.notification.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<Notification[]>,
      db.notification.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification> {
    const db = this.prisma;
    const existing = (await db.notification.findFirst({ where: { id, userId } })) as Notification | null;
    if (!existing) throw ApiError.notFound("Notification not found");
    return db.notification.update({ where: { id }, data: { readAt: existing.readAt ?? new Date() } }) as Promise<Notification>;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const db = this.prisma;
    const result = (await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() }
    })) as { count: number };
    return result.count;
  }

  async createAuditLog(input: CreateAuditLogInput): Promise<AdminAuditLog> {
    const db = this.prisma;
    return db.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestMethod: input.requestMethod,
        path: input.path,
        statusCode: input.statusCode,
        outcome: input.outcome ?? "SUCCESS",
        details: input.details as Prisma.InputJsonValue | undefined,
        ip: input.ip,
        userAgent: input.userAgent
      }
    }) as Promise<AdminAuditLog>;
  }

  async listAuditLogs(input: ListAuditLogsInput) {
    const db = this.prisma;
    const where = {
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {})
    };
    const [items, total] = await Promise.all([
      db.adminAuditLog.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<AdminAuditLog[]>,
      db.adminAuditLog.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async recordApiUsageEvent(input: CreateApiUsageEventInput): Promise<ApiUsageEvent> {
    const db = this.prisma;
    return db.apiUsageEvent.create({
      data: {
        userId: input.userId,
        method: input.method,
        path: input.path,
        route: input.route,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        ip: input.ip,
        userAgent: input.userAgent,
        rateLimited: input.rateLimited ?? false
      }
    }) as Promise<ApiUsageEvent>;
  }

  async listApiUsageEvents(input: ListApiUsageEventsInput) {
    const db = this.prisma;
    const where: Record<string, unknown> = {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.statusCode !== undefined ? { statusCode: input.statusCode } : {}),
      ...(input.rateLimited !== undefined ? { rateLimited: input.rateLimited } : {})
    };
    if (input.path) {
      where.path = { contains: input.path, mode: "insensitive" };
    }
    if (input.since) {
      where.createdAt = { gte: input.since };
    }
    const [items, total] = await Promise.all([
      db.apiUsageEvent.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<ApiUsageEvent[]>,
      db.apiUsageEvent.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async deleteApiUsageEventsBefore(cutoff: Date): Promise<number> {
    const db = this.prisma;
    const result = (await db.apiUsageEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })) as { count: number };
    return result.count;
  }

  async createBackupRun(input: CreateBackupRunInput): Promise<BackupRun> {
    const db = this.prisma;
    return db.backupRun.create({
      data: {
        requestedById: input.requestedById,
        status: input.status,
        filename: input.filename,
        sizeBytes: input.sizeBytes,
        errorMessage: input.errorMessage,
        startedAt: input.startedAt,
        completedAt: input.completedAt
      }
    }) as Promise<BackupRun>;
  }

  async updateBackupRun(id: string, input: UpdateBackupRunInput): Promise<BackupRun> {
    const db = this.prisma;
    return db.backupRun.update({ where: { id }, data: input }) as Promise<BackupRun>;
  }

  async listBackupRuns(input: ListBackupRunsInput) {
    const db = this.prisma;
    const where = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      db.backupRun.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<BackupRun[]>,
      db.backupRun.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async createHealthCheckSnapshot(input: CreateHealthCheckSnapshotInput): Promise<HealthCheckSnapshot> {
    const db = this.prisma;
    return db.healthCheckSnapshot.create({
      data: {
        status: input.status,
        details: input.details as Prisma.InputJsonValue
      }
    }) as Promise<HealthCheckSnapshot>;
  }

  async listHealthCheckSnapshots(input: ListHealthCheckSnapshotsInput) {
    const db = this.prisma;
    const where = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      db.healthCheckSnapshot.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<HealthCheckSnapshot[]>,
      db.healthCheckSnapshot.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async createPracticeSession(input: CreatePracticeSessionInput): Promise<PracticeSessionWithProblems> {
    const db = this.prisma;
    const session = (await db.practiceSession.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        durationSeconds: input.durationSeconds,
        settings: input.settings as Prisma.InputJsonValue | undefined,
        problems: {
          create: input.problemIds.map((problemId, index) => ({
            problemId,
            order: index
          }))
        }
      },
      include: {
        problems: {
          include: {
            problem: {
              include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
            }
          },
          orderBy: { order: "asc" }
        }
      }
    })) as PrismaPracticeSessionWithProblems;
    return this.mapPracticeSession(session);
  }

  async listPracticeSessions(input: {
    userId: string;
    type?: PracticeSession["type"];
    page: number;
    limit: number;
  }): Promise<{ items: PracticeSessionWithProblems[]; total: number; page: number; limit: number }> {
    const db = this.prisma;
    const where = { userId: input.userId, ...(input.type ? { type: input.type } : {}) };
    const [sessions, total] = await Promise.all([
      db.practiceSession.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          problems: {
            include: {
              problem: {
                include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
              }
            },
            orderBy: { order: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      }) as Promise<PrismaPracticeSessionWithProblems[]>,
      db.practiceSession.count({ where }) as Promise<number>
    ]);
    return {
      items: sessions.map((session) => this.mapPracticeSession(session)),
      total,
      page: input.page,
      limit: input.limit
    };
  }

  async findPracticeSessionById(id: string): Promise<PracticeSessionWithProblems | null> {
    const db = this.prisma;
    const session = (await db.practiceSession.findUnique({
      where: { id },
      include: {
        problems: {
          include: {
            problem: {
              include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
            }
          },
          orderBy: { order: "asc" }
        }
      }
    })) as PrismaPracticeSessionWithProblems | null;
    return session ? this.mapPracticeSession(session) : null;
  }

  async updatePracticeSession(id: string, input: UpdatePracticeSessionInput): Promise<PracticeSessionWithProblems> {
    const db = this.prisma;
    const session = (await db.practiceSession.update({
      where: { id },
      data: {
        status: input.status,
        finishedAt: input.finishedAt,
        summary: input.summary as Prisma.InputJsonValue | undefined
      },
      include: {
        problems: {
          include: {
            problem: {
              include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
            }
          },
          orderBy: { order: "asc" }
        }
      }
    })) as PrismaPracticeSessionWithProblems;
    return this.mapPracticeSession(session);
  }

  async updatePracticeSessionProblem(
    sessionProblemId: string,
    input: UpdatePracticeSessionProblemInput
  ): Promise<PracticeSessionProblem> {
    const db = this.prisma;
    return db.practiceSessionProblem.update({
      where: { id: sessionProblemId },
      data: input
    }) as Promise<PracticeSessionProblem>;
  }

  async createContestAnnouncement(input: {
    contestId: string;
    authorId: string;
    title: string;
    content: string;
  }): Promise<ContestAnnouncement> {
    const db = this.prisma;
    return db.contestAnnouncement.create({ data: input }) as Promise<ContestAnnouncement>;
  }

  async listContestAnnouncements(contestId: string): Promise<ContestAnnouncement[]> {
    const db = this.prisma;
    return db.contestAnnouncement.findMany({
      where: { contestId },
      orderBy: { createdAt: "desc" }
    }) as Promise<ContestAnnouncement[]>;
  }

  async createContestRatingJob(input: {
    contestId: string;
    requestedById?: string | null;
    scheduledAt: Date;
  }): Promise<ContestRatingJob> {
    const db = this.prisma;
    return db.contestRatingJob.create({
      data: {
        contestId: input.contestId,
        requestedById: input.requestedById,
        scheduledAt: input.scheduledAt,
        status: "SCHEDULED"
      }
    }) as Promise<ContestRatingJob>;
  }

  async listContestRatingJobs(input: {
    status?: ContestRatingJob["status"];
    page: number;
    limit: number;
  }): Promise<{ items: ContestRatingJob[]; total: number; page: number; limit: number }> {
    const db = this.prisma;
    const where = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      db.contestRatingJob.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
      }) as Promise<ContestRatingJob[]>,
      db.contestRatingJob.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async updateContestRatingJob(
    id: string,
    input: Partial<Pick<ContestRatingJob, "status" | "startedAt" | "completedAt" | "errorMessage">>
  ): Promise<ContestRatingJob> {
    const db = this.prisma;
    return db.contestRatingJob.update({ where: { id }, data: input }) as Promise<ContestRatingJob>;
  }

  async createMonitoringAlert(input: {
    severity: string;
    source: string;
    title: string;
    message: string;
    details?: Record<string, unknown> | null;
  }): Promise<MonitoringAlert> {
    const db = this.prisma;
    return db.monitoringAlert.create({
      data: {
        severity: input.severity,
        source: input.source,
        title: input.title,
        message: input.message,
        details: input.details as Prisma.InputJsonValue | undefined
      }
    }) as Promise<MonitoringAlert>;
  }

  async listMonitoringAlerts(input: {
    status?: MonitoringAlert["status"];
    page: number;
    limit: number;
  }): Promise<{ items: MonitoringAlert[]; total: number; page: number; limit: number }> {
    const db = this.prisma;
    const where = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      db.monitoringAlert.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<MonitoringAlert[]>,
      db.monitoringAlert.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async updateMonitoringAlert(
    id: string,
    input: Partial<Pick<MonitoringAlert, "status" | "acknowledgedById" | "acknowledgedAt" | "resolvedById" | "resolvedAt">>
  ): Promise<MonitoringAlert> {
    const db = this.prisma;
    return db.monitoringAlert.update({ where: { id }, data: input }) as Promise<MonitoringAlert>;
  }

  async getUserRating(userId: string): Promise<UserRating | null> {
    const db = this.prisma;
    return db.userRating.findUnique({ where: { userId } }) as Promise<UserRating | null>;
  }

  async upsertUserRating(input: UpsertUserRatingInput): Promise<UserRating> {
    const db = this.prisma;
    return db.userRating.upsert({
      where: { userId: input.userId },
      update: {
        rating: input.rating,
        volatility: input.volatility,
        contestsRated: input.contestsRated
      },
      create: input
    }) as Promise<UserRating>;
  }

  async listUserRatings(input: { page: number; limit: number }) {
    const db = this.prisma;
    const [ratings, total] = await Promise.all([
      db.userRating.findMany({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { rating: "desc" }
      }) as Promise<UserRating[]>,
      db.userRating.count() as Promise<number>
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: ratings.map((rating) => rating.userId) } } });
    const userById = new Map(users.map((user) => [user.id, user as User]));
    const items = ratings.map((rating) => {
      const user = userById.get(rating.userId);
      return user ? { ...rating, user: this.publicLeaderboardUser(user) } : rating;
    });
    return { items, total, page: input.page, limit: input.limit };
  }

  async createRatingEvent(input: CreateRatingEventInput): Promise<RatingEvent> {
    const db = this.prisma;
    if (input.contestId) {
      return db.ratingEvent.upsert({
        where: { userId_contestId: { userId: input.userId, contestId: input.contestId } },
        update: {
          oldRating: input.oldRating,
          newRating: input.newRating,
          delta: input.delta,
          rank: input.rank,
          participants: input.participants
        },
        create: input
      }) as Promise<RatingEvent>;
    }
    return db.ratingEvent.create({ data: input }) as Promise<RatingEvent>;
  }

  async listRatingEvents(input: ListRatingEventsInput) {
    const db = this.prisma;
    const where = {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.contestId ? { contestId: input.contestId } : {})
    };
    const [items, total] = await Promise.all([
      db.ratingEvent.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" }
      }) as Promise<RatingEvent[]>,
      db.ratingEvent.count({ where }) as Promise<number>
    ]);
    return { items, total, page: input.page, limit: input.limit };
  }

  async deleteRatingEventsByContest(contestId: string): Promise<number> {
    const db = this.prisma;
    const result = (await db.ratingEvent.deleteMany({ where: { contestId } })) as { count: number };
    return result.count;
  }

  async listBookmarks(userId: string): Promise<Array<Bookmark & { problem: Problem }>> {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: { problem: { include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } } } }
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

  private async ensureCompany(input: ProblemCompanyInput): Promise<Company> {
    const db = this.prisma;
    if (input.companyId) {
      const company = (await db.company.findUnique({ where: { id: input.companyId } })) as Company | null;
      if (!company) throw ApiError.notFound("Company not found");
      return company;
    }
    if (!input.name) {
      throw ApiError.badRequest("Company name is required");
    }
    const slug = (input.slug || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return db.company.upsert({
      where: { slug },
      update: { name: input.name },
      create: { name: input.name, slug }
    }) as Promise<Company>;
  }

  private async problemCompaniesFor(problemId: string): Promise<ProblemCompanyTag[]> {
    const db = this.prisma;
    return db.problemCompany.findMany({
      where: { problemId },
      include: { company: true },
      orderBy: [{ frequency: "desc" }, { company: { name: "asc" } }]
    }) as Promise<ProblemCompanyTag[]>;
  }

  private async mapLearningCollection(
    collection: LearningCollection,
    userId?: string
  ): Promise<LearningCollectionWithItems> {
    const db = this.prisma;
    const [items, progress] = await Promise.all([
      db.learningCollectionItem.findMany({
        where: { collectionId: collection.id },
        include: {
          problem: {
            include: { problemTags: { include: { tag: true } }, companyTags: { include: { company: true } } }
          }
        },
        orderBy: { order: "asc" }
      }) as Promise<Array<LearningCollectionItem & { problem?: PrismaProblemWithTags }>>,
      userId
        ? (db.learningCollectionProgress.findUnique({
            where: { collectionId_userId: { collectionId: collection.id, userId } }
          }) as Promise<LearningCollectionProgress | null>)
        : Promise.resolve(null)
    ]);
    return {
      ...collection,
      items: items.map((item) => ({
        ...item,
        problem: item.problem ? this.mapProblem(item.problem) : undefined
      })),
      progress
    };
  }

  private mapDailyChallenge(
    challenge: DailyChallenge & { problem?: PrismaProblemWithTags },
    completion: DailyChallengeCompletion | null = null
  ): DailyChallengeWithProblem {
    return {
      ...challenge,
      problem: challenge.problem ? this.mapProblem(challenge.problem) : undefined,
      completion
    };
  }

  private mapPracticeSession(session: PrismaPracticeSessionWithProblems): PracticeSessionWithProblems {
    return {
      id: session.id,
      userId: session.userId,
      type: session.type,
      status: session.status,
      title: session.title,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      settings: jsonObject(session.settings),
      summary: jsonObject(session.summary),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      problems: (session.problems ?? []).map((item: PracticeSessionProblem & { problem?: PrismaProblemWithTags }) => ({
        ...item,
        problem: item.problem ? this.mapProblem(item.problem) : undefined
      }))
    };
  }

  private async ensureDefaultBadges(): Promise<void> {
    const db = this.prisma;
    const defaults = [
      {
        key: "first-solve",
        name: "First Solve",
        description: "Solved the first problem.",
        icon: "sparkles",
        triggerType: "SOLVED_COUNT",
        triggerValue: 1
      },
      {
        key: "daily-challenge",
        name: "Daily Challenger",
        description: "Completed a daily challenge.",
        icon: "calendar-check",
        triggerType: "DAILY_CHALLENGE",
        triggerValue: 1
      },
      {
        key: "study-plan-complete",
        name: "Study Plan Finisher",
        description: "Completed a study plan.",
        icon: "graduation-cap",
        triggerType: "STUDY_PLAN_COMPLETE",
        triggerValue: 1
      },
      {
        key: "mock-interview-complete",
        name: "Interview Ready",
        description: "Completed a mock interview session.",
        icon: "timer",
        triggerType: "MOCK_INTERVIEW_COMPLETE",
        triggerValue: 1
      }
    ];
    for (const badge of defaults) {
      await db.badgeDefinition.upsert({
        where: { key: badge.key },
        update: badge,
        create: badge
      });
    }
  }

  private async problemStatsById(problemIds: string[]) {
    const result = new Map<string, ReturnType<typeof emptyProblemStats>>();
    for (const problemId of problemIds) {
      result.set(problemId, emptyProblemStats());
    }

    if (problemIds.length === 0) {
      return result;
    }

    const [totalSubmissions, acceptedSubmissions, solvedStatuses] = await Promise.all([
      this.prisma.submission.groupBy({
        by: ["problemId"],
        where: { problemId: { in: problemIds } },
        _count: { _all: true }
      }),
      this.prisma.submission.groupBy({
        by: ["problemId"],
        where: { problemId: { in: problemIds }, status: "ACCEPTED" },
        _count: { _all: true }
      }),
      this.prisma.problemSolvedStatus.groupBy({
        by: ["problemId"],
        where: { problemId: { in: problemIds }, solved: true },
        _count: { _all: true }
      })
    ]);

    for (const row of totalSubmissions) {
      const stats = result.get(row.problemId) ?? emptyProblemStats();
      stats.totalSubmissions = row._count._all;
      stats.frequency = row._count._all;
      result.set(row.problemId, stats);
    }

    for (const row of acceptedSubmissions) {
      const stats = result.get(row.problemId) ?? emptyProblemStats();
      stats.acceptedSubmissions = row._count._all;
      result.set(row.problemId, stats);
    }

    for (const row of solvedStatuses) {
      const stats = result.get(row.problemId) ?? emptyProblemStats();
      stats.solvedCount = row._count._all;
      result.set(row.problemId, stats);
    }

    for (const stats of result.values()) {
      stats.acceptanceRate = stats.totalSubmissions
        ? Math.round((stats.acceptedSubmissions / stats.totalSubmissions) * 100)
        : 0;
    }

    return result;
  }

  private sortProblems<T extends Problem & { status?: ProblemStatus }>(items: T[], sort: ProblemFilters["sort"]): T[] {
    const difficultyOrder: Record<Difficulty, number> = {
      EASY: 1,
      MEDIUM: 2,
      HARD: 3
    };

    const copy = items.slice();
    copy.sort((a, b) => {
      if (sort === "oldest") {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      if (sort === "title") {
        return a.title.localeCompare(b.title);
      }
      if (sort === "difficulty") {
        const diff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        if (diff !== 0) return diff;
        return a.title.localeCompare(b.title);
      }
      if (sort === "acceptance") {
        return (b.acceptanceRate ?? 0) - (a.acceptanceRate ?? 0) || a.title.localeCompare(b.title);
      }
      if (sort === "submissions" || sort === "frequency") {
        return (b.totalSubmissions ?? 0) - (a.totalSubmissions ?? 0) || a.title.localeCompare(b.title);
      }
      if (sort === "solved") {
        return (b.solvedCount ?? 0) - (a.solvedCount ?? 0) || a.title.localeCompare(b.title);
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return copy;
  }

  // flatten problemTags/companyTags joins into plain arrays
  private mapProblem(problem: PrismaProblemWithTags): Problem {
    const tags = [];
    for (let i = 0; i < problem.problemTags.length; i++) {
      tags.push(problem.problemTags[i].tag);
    }
    const companies = [];
    for (let i = 0; i < problem.companyTags.length; i++) {
      companies.push(problem.companyTags[i]);
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
      tags,
      companies
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
      comments: discussion.comments.map((comment) => ({
        ...(comment as DiscussionComment),
        isAcceptedAnswer: discussion.acceptedAnswer?.commentId === comment.id
      })),
      author: {
        id: discussion.author.id,
        username: discussion.author.username,
        displayName: discussion.author.displayName,
        avatarUrl: discussion.author.avatarUrl
      }
    };
  }

  private async mapSolution(solution: Solution): Promise<SolutionWithRelations> {
    const [author, problem] = await Promise.all([
      this.findUserById(solution.authorId),
      this.findProblemById(solution.problemId)
    ]);
    return {
      ...solution,
      author: author
        ? {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl
          }
        : undefined,
      problem: problem
        ? {
            id: problem.id,
            slug: problem.slug,
            title: problem.title,
            difficulty: problem.difficulty
          }
        : undefined
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

  private normalizedDay(value: Date): Date {
    return new Date(`${this.dayKey(value)}T00:00:00.000Z`);
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

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
