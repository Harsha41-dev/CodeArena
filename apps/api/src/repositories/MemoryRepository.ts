import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { problemFixtures } from "../constants/problemFixtures";
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
  EditorialOfficialSolution,
  EditorialSection,
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
  ProblemCompany,
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
  CreateNotificationInput,
  CreateLearningCollectionInput,
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
  UpdatePracticeSessionInput,
  UpdatePracticeSessionProblemInput,
  UpdateBackupRunInput,
  UpdateLearningCollectionInput,
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

// in-memory store used for tests + local runs without a DB
export class MemoryRepository implements AppRepository {
  private users: User[] = [];
  private refreshTokens: RefreshTokenRecord[] = [];
  private tags: Tag[] = [];
  private companies: Company[] = [];
  private problemCompanies: ProblemCompany[] = [];
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
  private discussionHelpfulVotes: DiscussionHelpfulVote[] = [];
  private discussionAcceptedAnswers: DiscussionAcceptedAnswer[] = [];
  private bookmarks: Bookmark[] = [];
  private problemLists: ProblemList[] = [];
  private problemListItems: ProblemListItem[] = [];
  private learningCollections: LearningCollection[] = [];
  private learningCollectionItems: LearningCollectionItem[] = [];
  private learningProgress: LearningCollectionProgress[] = [];
  private dailyChallenges: DailyChallenge[] = [];
  private dailyChallengeCompletions: DailyChallengeCompletion[] = [];
  private badgeDefinitions: BadgeDefinition[] = [];
  private userBadges: UserBadgeWithDefinition[] = [];
  private notes: Note[] = [];
  private editorialSections: EditorialSection[] = [];
  private editorialOfficialSolutions: EditorialOfficialSolution[] = [];
  private rankSnapshots: UserRankSnapshot[] = [];
  private problemAssets: ProblemAsset[] = [];
  private testCaseGenerationJobs: TestCaseGenerationJob[] = [];
  private generatedTestCaseBatches: GeneratedTestCaseBatch[] = [];
  private solutions: Solution[] = [];
  private solutionVotes: SolutionVote[] = [];
  private reports: Report[] = [];
  private follows: UserFollow[] = [];
  private notifications: Notification[] = [];
  private auditLogs: AdminAuditLog[] = [];
  private apiUsageEvents: ApiUsageEvent[] = [];
  private backupRuns: BackupRun[] = [];
  private healthSnapshots: HealthCheckSnapshot[] = [];
  private userRatings: UserRating[] = [];
  private ratingEvents: RatingEvent[] = [];
  private practiceSessions: PracticeSession[] = [];
  private practiceSessionProblems: PracticeSessionProblem[] = [];
  private contestAnnouncements: ContestAnnouncement[] = [];
  private contestRatingJobs: ContestRatingJob[] = [];
  private monitoringAlerts: MonitoringAlert[] = [];

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

    // no pagination args - return full array (used by some admin helpers)
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
    const tagFilter = filters.tag ?? filters.topic;
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

