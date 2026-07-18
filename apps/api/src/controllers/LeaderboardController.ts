import type { Request, Response } from "express";
import type { LeaderboardService } from "../services/LeaderboardService";
import { sendSuccess } from "../utils/apiResponse";

export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  global = async (_req: Request, res: Response): Promise<void> => {
    const rows = await this.leaderboardService.global();
    sendSuccess(res, "Global leaderboard", rows);
  };

  problem = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;
    const rows = await this.leaderboardService.problem(slug);
    sendSuccess(res, "Problem leaderboard", rows);
  };

  // admin only — used to freeze ranks for "moved up/down" UI
  snapshot = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.leaderboardService.snapshot();
    sendSuccess(res, "Leaderboard snapshot generated", result, undefined, 201);
  };
}
