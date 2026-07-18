import type { Request, Response } from "express";
import type { ContestService } from "../services/ContestService";
import type { SubmissionService } from "../services/SubmissionService";
import { sendSuccess } from "../utils/apiResponse";

export class ContestController {
  constructor(
    private readonly contestService: ContestService,
    private readonly submissionService: SubmissionService
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const contests = await this.contestService.list();
    sendSuccess(res, "Contests", contests);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const contest = await this.contestService.get(id);
    sendSuccess(res, "Contest", contest);
  };

  adminGet = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const contest = await this.contestService.get(id, true);
    sendSuccess(res, "Contest", contest);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const createdById = req.user!.id;
    const contest = await this.contestService.create({
      ...req.body,
      createdById
    });
    sendSuccess(res, "Contest created", contest, undefined, 201);
  };

  adminList = async (_req: Request, res: Response): Promise<void> => {
    const contests = await this.contestService.adminList();
    sendSuccess(res, "Admin contests", contests);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const contest = await this.contestService.update(id, req.body);
    sendSuccess(res, "Contest updated", contest);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    await this.contestService.delete(id);
    sendSuccess(res, "Contest deleted", {});
  };

  addProblem = async (req: Request, res: Response): Promise<void> => {
    const contestId = req.params.id;
    const problemId = req.body.problemId as string;
    // default points if admin forgets to pass it
    let points = 100;
    if (req.body.points !== undefined && req.body.points !== null) {
      points = req.body.points as number;
    }

    const result = await this.contestService.addProblem(contestId, problemId, points);
    sendSuccess(res, "Contest problem added", result, undefined, 201);
  };

  removeProblem = async (req: Request, res: Response): Promise<void> => {
    const contestId = req.params.id;
    const problemId = req.params.problemId;
    await this.contestService.removeProblem(contestId, problemId);
    sendSuccess(res, "Contest problem removed", {});
  };

  register = async (req: Request, res: Response): Promise<void> => {
    const contestId = req.params.id;
    const userId = req.user!.id;
    const result = await this.contestService.register(contestId, userId);
    sendSuccess(res, "Contest registration complete", result, undefined, 201);
  };

  leaderboard = async (req: Request, res: Response): Promise<void> => {
    const contestId = req.params.id;
    const rows = await this.contestService.leaderboard(contestId);
    sendSuccess(res, "Contest leaderboard", rows);
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const contestId = req.params.id;
    const userId = req.user!.id;

    const submission = await this.submissionService.submit(userId, {
      ...req.body,
      contestId
    });

    sendSuccess(
      res,
      "Contest submission queued",
      {
        submissionId: submission.id,
        status: submission.status
      },
      undefined,
      201
    );
  };
}