    // normal lists only expose public problems; admin lists can opt into every visibility state
    let items: Problem[] = [];
    for (let i = 0; i < this.problems.length; i++) {
      const problem = this.problems[i];
      const matchesVisibility = filters.includeNonPublic
        ? !filters.visibility || problem.visibility === filters.visibility
        : problem.visibility === "PUBLIC";
      if (matchesVisibility) {
        items.push(problem);
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

    if (tagFilter) {
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

    if (filters.company) {
      const companyNeedle = filters.company.toLowerCase();
      const filtered: Problem[] = [];
      for (let i = 0; i < items.length; i++) {
        const problem = items[i];
        const companies = this.problemCompaniesFor(problem.id);
        const hasCompany = companies.some(
          (item) => item.company.slug === companyNeedle || item.company.name.toLowerCase() === companyNeedle
        );
        const hasLegacyTag = problem.tags.some(
          (tag) => tag.slug === companyNeedle || tag.name.toLowerCase() === companyNeedle
        );
        if (hasCompany || hasLegacyTag) {
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
        companies: this.problemCompaniesFor(problem.id),
        status,
        ...this.problemStats(problem.id)
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

    const sorted = this.sortProblems(statusFiltered, filters.sort ?? "newest");
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      total: sorted.length,
      page,
      limit
    };
  }

  async findProblemBySlug(slug: string): Promise<Problem | null> {
    const problem = this.problems.find((item) => item.slug === slug) ?? null;
    return problem ? { ...problem, companies: this.problemCompaniesFor(problem.id) } : null;
  }

  async findProblemById(id: string): Promise<Problem | null> {
    const problem = this.problems.find((item) => item.id === id) ?? null;
    return problem ? { ...problem, companies: this.problemCompaniesFor(problem.id) } : null;
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
    if (input.companies) {
      await this.setProblemCompanies(problem.id, input.companies);
    }
    return { ...problem, companies: this.problemCompaniesFor(problem.id) };
  }

  async updateProblem(id: string, input: UpdateProblemInput): Promise<Problem> {
    const problem = this.requireProblem(id);
    const updatedTags = input.tags ? this.ensureTags(input.tags) : problem.tags;
    const { companies, ...patch } = input;
    Object.assign(problem, patch, { tags: updatedTags, updatedAt: new Date() });
    if (companies) {
      await this.setProblemCompanies(id, companies);
    }
    return { ...problem, companies: this.problemCompaniesFor(problem.id) };
  }

  async archiveProblem(id: string): Promise<void> {
    const problem = this.requireProblem(id);
    problem.visibility = "ARCHIVED";
    problem.updatedAt = new Date();
  }

  async listTags(): Promise<Tag[]> {
    return [...this.tags].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listCompanies(): Promise<Company[]> {
    return [...this.companies].sort((a, b) => a.name.localeCompare(b.name));
  }

  async setProblemCompanies(problemId: string, companies: ProblemCompanyInput[]): Promise<ProblemCompanyTag[]> {
    this.requireProblem(problemId);
    this.problemCompanies = this.problemCompanies.filter((item) => item.problemId !== problemId);
    for (let index = 0; index < companies.length; index += 1) {
      const input = companies[index];
      const company = this.ensureCompany(input);
      this.problemCompanies.push({
        id: uuid(),
        problemId,
        companyId: company.id,
        frequency: input.frequency ?? 0,
        isFeatured: input.isFeatured ?? false,
        createdAt: new Date(),
        updatedAt: new Date()
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
    let items = this.learningCollections.filter((collection) => collection.type === input.type);
    if (!input.includeNonPublic) {
      items = items.filter((collection) => collection.visibility === "PUBLIC");
    }
    items = items.sort((a, b) => a.title.localeCompare(b.title));
    const start = (input.page - 1) * input.limit;
    const pageItems = items.slice(start, start + input.limit).map((collection) =>
      this.withLearningItems(collection, input.userId)
    );
    return { items: pageItems, total: items.length, page: input.page, limit: input.limit };
  }

  async findLearningCollectionBySlug(input: {
    type: LearningCollection["type"];
    slug: string;
    includeNonPublic?: boolean;
    userId?: string;
  }): Promise<LearningCollectionWithItems | null> {
    const collection =
      this.learningCollections.find((item) => item.type === input.type && item.slug === input.slug) ?? null;
    if (!collection) return null;
    if (!input.includeNonPublic && collection.visibility !== "PUBLIC") return null;
    return this.withLearningItems(collection, input.userId);
  }

  async createLearningCollection(input: CreateLearningCollectionInput): Promise<LearningCollection> {
    if (this.learningCollections.some((item) => item.type === input.type && item.slug === input.slug)) {
      throw ApiError.conflict("Collection slug already exists for this type");
    }
    const now = new Date();
    const collection: LearningCollection = {
      id: uuid(),
      type: input.type,
      slug: input.slug,
      title: input.title,
      description: input.description,
      badge: input.badge ?? null,
      dailyUnlockCount: input.dailyUnlockCount ?? 0,
      visibility: input.visibility ?? "PUBLIC",
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.learningCollections.push(collection);
    return collection;
  }

  async updateLearningCollection(id: string, input: UpdateLearningCollectionInput): Promise<LearningCollection> {
    const collection = this.requireLearningCollection(id);
    Object.assign(collection, input, { updatedAt: new Date() });
    return collection;
  }

  async deleteLearningCollection(id: string): Promise<void> {
    this.requireLearningCollection(id);
    this.learningCollections = this.learningCollections.filter((item) => item.id !== id);
    this.learningCollectionItems = this.learningCollectionItems.filter((item) => item.collectionId !== id);
    this.learningProgress = this.learningProgress.filter((item) => item.collectionId !== id);
  }

  async setLearningCollectionItems(
    collectionId: string,
    items: LearningCollectionItemInput[]
  ): Promise<LearningCollectionItem[]> {
    this.requireLearningCollection(collectionId);
    this.learningCollectionItems = this.learningCollectionItems.filter((item) => item.collectionId !== collectionId);
    const created: LearningCollectionItem[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      this.requireProblem(item.problemId);
      created.push({
        id: uuid(),
        collectionId,
        problemId: item.problemId,
        order: item.order ?? index,
        note: item.note ?? null,
        createdAt: new Date()
      });
    }
    this.learningCollectionItems.push(...created);
    return created.sort((a, b) => a.order - b.order);
  }

  async upsertLearningProgress(input: {
    collectionId: string;
    userId: string;
    unlockedCount: number;
    completedCount: number;
    completedAt?: Date | null;
  }): Promise<LearningCollectionProgress> {
    this.requireLearningCollection(input.collectionId);
    this.requireUser(input.userId);
    const now = new Date();
    let progress = this.learningProgress.find(
      (item) => item.collectionId === input.collectionId && item.userId === input.userId
    );
    if (!progress) {
      progress = {
        id: uuid(),
        collectionId: input.collectionId,
        userId: input.userId,
        startedAt: now,
        lastViewedAt: now,
        unlockedCount: input.unlockedCount,
        completedCount: input.completedCount,
        completedAt: input.completedAt ?? null
      };
      this.learningProgress.push(progress);
      return progress;
    }
    progress.lastViewedAt = now;
    progress.unlockedCount = input.unlockedCount;
    progress.completedCount = input.completedCount;
    progress.completedAt = input.completedAt ?? progress.completedAt ?? null;
    return progress;
  }

  async findDailyChallengeByDate(date: Date, userId?: string): Promise<DailyChallengeWithProblem | null> {
    const key = this.dayKey(date);
    const challenge = this.dailyChallenges.find((item) => this.dayKey(item.date) === key) ?? null;
    if (!challenge) return null;
    const completion = userId
      ? this.dailyChallengeCompletions.find((item) => item.challengeId === challenge.id && item.userId === userId) ?? null
      : null;
    return {
      ...challenge,
      problem: (await this.findProblemById(challenge.problemId)) ?? undefined,
      completion
    };
  }

  async upsertDailyChallenge(input: UpsertDailyChallengeInput): Promise<DailyChallenge> {
    this.requireProblem(input.problemId);
    const key = this.dayKey(input.date);
    const existing = this.dailyChallenges.find((item) => this.dayKey(item.date) === key);
    if (existing) {
      existing.problemId = input.problemId;
      existing.assignedById = input.assignedById ?? existing.assignedById ?? null;
      existing.rewardXp = input.rewardXp ?? existing.rewardXp;
      existing.updatedAt = new Date();
      return existing;
    }
    const now = new Date();
    const challenge: DailyChallenge = {
      id: uuid(),
      date: new Date(`${key}T00:00:00.000Z`),
      problemId: input.problemId,
      assignedById: input.assignedById ?? null,
      rewardXp: input.rewardXp ?? 10,
      createdAt: now,
      updatedAt: now
    };
    this.dailyChallenges.push(challenge);
    return challenge;
  }

  async listDailyChallenges(input: { page: number; limit: number }): Promise<{ items: DailyChallengeWithProblem[]; total: number; page: number; limit: number }> {
    const sorted = [...this.dailyChallenges].sort((a, b) => b.date.getTime() - a.date.getTime());
    const start = (input.page - 1) * input.limit;
    const pageItems = [];
    for (const challenge of sorted.slice(start, start + input.limit)) {
      pageItems.push({
        ...challenge,
        problem: (await this.findProblemById(challenge.problemId)) ?? undefined
      });
    }
    return { items: pageItems, total: sorted.length, page: input.page, limit: input.limit };
  }

  async completeDailyChallengeForProblem(input: {
    userId: string;
    problemId: string;
    submissionId?: string | null;
    completedAt?: Date;
  }): Promise<DailyChallengeCompletion | null> {
    const completedAt = input.completedAt ?? new Date();
    const challenge =
      this.dailyChallenges.find(
        (item) => item.problemId === input.problemId && this.dayKey(item.date) === this.dayKey(completedAt)
      ) ?? null;
    if (!challenge) return null;
    const existing = this.dailyChallengeCompletions.find(
      (item) => item.challengeId === challenge.id && item.userId === input.userId
    );
    if (existing) return existing;
    const completion: DailyChallengeCompletion = {
      id: uuid(),
      challengeId: challenge.id,
      userId: input.userId,
      problemId: input.problemId,
      submissionId: input.submissionId ?? null,
      completedAt,
      xpAwarded: challenge.rewardXp
    };
    this.dailyChallengeCompletions.push(completion);
    return completion;
  }

  async listDailyChallengeCompletions(userId: string): Promise<DailyChallengeCompletion[]> {
    return this.dailyChallengeCompletions
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  async listBadgeDefinitions(includeInactive = false): Promise<BadgeDefinition[]> {
    this.ensureDefaultBadges();
    return this.badgeDefinitions
      .filter((badge) => includeInactive || badge.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
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
    if (this.badgeDefinitions.some((badge) => badge.key === input.key)) {
      throw ApiError.conflict("Badge key already exists");
    }
    const now = new Date();
    const badge: BadgeDefinition = {
      id: uuid(),
      key: input.key,
      name: input.name,
      description: input.description,
      icon: input.icon ?? null,
      triggerType: input.triggerType,
      triggerValue: input.triggerValue ?? 1,
      isActive: input.isActive ?? true,
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.badgeDefinitions.push(badge);
    return badge;
  }

  async updateBadgeDefinition(
    id: string,
    input: Partial<Pick<BadgeDefinition, "name" | "description" | "icon" | "triggerType" | "triggerValue" | "isActive">>
  ): Promise<BadgeDefinition> {
    const badge = this.badgeDefinitions.find((item) => item.id === id);
    if (!badge) throw ApiError.notFound("Badge not found");
    Object.assign(badge, input, { updatedAt: new Date() });
    return badge;
  }

  async awardBadge(input: {
    userId: string;
    badgeKey: string;
    sourceType?: string | null;
    sourceId?: string | null;
  }): Promise<UserBadgeWithDefinition | null> {
    this.ensureDefaultBadges();
    const badge = this.badgeDefinitions.find((item) => item.key === input.badgeKey && item.isActive);
    if (!badge) return null;
    const sourceType = input.sourceType ?? null;
    const sourceId = input.sourceId ?? null;
    const existing = this.userBadges.find(
      (item) =>
        item.userId === input.userId &&
        item.badgeId === badge.id &&
        (sourceType ? item.sourceType === sourceType && item.sourceId === sourceId : true)
    );
    if (existing) return existing;
    const award: UserBadgeWithDefinition = {
      id: uuid(),
      userId: input.userId,
      badgeId: badge.id,
      sourceType,
      sourceId,
      awardedAt: new Date(),
      badge
    };
    this.userBadges.push(award);
    return award;
  }

  async listUserBadges(userId: string): Promise<UserBadgeWithDefinition[]> {
    this.ensureDefaultBadges();
    return this.userBadges
      .filter((award) => award.userId === userId)
      .map((award) => ({
        ...award,
        badge: this.badgeDefinitions.find((badge) => badge.id === award.badgeId) ?? award.badge
      }))
      .sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime());
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
    if (input.language) {
      const needle = input.language.toLowerCase();
      items = items.filter((submission) => {
        const haystack = [
          submission.language,
          submission.languageKeySnapshot,
          submission.languageNameSnapshot,
          submission.languageVersionSnapshot
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    }
    if (input.dateFrom) {
      items = items.filter((submission) => submission.createdAt >= input.dateFrom!);
    }
    if (input.dateTo) {
      items = items.filter((submission) => submission.createdAt <= input.dateTo!);
    }
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

  async getProblemSolvedStatus(userId: string, problemId: string): Promise<ProblemSolvedStatus | null> {
    return this.solvedStatuses.find((item) => item.userId === userId && item.problemId === problemId) ?? null;
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
    freezeStartsAt?: Date | null;
    isRated?: boolean;
    ratingSeason?: string | null;
    ratingScheduledAt?: Date | null;
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
      freezeStartsAt: input.freezeStartsAt ?? null,
      isRated: input.isRated ?? true,
      ratingSeason: input.ratingSeason ?? null,
      ratingScheduledAt: input.ratingScheduledAt ?? null,
      ratingsPublishedAt: null,
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
    this.contestAnnouncements = this.contestAnnouncements.filter((item) => item.contestId !== id);
    this.contestRatingJobs = this.contestRatingJobs.filter((item) => item.contestId !== id);
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

  async getContestLeaderboard(contestId: string, options: { before?: Date } = {}): Promise<ContestLeaderboardRow[]> {
    const byUser = new Map<string, { solved: Set<string>; penalty: number }>();
    for (const item of this.contestSubmissions.filter(
      (submission) =>
        submission.contestId === contestId &&
        (!options.before || submission.submittedAt.getTime() <= options.before.getTime())
    )) {
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
    return includeDraft || editorial.isPublished ? this.withEditorialStructure(editorial) : null;
  }

  async upsertEditorial(input: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isPublished?: boolean;
    structure?: EditorialStructureInput;
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
      if (input.structure) {
        await this.setEditorialStructure(existing.id, input.structure);
      }
      return this.withEditorialStructure(existing);
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
    if (input.structure) {
      await this.setEditorialStructure(editorial.id, input.structure);
    }
    return this.withEditorialStructure(editorial);
  }

  async updateEditorial(id: string, input: { title?: string; content?: string }): Promise<Editorial> {
    const editorial = this.requireEditorial(id);
    Object.assign(editorial, input, { updatedAt: new Date() });
    return editorial;
  }

  async deleteEditorial(id: string): Promise<void> {
    this.requireEditorial(id);
    this.editorials = this.editorials.filter((editorial) => editorial.id !== id);
    this.editorialSections = this.editorialSections.filter((section) => section.editorialId !== id);
    this.editorialOfficialSolutions = this.editorialOfficialSolutions.filter((solution) => solution.editorialId !== id);
  }

  async setEditorialPublished(id: string, isPublished: boolean): Promise<Editorial> {
    const editorial = this.requireEditorial(id);
    editorial.isPublished = isPublished;
    editorial.publishedAt = isPublished ? (editorial.publishedAt ?? new Date()) : null;
    editorial.updatedAt = new Date();
    return this.withEditorialStructure(editorial);
  }

  async setEditorialStructure(editorialId: string, input: EditorialStructureInput): Promise<Editorial> {
    const editorial = this.requireEditorial(editorialId);
    if (input.sections) {
      this.editorialSections = this.editorialSections.filter((item) => item.editorialId !== editorialId);
      this.editorialSections.push(
        ...input.sections.map((section, index) => ({
          id: uuid(),
          editorialId,
          type: section.type ?? "TEXT",
          title: section.title,
          content: section.content,
          language: section.language ?? null,
          order: section.order ?? index,
          isLocked: section.isLocked ?? false,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      );
    }
    if (input.officialSolutions) {
      this.editorialOfficialSolutions = this.editorialOfficialSolutions.filter(
        (item) => item.editorialId !== editorialId
      );
      this.editorialOfficialSolutions.push(
        ...input.officialSolutions.map((solution, index) => ({
          id: uuid(),
          editorialId,
          language: solution.language,
          code: solution.code,
          explanation: solution.explanation ?? null,
          timeComplexity: solution.timeComplexity ?? null,
          spaceComplexity: solution.spaceComplexity ?? null,
          order: solution.order ?? index,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      );
    }
    editorial.updatedAt = new Date();
    return this.withEditorialStructure(editorial);
  }

  async listDiscussions(input: {
    problemId?: string | null;
    contestId?: string | null;
    page: number;
    limit: number;
    search?: string;
    sort?: DiscussionSort;
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
    if (input.sort === "unanswered") {
      items = items.filter((discussion) => {
        const commentCount = this.comments.filter((comment) => comment.discussionId === discussion.id).length;
        return commentCount === 0;
      });
    }

    items = [...items].sort((a, b) => {
      if (input.sort === "top") {
        const scoreA = a.upvotes - (a.downvotes ?? 0);
        const scoreB = b.upvotes - (b.downvotes ?? 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
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

  async findDiscussionCommentById(id: string): Promise<DiscussionComment | null> {
    return this.comments.find((comment) => comment.id === id) ?? null;
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
      helpfulVotes: 0,
      isAcceptedAnswer: false,
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
    this.discussionHelpfulVotes = this.discussionHelpfulVotes.filter(
      (item) => this.comments.some((comment) => comment.id === item.commentId)
    );
    this.discussionAcceptedAnswers = this.discussionAcceptedAnswers.filter((item) => item.discussionId !== id);
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
    this.discussionHelpfulVotes = this.discussionHelpfulVotes.filter((item) => item.commentId !== id);
    this.discussionAcceptedAnswers = this.discussionAcceptedAnswers.filter((item) => item.commentId !== id);
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

  async hasDiscussionCommentHelpfulVote(commentId: string, userId: string): Promise<boolean> {
    return this.discussionHelpfulVotes.some((item) => item.commentId === commentId && item.userId === userId);
  }

  async voteDiscussionCommentHelpful(commentId: string, userId: string): Promise<DiscussionHelpfulVote> {
    const comment = this.requireDiscussionComment(commentId);
    let vote = this.discussionHelpfulVotes.find((item) => item.commentId === commentId && item.userId === userId);
    if (!vote) {
      vote = { id: uuid(), commentId, userId, createdAt: new Date() };
      this.discussionHelpfulVotes.push(vote);
    }
    comment.helpfulVotes = this.discussionHelpfulVotes.filter((item) => item.commentId === commentId).length;
    return vote;
  }

  async unvoteDiscussionCommentHelpful(commentId: string, userId: string): Promise<void> {
    const comment = this.requireDiscussionComment(commentId);
    this.discussionHelpfulVotes = this.discussionHelpfulVotes.filter(
      (item) => !(item.commentId === commentId && item.userId === userId)
    );
    comment.helpfulVotes = this.discussionHelpfulVotes.filter((item) => item.commentId === commentId).length;
  }

  async acceptDiscussionAnswer(
    discussionId: string,
    commentId: string,
    actorId: string
  ): Promise<DiscussionAcceptedAnswer> {
    const discussion = this.requireDiscussion(discussionId);
    const comment = this.requireDiscussionComment(commentId);
    if (comment.discussionId !== discussionId) {
      throw ApiError.badRequest("Comment does not belong to this discussion");
    }
    if (discussion.authorId !== actorId) {
      const actor = this.requireUser(actorId);
      if (actor.role !== "ADMIN") {
        throw ApiError.forbidden("Only the discussion author or an admin can accept an answer");
      }
    }
    this.discussionAcceptedAnswers = this.discussionAcceptedAnswers.filter((item) => item.discussionId !== discussionId);
    const accepted: DiscussionAcceptedAnswer = {
      id: uuid(),
      discussionId,
      commentId,
      acceptedById: actorId,
      createdAt: new Date()
    };
    this.discussionAcceptedAnswers.push(accepted);
    return accepted;
  }

  async listSolutions(input: ListSolutionsInput): Promise<{ items: SolutionWithRelations[]; total: number; page: number; limit: number }> {
    let items = this.solutions.slice();
    if (input.problemId) {
      items = items.filter((solution) => solution.problemId === input.problemId);
    }
    if (input.authorId) {
      items = items.filter((solution) => solution.authorId === input.authorId);
    }
    if (!input.includePrivate) {
      items = items.filter(
        (solution) => solution.visibility === "PUBLIC" || Boolean(input.viewerId && solution.authorId === input.viewerId)
      );
    }
    items.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return {
      items: items.slice(start, start + input.limit).map((solution) => this.withSolutionRelations(solution)),
      total: items.length,
      page: input.page,
      limit: input.limit
    };
  }

  async findSolutionById(id: string): Promise<SolutionWithRelations | null> {
    const solution = this.solutions.find((item) => item.id === id);
    return solution ? this.withSolutionRelations(solution) : null;
  }

  async createSolution(input: CreateSolutionInput): Promise<Solution> {
    this.requireProblem(input.problemId);
    this.requireUser(input.authorId);
    if (input.submissionId) {
      this.requireSubmission(input.submissionId);
    }
    const now = new Date();
    const solution: Solution = {
      id: uuid(),
      problemId: input.problemId,
      authorId: input.authorId,
      submissionId: input.submissionId ?? null,
      title: input.title,
      content: input.content,
      code: input.code,
      language: input.language,
      timeComplexity: input.timeComplexity ?? null,
      spaceComplexity: input.spaceComplexity ?? null,
      visibility: input.visibility ?? "PUBLIC",
      upvotes: 0,
      downvotes: 0,
      isPinned: input.isPinned ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.solutions.push(solution);
    return solution;
  }

  async updateSolution(id: string, input: UpdateSolutionInput): Promise<Solution> {
    const solution = this.requireSolution(id);
    Object.assign(solution, input, { updatedAt: new Date() });
    return solution;
  }

  async deleteSolution(id: string): Promise<void> {
    this.requireSolution(id);
    this.solutions = this.solutions.filter((solution) => solution.id !== id);
    this.solutionVotes = this.solutionVotes.filter((vote) => vote.solutionId !== id);
  }

  async voteSolution(solutionId: string, userId: string, value: 1 | -1): Promise<SolutionVote> {
    const solution = this.requireSolution(solutionId);
    this.requireUser(userId);
    const now = new Date();
    let vote = this.solutionVotes.find((item) => item.solutionId === solutionId && item.userId === userId);
    if (!vote) {
      vote = { id: uuid(), solutionId, userId, value, createdAt: now, updatedAt: now };
      this.solutionVotes.push(vote);
    } else {
      vote.value = value;
      vote.updatedAt = now;
    }
    const votes = this.solutionVotes.filter((item) => item.solutionId === solutionId);
    solution.upvotes = votes.filter((item) => item.value === 1).length;
    solution.downvotes = votes.filter((item) => item.value === -1).length;
    solution.updatedAt = now;
    return vote;
  }

  async createReport(input: CreateReportInput): Promise<Report> {
    const now = new Date();
    const report: Report = {
      id: uuid(),
      targetType: input.targetType,
      targetId: input.targetId,
      reporterId: input.reporterId ?? null,
      reason: input.reason,
      details: input.details ?? null,
      status: "OPEN",
      moderatorId: null,
      resolution: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null
    };
    this.reports.push(report);
    return report;
  }

  async listReports(input: ListReportsInput): Promise<{ items: Report[]; total: number; page: number; limit: number }> {
    let items = this.reports.slice();
    if (input.status) {
      items = items.filter((report) => report.status === input.status);
    }
    if (input.targetType) {
      items = items.filter((report) => report.targetType === input.targetType);
    }
    if (input.reporterId) {
      items = items.filter((report) => report.reporterId === input.reporterId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async updateReport(id: string, input: UpdateReportInput): Promise<Report> {
    const report = this.reports.find((item) => item.id === id);
    if (!report) throw ApiError.notFound("Report not found");
    Object.assign(report, input, { updatedAt: new Date() });
    return report;
  }

  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    this.requireUser(followerId);
    this.requireUser(followingId);
    const existing = this.follows.find((item) => item.followerId === followerId && item.followingId === followingId);
    if (existing) return existing;
    const follow: UserFollow = { id: uuid(), followerId, followingId, createdAt: new Date() };
    this.follows.push(follow);
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    this.follows = this.follows.filter((item) => !(item.followerId === followerId && item.followingId === followingId));
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return this.follows.some((item) => item.followerId === followerId && item.followingId === followingId);
  }

  async countFollowers(userId: string): Promise<number> {
    return this.follows.filter((item) => item.followingId === userId).length;
  }

  async countFollowing(userId: string): Promise<number> {
    return this.follows.filter((item) => item.followerId === userId).length;
  }

  async listFollowers(userId: string, input: { page: number; limit: number }): Promise<{ items: User[]; total: number; page: number; limit: number }> {
    const ids = this.follows.filter((item) => item.followingId === userId).map((item) => item.followerId);
    const items = this.users.filter((user) => ids.includes(user.id)).sort((a, b) => a.username.localeCompare(b.username));
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async listFollowing(userId: string, input: { page: number; limit: number }): Promise<{ items: User[]; total: number; page: number; limit: number }> {
    const ids = this.follows.filter((item) => item.followerId === userId).map((item) => item.followingId);
    const items = this.users.filter((user) => ids.includes(user.id)).sort((a, b) => a.username.localeCompare(b.username));
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    this.requireUser(input.userId);
    const notification: Notification = {
      id: uuid(),
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      readAt: null,
      createdAt: new Date()
    };
    this.notifications.push(notification);
    return notification;
  }

  async listNotifications(input: ListNotificationsInput): Promise<{ items: Notification[]; total: number; page: number; limit: number }> {
    let items = this.notifications.filter((notification) => notification.userId === input.userId);
    if (input.unreadOnly) {
      items = items.filter((notification) => !notification.readAt);
    }
    items = items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification> {
    const notification = this.notifications.find((item) => item.id === id && item.userId === userId);
    if (!notification) throw ApiError.notFound("Notification not found");
    notification.readAt = notification.readAt ?? new Date();
    return notification;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const now = new Date();
    let count = 0;
    this.notifications.forEach((notification) => {
      if (notification.userId === userId && !notification.readAt) {
        notification.readAt = now;
        count += 1;
      }
    });
    return count;
  }

  async createAuditLog(input: CreateAuditLogInput): Promise<AdminAuditLog> {
    const log: AdminAuditLog = {
      id: uuid(),
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      requestMethod: input.requestMethod ?? null,
      path: input.path ?? null,
      statusCode: input.statusCode ?? null,
      outcome: input.outcome ?? "SUCCESS",
      details: input.details ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date()
    };
    this.auditLogs.push(log);
    return log;
  }

  async listAuditLogs(input: ListAuditLogsInput): Promise<{ items: AdminAuditLog[]; total: number; page: number; limit: number }> {
    let items = this.auditLogs.slice();
    if (input.actorId) {
      items = items.filter((log) => log.actorId === input.actorId);
    }
    if (input.entityType) {
      items = items.filter((log) => log.entityType === input.entityType);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async recordApiUsageEvent(input: CreateApiUsageEventInput): Promise<ApiUsageEvent> {
    const event: ApiUsageEvent = {
      id: uuid(),
      userId: input.userId ?? null,
      method: input.method,
      path: input.path,
      route: input.route ?? null,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      rateLimited: input.rateLimited ?? false,
      createdAt: new Date()
    };
    this.apiUsageEvents.push(event);
    return event;
  }

  async listApiUsageEvents(input: ListApiUsageEventsInput): Promise<{ items: ApiUsageEvent[]; total: number; page: number; limit: number }> {
    let items = this.apiUsageEvents.slice();
    if (input.userId) {
      items = items.filter((event) => event.userId === input.userId);
    }
    if (input.path) {
      items = items.filter((event) => event.path.includes(input.path!));
    }
    if (input.statusCode !== undefined) {
      items = items.filter((event) => event.statusCode === input.statusCode);
    }
    if (input.since) {
      items = items.filter((event) => event.createdAt >= input.since!);
    }
    if (input.rateLimited !== undefined) {
      items = items.filter((event) => event.rateLimited === input.rateLimited);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async deleteApiUsageEventsBefore(cutoff: Date): Promise<number> {
    const before = this.apiUsageEvents.length;
    this.apiUsageEvents = this.apiUsageEvents.filter((event) => event.createdAt >= cutoff);
    return before - this.apiUsageEvents.length;
  }

  async createBackupRun(input: CreateBackupRunInput): Promise<BackupRun> {
    const startedAt = input.startedAt ?? new Date();
    const run: BackupRun = {
      id: uuid(),
      requestedById: input.requestedById ?? null,
      status: input.status,
      filename: input.filename ?? null,
      sizeBytes: input.sizeBytes ?? null,
      errorMessage: input.errorMessage ?? null,
      startedAt,
      completedAt: input.completedAt ?? null,
      createdAt: new Date()
    };
    this.backupRuns.push(run);
    return run;
  }

  async updateBackupRun(id: string, input: UpdateBackupRunInput): Promise<BackupRun> {
    const run = this.backupRuns.find((item) => item.id === id);
    if (!run) throw ApiError.notFound("Backup run not found");
    Object.assign(run, input);
    return run;
  }

  async listBackupRuns(input: ListBackupRunsInput): Promise<{ items: BackupRun[]; total: number; page: number; limit: number }> {
    let items = this.backupRuns.slice();
    if (input.status) {
      items = items.filter((run) => run.status === input.status);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async createHealthCheckSnapshot(input: CreateHealthCheckSnapshotInput): Promise<HealthCheckSnapshot> {
    const snapshot: HealthCheckSnapshot = {
      id: uuid(),
      status: input.status,
      details: input.details,
      createdAt: new Date()
    };
    this.healthSnapshots.push(snapshot);
    return snapshot;
  }

  async listHealthCheckSnapshots(input: ListHealthCheckSnapshotsInput): Promise<{ items: HealthCheckSnapshot[]; total: number; page: number; limit: number }> {
    let items = this.healthSnapshots.slice();
    if (input.status) {
      items = items.filter((snapshot) => snapshot.status === input.status);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async createPracticeSession(input: CreatePracticeSessionInput): Promise<PracticeSessionWithProblems> {
    this.requireUser(input.userId);
    const now = new Date();
    const session: PracticeSession = {
      id: uuid(),
      userId: input.userId,
      type: input.type,
      status: "ACTIVE",
      title: input.title,
      durationSeconds: input.durationSeconds,
      startedAt: now,
      finishedAt: null,
      settings: input.settings ?? null,
      summary: null,
      createdAt: now,
      updatedAt: now
    };
    this.practiceSessions.push(session);
    input.problemIds.forEach((problemId, index) => {
      this.requireProblem(problemId);
      this.practiceSessionProblems.push({
        id: uuid(),
        sessionId: session.id,
        problemId,
        order: index,
        outcome: null,
        secondsSpent: null,
        submissionId: null,
        createdAt: now,
        updatedAt: now
      });
    });
    return this.withPracticeProblems(session);
  }

  async listPracticeSessions(input: {
    userId: string;
    type?: PracticeSession["type"];
    page: number;
    limit: number;
  }): Promise<{ items: PracticeSessionWithProblems[]; total: number; page: number; limit: number }> {
    let items = this.practiceSessions.filter((session) => session.userId === input.userId);
    if (input.type) {
      items = items.filter((session) => session.type === input.type);
    }
    items.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const start = (input.page - 1) * input.limit;
    return {
      items: items.slice(start, start + input.limit).map((session) => this.withPracticeProblems(session)),
      total: items.length,
      page: input.page,
      limit: input.limit
    };
  }

  async findPracticeSessionById(id: string): Promise<PracticeSessionWithProblems | null> {
    const session = this.practiceSessions.find((item) => item.id === id);
    return session ? this.withPracticeProblems(session) : null;
  }

  async updatePracticeSession(id: string, input: UpdatePracticeSessionInput): Promise<PracticeSessionWithProblems> {
    const session = this.requirePracticeSession(id);
    Object.assign(session, input, { updatedAt: new Date() });
    return this.withPracticeProblems(session);
  }

  async updatePracticeSessionProblem(
    sessionProblemId: string,
    input: UpdatePracticeSessionProblemInput
  ): Promise<PracticeSessionProblem> {
    const row = this.practiceSessionProblems.find((item) => item.id === sessionProblemId);
    if (!row) throw ApiError.notFound("Practice session problem not found");
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async createContestAnnouncement(input: {
    contestId: string;
    authorId: string;
    title: string;
    content: string;
  }): Promise<ContestAnnouncement> {
    this.requireContest(input.contestId);
    this.requireUser(input.authorId);
    const now = new Date();
    const announcement: ContestAnnouncement = {
      id: uuid(),
      contestId: input.contestId,
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      createdAt: now,
      updatedAt: now
    };
    this.contestAnnouncements.push(announcement);
    return announcement;
  }

  async listContestAnnouncements(contestId: string): Promise<ContestAnnouncement[]> {
    return this.contestAnnouncements
      .filter((item) => item.contestId === contestId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createContestRatingJob(input: {
    contestId: string;
    requestedById?: string | null;
    scheduledAt: Date;
  }): Promise<ContestRatingJob> {
    this.requireContest(input.contestId);
    const now = new Date();
    const job: ContestRatingJob = {
      id: uuid(),
      contestId: input.contestId,
      requestedById: input.requestedById ?? null,
      status: "SCHEDULED",
      scheduledAt: input.scheduledAt,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };
    this.contestRatingJobs.push(job);
    return job;
  }

  async listContestRatingJobs(input: {
    status?: ContestRatingJob["status"];
    page: number;
    limit: number;
  }): Promise<{ items: ContestRatingJob[]; total: number; page: number; limit: number }> {
    let items = this.contestRatingJobs.slice();
    if (input.status) {
      items = items.filter((job) => job.status === input.status);
    }
    items.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async updateContestRatingJob(
    id: string,
    input: Partial<Pick<ContestRatingJob, "status" | "startedAt" | "completedAt" | "errorMessage">>
  ): Promise<ContestRatingJob> {
    const job = this.contestRatingJobs.find((item) => item.id === id);
    if (!job) throw ApiError.notFound("Rating job not found");
    Object.assign(job, input, { updatedAt: new Date() });
    return job;
  }

  async createMonitoringAlert(input: {
    severity: string;
    source: string;
    title: string;
    message: string;
    details?: Record<string, unknown> | null;
  }): Promise<MonitoringAlert> {
    const now = new Date();
    const alert: MonitoringAlert = {
      id: uuid(),
      status: "OPEN",
      severity: input.severity,
      source: input.source,
      title: input.title,
      message: input.message,
      details: input.details ?? null,
      acknowledgedById: null,
      acknowledgedAt: null,
      resolvedById: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.monitoringAlerts.push(alert);
    return alert;
  }

  async listMonitoringAlerts(input: {
    status?: MonitoringAlert["status"];
    page: number;
    limit: number;
  }): Promise<{ items: MonitoringAlert[]; total: number; page: number; limit: number }> {
    let items = this.monitoringAlerts.slice();
    if (input.status) {
      items = items.filter((alert) => alert.status === input.status);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async updateMonitoringAlert(
    id: string,
    input: Partial<Pick<MonitoringAlert, "status" | "acknowledgedById" | "acknowledgedAt" | "resolvedById" | "resolvedAt">>
  ): Promise<MonitoringAlert> {
    const alert = this.monitoringAlerts.find((item) => item.id === id);
    if (!alert) throw ApiError.notFound("Monitoring alert not found");
    Object.assign(alert, input, { updatedAt: new Date() });
    return alert;
  }

  async getUserRating(userId: string): Promise<UserRating | null> {
    return this.userRatings.find((rating) => rating.userId === userId) ?? null;
  }

  async upsertUserRating(input: UpsertUserRatingInput): Promise<UserRating> {
    const now = new Date();
    let rating = this.userRatings.find((item) => item.userId === input.userId);
    if (!rating) {
      rating = {
        id: uuid(),
        userId: input.userId,
        rating: input.rating,
        volatility: input.volatility,
        contestsRated: input.contestsRated,
        createdAt: now,
        updatedAt: now
      };
      this.userRatings.push(rating);
      return rating;
    }
    Object.assign(rating, input, { updatedAt: now });
    return rating;
  }

  async listUserRatings(input: { page: number; limit: number }): Promise<{ items: Array<UserRating & { user?: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "country" | "countryCode"> }>; total: number; page: number; limit: number }> {
    const items = this.userRatings
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .map((rating) => {
        const user = this.users.find((item) => item.id === rating.userId);
        return user ? { ...rating, user: this.publicLeaderboardUser(user) } : rating;
      });
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async createRatingEvent(input: CreateRatingEventInput): Promise<RatingEvent> {
    const existing = this.ratingEvents.find(
      (event) => event.userId === input.userId && event.contestId === (input.contestId ?? null)
    );
    if (existing) {
      Object.assign(existing, input);
      return existing;
    }
    const event: RatingEvent = {
      id: uuid(),
      userId: input.userId,
      contestId: input.contestId ?? null,
      oldRating: input.oldRating,
      newRating: input.newRating,
      delta: input.delta,
      rank: input.rank,
      participants: input.participants,
      createdAt: new Date()
    };
    this.ratingEvents.push(event);
    return event;
  }

  async listRatingEvents(input: ListRatingEventsInput): Promise<{ items: RatingEvent[]; total: number; page: number; limit: number }> {
    let items = this.ratingEvents.slice();
    if (input.userId) {
      items = items.filter((event) => event.userId === input.userId);
    }
    if (input.contestId) {
      items = items.filter((event) => event.contestId === input.contestId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (input.page - 1) * input.limit;
    return { items: items.slice(start, start + input.limit), total: items.length, page: input.page, limit: input.limit };
  }

  async deleteRatingEventsByContest(contestId: string): Promise<number> {
    const before = this.ratingEvents.length;
    this.ratingEvents = this.ratingEvents.filter((event) => event.contestId !== contestId);
    return before - this.ratingEvents.length;
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

  // seed helper - password is always Password123! for demo accounts
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

  private problemStats(problemId: string) {
    const totalSubmissions = this.submissions.filter((submission) => submission.problemId === problemId).length;
    const acceptedSubmissions = this.submissions.filter(
      (submission) => submission.problemId === problemId && submission.status === "ACCEPTED"
    ).length;
    const solvedCount = this.solvedStatuses.filter((status) => status.problemId === problemId && status.solved).length;

    return {
      totalSubmissions,
      acceptedSubmissions,
      solvedCount,
      acceptanceRate: totalSubmissions ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0,
      frequency: totalSubmissions
    };
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

  private withSolutionRelations(solution: Solution): SolutionWithRelations {
    const author = this.requireUser(solution.authorId);
    const problem = this.requireProblem(solution.problemId);
    return {
      ...solution,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl
      },
      problem: {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty
      }
    };
  }

  private problemCompaniesFor(problemId: string): ProblemCompanyTag[] {
    return this.problemCompanies
      .filter((item) => item.problemId === problemId)
      .map((item) => {
        const company = this.companies.find((candidate) => candidate.id === item.companyId);
        if (!company) {
          throw ApiError.notFound("Company not found");
        }
        return { ...item, company };
      })
      .sort((a, b) => b.frequency - a.frequency || a.company.name.localeCompare(b.company.name));
  }

  private ensureCompany(input: ProblemCompanyInput): Company {
    if (input.companyId) {
      const existing = this.companies.find((item) => item.id === input.companyId);
      if (existing) return existing;
      throw ApiError.notFound("Company not found");
    }
    if (!input.name) {
      throw ApiError.badRequest("Company name is required");
    }
    const base = input.slug || input.name;
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    let company = this.companies.find((item) => item.slug === slug);
    const now = new Date();
    if (!company) {
      company = {
        id: uuid(),
        name: input.name,
        slug,
        createdAt: now,
        updatedAt: now
      };
      this.companies.push(company);
    }
    return company;
  }

  private withLearningItems(collection: LearningCollection, userId?: string): LearningCollectionWithItems {
    const items = this.learningCollectionItems
      .filter((item) => item.collectionId === collection.id)
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        ...item,
        problem: this.problems.find((problem) => problem.id === item.problemId)
          ? { ...this.requireProblem(item.problemId), companies: this.problemCompaniesFor(item.problemId) }
          : undefined
      }));
    const progress = userId
      ? this.learningProgress.find((item) => item.collectionId === collection.id && item.userId === userId) ?? null
      : null;
    return { ...collection, items, progress };
  }

  private withEditorialStructure(editorial: Editorial): Editorial {
    return {
      ...editorial,
      sections: this.editorialSections
        .filter((section) => section.editorialId === editorial.id)
        .sort((a, b) => a.order - b.order),
      officialSolutions: this.editorialOfficialSolutions
        .filter((solution) => solution.editorialId === editorial.id)
        .sort((a, b) => a.language.localeCompare(b.language))
    };
  }

  private withPracticeProblems(session: PracticeSession): PracticeSessionWithProblems {
    return {
      ...session,
      problems: this.practiceSessionProblems
        .filter((item) => item.sessionId === session.id)
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          ...item,
          problem: this.problems.find((problem) => problem.id === item.problemId)
            ? { ...this.requireProblem(item.problemId), companies: this.problemCompaniesFor(item.problemId) }
            : undefined
        }))
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

  private requireLearningCollection(id: string): LearningCollection {
    const collection = this.learningCollections.find((item) => item.id === id);
    if (!collection) {
      throw ApiError.notFound("Learning collection not found");
    }
    return collection;
  }

  private requirePracticeSession(id: string): PracticeSession {
    const session = this.practiceSessions.find((item) => item.id === id);
    if (!session) {
      throw ApiError.notFound("Practice session not found");
    }
    return session;
  }

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

  private requireSolution(id: string): Solution {
    const solution = this.solutions.find((item) => item.id === id);
    if (!solution) {
      throw ApiError.notFound("Solution not found");
    }
    return solution;
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

  private ensureDefaultBadges(): void {
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
      if (!this.badgeDefinitions.some((item) => item.key === badge.key)) {
        const now = new Date();
        this.badgeDefinitions.push({
          id: uuid(),
          ...badge,
          isActive: true,
          createdById: null,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  }
}
