import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";
import type { Contest, ContestProblem } from "../types/domain";

// contests: list, create, register, leaderboard, etc.
export class ContestService {
  constructor(private readonly repository: AppRepository) {}

  async list() {
    const contests = await this.repository.listContests();

    // only show public ones on the public list
    const publicOnes = [];
    for (let i = 0; i < contests.length; i++) {
      const contest = this.withDerivedStatus(contests[i]);
      if (contest.visibility === "PUBLIC") {
        publicOnes.push(contest);
      }
    }
    return publicOnes;
  }

  async get(id: string, includeNonPublic = false) {
    const contest = await this.repository.findContestById(id);

    if (!contest) {
      throw ApiError.notFound("Contest not found");
    }

    // admins can pass includeNonPublic to edit private/archived contests
    if (!includeNonPublic && contest.visibility !== "PUBLIC") {
      throw ApiError.notFound("Contest not found");
    }

    return this.withDerivedStatus(contest);
  }

  async create(input: {
    title: string;
    slug: string;
    description: string;
    startTime: Date;
    endTime: Date;
    problemIds: string[];
    createdById?: string | null;
    visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
    freezeStartsAt?: Date | null;
    isRated?: boolean;
    ratingSeason?: string | null;
    ratingScheduledAt?: Date | null;
  }) {
    // basic time validation
    if (input.endTime <= input.startTime) {
      throw ApiError.badRequest("Contest end time must be after start time");
    }

    // no duplicate problems in the same contest
    const uniqueIds = new Set(input.problemIds);
    if (uniqueIds.size !== input.problemIds.length) {
      throw ApiError.badRequest("Contest cannot contain duplicate problems");
    }

    // make sure every problem actually exists
    for (let i = 0; i < input.problemIds.length; i++) {
      const problemId = input.problemIds[i];
      const problem = await this.repository.findProblemById(problemId);
      if (!problem) {
        throw ApiError.badRequest(`Problem ${problemId} does not exist`);
      }
    }

    if (input.freezeStartsAt && (input.freezeStartsAt <= input.startTime || input.freezeStartsAt >= input.endTime)) {
      throw ApiError.badRequest("Leaderboard freeze must be between contest start and end time");
    }

    const created = await this.repository.createContest(input);
    if (created.isRated) {
      await this.repository.createContestRatingJob({
        contestId: created.id,
        requestedById: input.createdById,
        scheduledAt: input.ratingScheduledAt ?? input.endTime
      });
    }
    return this.withDerivedStatus({ ...created, problems: [] });
  }

  async adminList() {
    // admin gets everything including private/archived
    const contests = await this.repository.listContests();
    return contests.map((contest) => this.withDerivedStatus(contest));
  }

  async update(
    id: string,
    input: {
      title?: string;
      slug?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
      status?: "UPCOMING" | "LIVE" | "ENDED";
      visibility?: "PUBLIC" | "PRIVATE" | "ARCHIVED";
      freezeStartsAt?: Date | null;
      isRated?: boolean;
      ratingSeason?: string | null;
      ratingScheduledAt?: Date | null;
    }
  ) {
    const contest = await this.get(id, true);

    // use existing times if not provided in the update
    let startTime = contest.startTime;
    if (input.startTime !== undefined) {
      startTime = input.startTime;
    }

    let endTime = contest.endTime;
    if (input.endTime !== undefined) {
      endTime = input.endTime;
    }

    if (endTime <= startTime) {
      throw ApiError.badRequest("Contest end time must be after start time");
    }
    if (input.freezeStartsAt && (input.freezeStartsAt <= startTime || input.freezeStartsAt >= endTime)) {
      throw ApiError.badRequest("Leaderboard freeze must be between contest start and end time");
    }

    const updated = await this.repository.updateContest(id, input);
    return this.withDerivedStatus(updated);
  }

  async delete(id: string): Promise<void> {
    await this.get(id, true);
    await this.repository.deleteContest(id);
  }

  async addProblem(contestId: string, problemId: string, points: number) {
    await this.get(contestId, true);

    const problem = await this.repository.findProblemById(problemId);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }

    const row = await this.repository.addContestProblem(contestId, problemId, points);
    return row;
  }

  async removeProblem(contestId: string, problemId: string): Promise<void> {
    await this.get(contestId, true);
    await this.repository.removeContestProblem(contestId, problemId);
  }

  async register(contestId: string, userId: string) {
    // public-only - students shouldn't register for private contests via this path
    await this.get(contestId);
    const registration = await this.repository.registerForContest(contestId, userId);
    return registration;
  }

  async leaderboard(contestId: string) {
    const contest = await this.get(contestId);
    let before: Date | undefined;
    if (contest.freezeStartsAt && Date.now() >= contest.freezeStartsAt.getTime() && Date.now() < contest.endTime.getTime()) {
      before = contest.freezeStartsAt;
    }
    const rows = await this.repository.getContestLeaderboard(contestId, before ? { before } : undefined);
    return rows;
  }

  async announcements(contestId: string) {
    await this.get(contestId);
    return this.repository.listContestAnnouncements(contestId);
  }

  async createAnnouncement(contestId: string, authorId: string, input: { title: string; content: string }) {
    await this.get(contestId, true);
    return this.repository.createContestAnnouncement({
      contestId,
      authorId,
      title: input.title,
      content: input.content
    });
  }

  private withDerivedStatus<T extends Contest & { problems?: ContestProblem[] }>(contest: T): T {
    const now = Date.now();
    let status: Contest["status"] = "LIVE";
    if (now < contest.startTime.getTime()) {
      status = "UPCOMING";
    } else if (now > contest.endTime.getTime()) {
      status = "ENDED";
    }
    return { ...contest, status };
  }
}
