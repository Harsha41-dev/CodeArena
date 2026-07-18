import type { Request, Response } from "express";
import type { TestCaseGenerationService } from "../services/TestCaseGenerationService";
import { sendSuccess } from "../utils/apiResponse";

// admin endpoints for generators / checkers / batch jobs
export class TestCaseGenerationController {
  constructor(private readonly service: TestCaseGenerationService) {}

  listAssets = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const assets = await this.service.listAssets(problemId);
    sendSuccess(res, "Problem assets", assets);
  };

  createAsset = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const userId = req.user!.id;
    const asset = await this.service.createAsset(problemId, userId, req.body);
    sendSuccess(res, "Problem asset created", asset, undefined, 201);
  };

  updateAsset = async (req: Request, res: Response): Promise<void> => {
    const assetId = req.params.assetId;
    const asset = await this.service.updateAsset(assetId, req.body);
    sendSuccess(res, "Problem asset updated", asset);
  };

  deleteAsset = async (req: Request, res: Response): Promise<void> => {
    const assetId = req.params.assetId;
    await this.service.deleteAsset(assetId);
    sendSuccess(res, "Problem asset deactivated", {});
  };

  setCheckerMode = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const checkerMode = req.body.checkerMode;
    const problem = await this.service.setCheckerMode(problemId, checkerMode);
    sendSuccess(res, "Checker mode updated", problem);
  };

  previewChecker = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const result = await this.service.previewChecker(problemId, req.body);
    sendSuccess(res, "Checker preview", result);
  };

  preview = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const result = await this.service.preview(problemId, req.body);
    sendSuccess(res, "Generated test preview", result);
  };

  createJob = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const userId = req.user!.id;
    const job = await this.service.startJob(problemId, userId, req.body);
    sendSuccess(res, "Test generation job queued", job, undefined, 201);
  };

  listJobs = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const jobs = await this.service.listJobs(problemId);
    sendSuccess(res, "Test generation jobs", jobs);
  };

  getJob = async (req: Request, res: Response): Promise<void> => {
    const jobId = req.params.jobId;
    const job = await this.service.getJob(jobId);
    sendSuccess(res, "Test generation job", job);
  };

  cancelJob = async (req: Request, res: Response): Promise<void> => {
    const jobId = req.params.jobId;
    const job = await this.service.cancelJob(jobId);
    sendSuccess(res, "Test generation job cancelled", job);
  };

  listBatches = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const batches = await this.service.listBatches(problemId);
    sendSuccess(res, "Generated test case batches", batches);
  };

  deleteBatch = async (req: Request, res: Response): Promise<void> => {
    const batchId = req.params.batchId;
    await this.service.deleteBatch(batchId);
    sendSuccess(res, "Generated test case batch deleted", {});
  };
}
