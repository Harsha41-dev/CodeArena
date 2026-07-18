import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";

// contests: list, create, register, leaderboard, etc.
export class ContestService {
  constructor(private readonly repository: AppRepository) {}

  async list() {
    const contests = await this.repository.listContests();

    // only show public ones on the public list
    const publicOnes = [];
    for (let i = 0; i < contests.length; i++) {
      const contest = contests[i];
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

    return contest;
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

    const created = await this.repository.createContest(input);
    return created;
  }

  async adminList() {
    // admin gets everything including private/archived
    const contests = await this.repository.listContests();
    return contests;
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

    const updated = await this.repository.updateContest(id, input);
    return updated;
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
    // public-only — students shouldn't register for private contests via this path
    await this.get(contestId);
    const registration = await this.repository.registerForContest(contestId, userId);
    return registration;
  }

  async leaderboard(contestId: string) {
    await this.get(contestId);
    const rows = await this.repository.getContestLeaderboard(contestId);
    return rows;
  }
}
