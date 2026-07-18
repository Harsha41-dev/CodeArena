import type { Request, Response } from "express";
import type { ProblemService } from "../services/ProblemService";
import { sendSuccess } from "../utils/apiResponse";

export class ProblemController {
  constructor(private readonly problemService: ProblemService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    // optional auth — if logged in we can show solved status
    const userId = req.user ? req.user.id : undefined;
    const query = { ...req.query, userId };

    const page = await this.problemService.list(query);

    sendSuccess(res, "Problems", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  tags = async (_req: Request, res: Response): Promise<void> => {
    const tags = await this.problemService.tags();
    sendSuccess(res, "Tags", tags);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;
    const problem = await this.problemService.getBySlug(slug);
    sendSuccess(res, "Problem", problem);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const createdById = req.user!.id;
    const problem = await this.problemService.create({
      ...req.body,
      createdById
    });
    sendSuccess(res, "Problem created", problem, undefined, 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const updated = await this.problemService.update(id, req.body);
    sendSuccess(res, "Problem updated", updated);
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    await this.problemService.archive(id);
    // soft delete / archive — problem is not hard-deleted
    sendSuccess(res, "Problem archived", {});
  };

  addTestCase = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.id;
    const testCase = await this.problemService.addTestCase(problemId, req.body);
    sendSuccess(res, "Test case created", testCase, undefined, 201);
  };

  updateTestCase = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const testCase = await this.problemService.updateTestCase(id, req.body);
    sendSuccess(res, "Test case updated", testCase);
  };

  deleteTestCase = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    await this.problemService.deleteTestCase(id);
    sendSuccess(res, "Test case deleted", {});
  };
}
