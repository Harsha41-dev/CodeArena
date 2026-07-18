import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";

// global + per-problem leaderboards, and the daily snapshot job
export class LeaderboardService {
  constructor(private readonly repository: AppRepository) {}

  async global() {
    const rows = await this.repository.getGlobalLeaderboard();
    return rows;
  }

  async problem(slug: string) {
    const problem = await this.repository.findProblemBySlug(slug);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }

    const rows = await this.repository.getProblemLeaderboard(problem.id);
    return rows;
  }

  async snapshot() {
    // snapshot date is always "today" at midnight UTC
    const now = new Date();
    const isoDate = now.toISOString().slice(0, 10);
    const snapshotDate = new Date(`${isoDate}T00:00:00.000Z`);

    const snapshots = await this.repository.generateLeaderboardSnapshot(snapshotDate);
    return snapshots;
  }
}
