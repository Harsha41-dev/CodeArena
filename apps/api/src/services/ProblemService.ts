import { ApiError } from "../errors/ApiError";
import type {
  AppRepository,
  CreateLearningCollectionInput,
  CreateProblemInput,
  LearningCollectionItemInput,
  LearningCollectionWithItems,
  UpdateLearningCollectionInput,
  UpdateProblemInput,
  UpsertDailyChallengeInput
} from "../repositories/AppRepository";
import type { Difficulty, Problem, ProblemSort, ProblemStatus, ProblemVisibility } from "../types/domain";
import { getPagination } from "../utils/pagination";

const CURATED_PROBLEM_SETS = [
  {
    slug: "top-75",
    title: "Top 75",
    description: "A compact interview-prep set built from the strongest available practice problems.",
    tags: [] as string[]
  },
  {
    slug: "arrays",
    title: "Arrays",
    description: "Array and two-pointer style problems for core implementation practice.",
    tags: ["array", "two-pointers", "hash-map"]
  },
  {
    slug: "dynamic-programming",
    title: "Dynamic Programming",
    description: "Problems that build recurrence, state, and optimization instincts.",
    tags: ["dynamic-programming", "dp"]
  },
  {
    slug: "graphs",
    title: "Graphs",
    description: "Graph traversal, shortest paths, connectivity, and search patterns.",
    tags: ["graph", "dfs", "bfs"]
  }
];

const STUDY_PLANS = [
  {
    slug: "beginner-roadmap",
    title: "Beginner Roadmap",
    description: "A practical first path through arrays, strings, hashing, two pointers, and binary search.",
    badge: "Foundation Builder",
    tags: ["array", "string", "hash-map", "two-pointers", "binary-search"],
    dailyUnlockCount: 3
  },
  {
    slug: "data-structures",
    title: "Data Structures",
    description: "Build fluency across linked lists, stacks, queues, trees, heaps, and maps.",
    badge: "Data Structure Climber",
    tags: ["linked-list", "stack", "queue", "tree", "heap", "hash-map"],
    dailyUnlockCount: 2
  },
  {
    slug: "dynamic-programming",
    title: "Dynamic Programming",
    description: "Move from small recurrence patterns into medium and hard optimization problems.",
    badge: "DP Finisher",
    tags: ["dynamic-programming", "dp"],
    dailyUnlockCount: 2
  },
  {
    slug: "graph-interview",
    title: "Graph Interview",
    description: "Traversal, connectivity, shortest path, and search practice for interview rounds.",
    badge: "Graph Navigator",
    tags: ["graph", "dfs", "bfs", "shortest-path", "union-find"],
    dailyUnlockCount: 2
  }
];

type ProblemWithStatus = Problem & { status?: ProblemStatus };

// problem listing, CRUD, and test case helpers for admins
export class ProblemService {
  constructor(private readonly repository: AppRepository) {}

  async list(input: {
    page?: unknown;
    limit?: unknown;
    difficulty?: Difficulty;
    tag?: string;
    topic?: string;
    company?: string;
    status?: ProblemStatus;
    search?: string;
    userId?: string;
    sort?: ProblemSort;
  }) {
    const pagination = getPagination(input);

    // just pass filters through to the repo
    const result = await this.repository.listProblems({
      page: pagination.page,
      limit: pagination.limit,
      difficulty: input.difficulty,
      tag: input.tag,
      topic: input.topic,
      company: input.company,
      status: input.status,
      search: input.search,
      userId: input.userId,
      sort: input.sort
    });

    return result;
  }

  async adminList(input: {
    page?: unknown;
    limit?: unknown;
    difficulty?: Difficulty;
    tag?: string;
    topic?: string;
    company?: string;
    visibility?: ProblemVisibility;
    status?: ProblemStatus;
    search?: string;
    userId?: string;
    sort?: ProblemSort;
  }) {
    const pagination = getPagination(input);

    return this.repository.listProblems({
      page: pagination.page,
      limit: pagination.limit,
      difficulty: input.difficulty,
      tag: input.tag,
      topic: input.topic,
      company: input.company,
      visibility: input.visibility,
      includeNonPublic: true,
      status: input.status,
      search: input.search,
      userId: input.userId,
      sort: input.sort
    });
  }

