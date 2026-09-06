import type { Request, Response } from "express";
import type { PracticeService } from "../services/PracticeService";
import { sendSuccess } from "../utils/apiResponse";

export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  start = async (req: Request, res: Response): Promise<void> => {
    const session = await this.practiceService.start(req.user!.id, req.body);
    sendSuccess(res, "Practice session started", session, undefined, 201);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const page = await this.practiceService.list(req.user!.id, {
      type: req.query.type as "VIRTUAL_CONTEST" | "MOCK_INTERVIEW" | undefined,
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Practice sessions", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const session = await this.practiceService.get(req.user!.id, req.params.id, req.user!.role === "ADMIN");
    sendSuccess(res, "Practice session", session);
  };

  updateProblem = async (req: Request, res: Response): Promise<void> => {
    const item = await this.practiceService.updateProblem(
      req.user!.id,
      req.params.id,
      req.params.problemItemId,
      req.body,
      req.user!.role === "ADMIN"
    );
    sendSuccess(res, "Practice problem updated", item);
  };

  finish = async (req: Request, res: Response): Promise<void> => {
    const session = await this.practiceService.finish(req.user!.id, req.params.id, req.body, req.user!.role === "ADMIN");
    sendSuccess(res, "Practice session finished", session);
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const session = await this.practiceService.cancel(req.user!.id, req.params.id, req.user!.role === "ADMIN");
    sendSuccess(res, "Practice session cancelled", session);
  };
}