  async dailyChallenge(input: { userId?: string; date?: Date }) {
    const date = input.date ?? new Date();
    await this.ensureDailyChallenge(date);
    const challenge = await this.repository.findDailyChallengeByDate(date, input.userId);

    if (!challenge?.problem) {
      return {
        date: dayKey(date),
        problem: null,
        completion: null,
        rewardXp: 0
      };
    }

    return {
      date: dayKey(date),
      problem: challenge.problem,
      completion: challenge.completion ?? null,
      rewardXp: challenge.rewardXp
    };
  }

  async problemSets(input: { userId?: string }) {
    await this.ensureDefaultCollections("CURATED_LIST");
    const page = await this.repository.listLearningCollections({
      type: "CURATED_LIST",
      page: 1,
      limit: 100,
      userId: input.userId
    });
    return page.items.map((collection) => this.collectionSummary(collection, false));
  }

  async problemSet(slug: string, input: { userId?: string }) {
    await this.ensureDefaultCollections("CURATED_LIST");
    const collection = await this.repository.findLearningCollectionBySlug({
      type: "CURATED_LIST",
      slug,
      userId: input.userId
    });
    if (!collection) {
      throw ApiError.notFound("Problem set not found");
    }
    return this.collectionSummary(collection, true);
  }

  async nextRecommendation(input: { userId?: string }) {
    const all = await this.publicProblems(input.userId);
    const unsolved = all.filter((problem) => problem.status !== "SOLVED");

    if (unsolved.length === 0) {
      return {
        problem: null,
        reason: "All available public problems are solved.",
        recommendedTag: null
      };
    }

    const skippedProblemIds = await this.skippedProblemIds(input.userId);
    const solvedCount = all.filter((problem) => problem.status === "SOLVED").length;
    const targetDifficulty = targetDifficultyForSolvedCount(solvedCount);
    const targetTag = this.recommendedTagFor(all);

    const candidatePool = targetTag
      ? unsolved.filter((problem) => problem.tags.some((tag) => tag.slug === targetTag))
      : unsolved;
    const sortedCandidates = candidatePool.sort(
      (a, b) =>
        recommendationScore(a, targetDifficulty, skippedProblemIds) -
        recommendationScore(b, targetDifficulty, skippedProblemIds)
    );
    const problem = sortedCandidates[0] ?? unsolved[0];
    const label = targetTag ? targetTag.replace(/-/g, " ") : "core practice";

    return {
      problem,
      reason: input.userId
        ? `Recommended because ${label} is one of your least-completed available topics.`
        : "Recommended starter problem from the public problem set.",
      recommendedTag: targetTag
    };
  }

  async studyPlans(input: { userId?: string }) {
    await this.ensureDefaultCollections("STUDY_PLAN");
    const page = await this.repository.listLearningCollections({
      type: "STUDY_PLAN",
      page: 1,
      limit: 100,
      userId: input.userId
    });
    const plans = [];
    for (const collection of page.items) {
      plans.push(await this.studyPlanSummary(collection, false, input.userId));
    }
    return plans;
  }

  async studyPlan(slug: string, input: { userId?: string }) {
    await this.ensureDefaultCollections("STUDY_PLAN");
    const collection = await this.repository.findLearningCollectionBySlug({
      type: "STUDY_PLAN",
      slug,
      userId: input.userId
    });
    if (!collection) {
      throw ApiError.notFound("Study plan not found");
    }
    return this.studyPlanSummary(collection, true, input.userId);
  }

  async revisionQueue(input: { userId?: string }) {
    const all = await this.publicProblems(input.userId);
    const attempted = all.filter((problem) => problem.status === "ATTEMPTED");
    const fallback = all
      .filter((problem) => problem.status !== "SOLVED")
      .sort((a, b) => recommendationScore(b) - recommendationScore(a));

    const problems = (attempted.length ? attempted : fallback).slice(0, 20);

    return {
      title: "Revision Queue",
      reason: attempted.length
        ? "Problems you tried but have not solved yet."
        : "Harder unsolved problems to revisit once you have more attempts.",
      totalProblems: problems.length,
      problems
    };
  }

  async getBySlug(slug: string, input: { userId?: string } = {}) {
    const problem = await this.repository.findProblemBySlug(slug);

    // only public problems are visible to normal users
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    if (problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    const sampleTestCases = await this.repository.listTestCases(problem.id, true);
    let status: ProblemStatus | undefined;
    if (input.userId) {
      const solvedStatus = await this.repository.getProblemSolvedStatus(input.userId, problem.id);
      status = solvedStatus?.solved ? "SOLVED" : solvedStatus?.attempted ? "ATTEMPTED" : "NOT_ATTEMPTED";
    }

    return {
      ...problem,
      ...(status ? { status } : {}),
      sampleTestCases
    };
  }

  async create(input: CreateProblemInput) {
    // custom checker needs the checker asset first - can't enable it on create
    if (input.checkerMode === "CUSTOM_CHECKER") {
      throw ApiError.badRequest("Create the problem and checker asset before enabling custom checker mode");
    }

    const created = await this.repository.createProblem(input);
    return created;
  }

  async update(id: string, input: UpdateProblemInput) {
    await this.requireProblem(id);

    // if switching to custom checker, make sure the asset exists
    if (input.checkerMode === "CUSTOM_CHECKER") {
      const checker = await this.repository.findActiveProblemAsset(id, "CHECKER");
      if (!checker) {
        throw ApiError.badRequest("checker asset is required");
      }
    }

    const updated = await this.repository.updateProblem(id, input);
    return updated;
  }

  async archive(id: string): Promise<void> {
    await this.requireProblem(id);
    await this.repository.archiveProblem(id);
  }

  async addTestCase(problemId: string, input: Omit<Parameters<AppRepository["addTestCase"]>[0], "problemId">) {
    await this.requireProblem(problemId);

    const created = await this.repository.addTestCase({
      ...input,
      problemId
    });
    return created;
  }

  async updateTestCase(id: string, input: Parameters<AppRepository["updateTestCase"]>[1]) {
    const updated = await this.repository.updateTestCase(id, input);
    return updated;
  }

  async deleteTestCase(id: string): Promise<void> {
    await this.repository.deleteTestCase(id);
  }

  async tags() {
    const allTags = await this.repository.listTags();
    return allTags;
  }

  async companies() {
    return this.repository.listCompanies();
  }

  async adminCollections(input: {
    type: "STUDY_PLAN" | "CURATED_LIST";
    page?: unknown;
    limit?: unknown;
    userId?: string;
  }) {
    const pagination = getPagination(input);
    return this.repository.listLearningCollections({
      type: input.type,
      page: pagination.page,
      limit: pagination.limit,
      includeNonPublic: true,
      userId: input.userId
    });
  }

  async createCollection(
    type: "STUDY_PLAN" | "CURATED_LIST",
    actorId: string,
    input: Omit<CreateLearningCollectionInput, "type" | "createdById">
  ) {
    return this.repository.createLearningCollection({ ...input, type, createdById: actorId });
  }

  async updateCollection(id: string, input: UpdateLearningCollectionInput) {
    return this.repository.updateLearningCollection(id, input);
  }

  async deleteCollection(id: string): Promise<void> {
    await this.repository.deleteLearningCollection(id);
  }

  async setCollectionItems(id: string, items: LearningCollectionItemInput[]) {
    return this.repository.setLearningCollectionItems(id, items);
  }

  async adminDailyChallenges(input: { page?: unknown; limit?: unknown }) {
    const pagination = getPagination(input);
    return this.repository.listDailyChallenges(pagination);
  }

  async upsertDailyChallenge(actorId: string, input: Omit<UpsertDailyChallengeInput, "assignedById">) {
    return this.repository.upsertDailyChallenge({ ...input, assignedById: actorId });
  }

  async badgeDefinitions(includeInactive = false) {
    return this.repository.listBadgeDefinitions(includeInactive);
  }

  async createBadgeDefinition(
    actorId: string,
    input: {
      key: string;
      name: string;
      description: string;
      icon?: string | null;
      triggerType: string;
      triggerValue?: number;
      isActive?: boolean;
    }
  ) {
    return this.repository.createBadgeDefinition({ ...input, createdById: actorId });
  }

  async updateBadgeDefinition(
    id: string,
    input: {
      name?: string;
      description?: string;
      icon?: string | null;
      triggerType?: string;
      triggerValue?: number;
      isActive?: boolean;
    }
  ) {
    return this.repository.updateBadgeDefinition(id, input);
  }

  private async publicProblems(userId?: string): Promise<ProblemWithStatus[]> {
    const page = await this.repository.listProblems({
      page: 1,
      limit: 500,
      userId,
      sort: "newest"
    });
    return page.items;
  }

  private recommendedTagFor(problems: ProblemWithStatus[]): string | null {
    const solvedTagCounts = new Map<string, number>();
    const weakTagScores = new Map<string, number>();

    for (const problem of problems) {
      for (const tag of problem.tags) {
        if (problem.status === "SOLVED") {
          solvedTagCounts.set(tag.slug, (solvedTagCounts.get(tag.slug) ?? 0) + 1);
        } else {
          const attemptPenalty = problem.status === "ATTEMPTED" ? 4 : 1;
          weakTagScores.set(tag.slug, (weakTagScores.get(tag.slug) ?? 0) + attemptPenalty);
        }
      }
    }

    let targetTag: string | null = null;
    let bestWeaknessScore = Number.NEGATIVE_INFINITY;
    for (const [tag, weakScore] of weakTagScores.entries()) {
      const solvedCount = solvedTagCounts.get(tag) ?? 0;
      const score = weakScore - solvedCount * 0.75;
      if (score > bestWeaknessScore) {
        bestWeaknessScore = score;
        targetTag = tag;
      }
    }

    return targetTag;
  }

  private buildProblemSet(definition: (typeof CURATED_PROBLEM_SETS)[number], all: ProblemWithStatus[]) {
    let problems = definition.tags.length
      ? all.filter((problem) =>
          problem.tags.some(
            (tag) => definition.tags.includes(tag.slug) || definition.tags.includes(tag.name.toLowerCase())
          )
        )
      : all;

    if (definition.slug === "top-75") {
      problems = [...problems].sort((a, b) => {
        const diff = recommendationScore(a) - recommendationScore(b);
        if (diff !== 0) return diff;
        return (b.frequency ?? 0) - (a.frequency ?? 0);
      });
      problems = problems.slice(0, 75);
    }

    let solvedCount = 0;
    for (const problem of problems) {
      if (problem.status === "SOLVED") {
        solvedCount += 1;
      }
    }

    return { problems, solvedCount };
  }

  private buildStudyPlan(definition: (typeof STUDY_PLANS)[number], all: ProblemWithStatus[]) {
    let problems = all.filter((problem) =>
      problem.tags.some((tag) => definition.tags.includes(tag.slug) || definition.tags.includes(tag.name.toLowerCase()))
    );

    if (problems.length === 0) {
      problems = all.slice(0, 20);
    }

    problems = [...problems].sort((a, b) => {
      const diff = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
      if (diff !== 0) return diff;
      return (b.frequency ?? 0) - (a.frequency ?? 0) || a.title.localeCompare(b.title);
    });

    return { problems };
  }

  private collectionSummary(collection: LearningCollectionWithItems, includeProblems: boolean) {
    const problems = collection.items
      .map((item) => item.problem)
      .filter((problem): problem is ProblemWithStatus => Boolean(problem));
    const solvedCount = problems.filter((problem) => problem.status === "SOLVED").length;
    const base = {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      visibility: collection.visibility,
      totalProblems: problems.length,
      solvedCount,
      progressPercent: problems.length ? Math.round((solvedCount / problems.length) * 100) : 0
    };
    return includeProblems ? { ...base, problems } : base;
  }

  private async studyPlanSummary(collection: LearningCollectionWithItems, includeProblems: boolean, userId?: string) {
    const problems = collection.items
      .map((item) => item.problem)
      .filter((problem): problem is ProblemWithStatus => Boolean(problem));
    const solvedCount = problems.filter((problem) => problem.status === "SOLVED").length;
    const initialUnlock = collection.dailyUnlockCount > 0 ? collection.dailyUnlockCount : problems.length;
    const progress = await this.progressForCollection(collection, userId, solvedCount, problems.length, initialUnlock);
    const unlockedCount = Math.min(problems.length, Math.max(initialUnlock, progress?.unlockedCount ?? initialUnlock));
    const unlockedProblems = problems.slice(0, unlockedCount);
    const todayProblem =
      unlockedProblems.find((problem) => problem.status !== "SOLVED") ?? unlockedProblems[0] ?? problems[0] ?? null;

    const base = {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      badge: collection.badge,
      visibility: collection.visibility,
      totalProblems: problems.length,
      solvedCount,
      progressPercent: problems.length ? Math.round((solvedCount / problems.length) * 100) : 0,
      dailyUnlockCount: collection.dailyUnlockCount,
      unlockedCount,
      todayProblem,
      progress
    };

    if (!includeProblems) {
      return base;
    }

    return {
      ...base,
      problems: problems.map((problem, index) => ({
        ...problem,
        locked: index >= unlockedCount
      }))
    };
  }

  private async progressForCollection(
    collection: LearningCollectionWithItems,
    userId: string | undefined,
    solvedCount: number,
    totalProblems: number,
    initialUnlock: number
  ) {
    if (!userId) {
      return collection.progress ?? null;
    }
    const startedAt = collection.progress?.startedAt ?? new Date();
    const daysActive = Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const dailyTarget = collection.dailyUnlockCount > 0 ? daysActive * collection.dailyUnlockCount : totalProblems;
    const unlockedCount = Math.min(
      totalProblems,
      Math.max(collection.progress?.unlockedCount ?? 0, initialUnlock, solvedCount + initialUnlock, dailyTarget)
    );
    const completedAt =
      totalProblems > 0 && solvedCount >= totalProblems ? (collection.progress?.completedAt ?? new Date()) : null;
    const progress = await this.repository.upsertLearningProgress({
      collectionId: collection.id,
      userId,
      unlockedCount,
      completedCount: solvedCount,
      completedAt
    });
    if (completedAt) {
      await this.repository.awardBadge({
        userId,
        badgeKey: "study-plan-complete",
        sourceType: "STUDY_PLAN",
        sourceId: collection.id
      });
    }
    return progress;
  }

  private async ensureDailyChallenge(date: Date): Promise<void> {
    const existing = await this.repository.findDailyChallengeByDate(date);
    if (existing) return;
    const all = await this.publicProblems();
    if (all.length === 0) return;
    const index = dailyIndex(date, all.length);
    await this.repository.upsertDailyChallenge({
      date,
      problemId: all[index].id,
      rewardXp: 10
    });
  }

  private async ensureDefaultCollections(type: "STUDY_PLAN" | "CURATED_LIST"): Promise<void> {
    const definitions = type === "STUDY_PLAN" ? STUDY_PLANS : CURATED_PROBLEM_SETS;
    const all = await this.publicProblems();
    for (const definition of definitions) {
      const existing = await this.repository.findLearningCollectionBySlug({
        type,
        slug: definition.slug,
        includeNonPublic: true
      });
      if (existing) continue;
      const badge = type === "STUDY_PLAN" ? (definition as (typeof STUDY_PLANS)[number]).badge : null;
      const dailyUnlockCount =
        type === "STUDY_PLAN" ? (definition as (typeof STUDY_PLANS)[number]).dailyUnlockCount : 0;
      const collection = await this.repository.createLearningCollection({
        type,
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        badge,
        dailyUnlockCount,
        visibility: "PUBLIC"
      });
      const selected =
        type === "STUDY_PLAN"
          ? this.buildStudyPlan(definition as (typeof STUDY_PLANS)[number], all).problems
          : this.buildProblemSet(definition as (typeof CURATED_PROBLEM_SETS)[number], all).problems;
      await this.repository.setLearningCollectionItems(
        collection.id,
        selected.map((problem, index) => ({ problemId: problem.id, order: index }))
      );
    }
  }

  private async skippedProblemIds(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set();
    const sessions = await this.repository.listPracticeSessions({ userId, page: 1, limit: 100 });
    const skipped = new Set<string>();
    for (const session of sessions.items) {
      for (const problem of session.problems) {
        if (problem.outcome === "SKIPPED") {
          skipped.add(problem.problemId);
        }
      }
    }
    return skipped;
  }

  // helper so we don't repeat the not-found check
  private async requireProblem(id: string) {
    const problem = await this.repository.findProblemById(id);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dailyIndex(date: Date, totalProblems: number): number {
  const key = dayKey(date);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % totalProblems;
  }
  return hash;
}

function recommendationScore(
  problem: ProblemWithStatus,
  targetDifficulty: Difficulty = "EASY",
  skippedProblemIds: Set<string> = new Set()
): number {
  const statusPenalty = problem.status === "ATTEMPTED" ? 0 : 1;
  const difficultyDistance = Math.abs(difficultyRank(problem.difficulty) - difficultyRank(targetDifficulty));
  const skipPenalty = skippedProblemIds.has(problem.id) ? 100 : 0;
  return difficultyDistance * 20 + difficultyRank(problem.difficulty) * 5 + statusPenalty + skipPenalty;
}

function targetDifficultyForSolvedCount(solvedCount: number): Difficulty {
  if (solvedCount < 5) {
    return "EASY";
  }
  if (solvedCount < 25) {
    return "MEDIUM";
  }
  return "HARD";
}

function difficultyRank(difficulty: Difficulty): number {
  const difficultyOrder: Record<Difficulty, number> = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3
  };

  return difficultyOrder[difficulty];
}
