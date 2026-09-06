import type { Request, Response } from "express";
import type { ProblemService } from "../services/ProblemService";
import { sendSuccess } from "../utils/apiResponse";

export class ProblemController {
  constructor(private readonly problemService: ProblemService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    // optional auth - if logged in we can show solved status
    const userId = req.user ? req.user.id : undefined;
    const query = { ...req.query, userId };

    const page = await this.problemService.list(query);

    sendSuccess(res, "Problems", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  adminList = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const query = { ...req.query, userId };

    const page = await this.problemService.adminList(query);

    sendSuccess(res, "Admin problems", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  dailyChallenge = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const challenge = await this.problemService.dailyChallenge({ userId });
    sendSuccess(res, "Daily challenge", challenge);
  };

  problemSets = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const sets = await this.problemService.problemSets({ userId });
    sendSuccess(res, "Problem sets", sets);
  };

  problemSet = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const set = await this.problemService.problemSet(req.params.slug, { userId });
    sendSuccess(res, "Problem set", set);
  };

  nextRecommendation = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const recommendation = await this.problemService.nextRecommendation({ userId });
    sendSuccess(res, "Next recommended problem", recommendation);
  };

  studyPlans = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const plans = await this.problemService.studyPlans({ userId });
    sendSuccess(res, "Study plans", plans);
  };

  studyPlan = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const plan = await this.problemService.studyPlan(req.params.slug, { userId });
    sendSuccess(res, "Study plan", plan);
  };

  revisionQueue = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user ? req.user.id : undefined;
    const queue = await this.problemService.revisionQueue({ userId });
    sendSuccess(res, "Revision queue", queue);
  };

  tags = async (_req: Request, res: Response): Promise<void> => {
    const tags = await this.problemService.tags();
    sendSuccess(res, "Tags", tags);
  };

  companies = async (_req: Request, res: Response): Promise<void> => {
    const companies = await this.problemService.companies();
    sendSuccess(res, "Companies", companies);
  };

  adminProblemSets = async (req: Request, res: Response): Promise<void> => {
    const page = await this.problemService.adminCollections({
      type: "CURATED_LIST",
      page: req.query.page,
      limit: req.query.limit,
      userId: req.user?.id
    });
    sendSuccess(res, "Admin problem sets", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  adminStudyPlans = async (req: Request, res: Response): Promise<void> => {
    const page = await this.problemService.adminCollections({
      type: "STUDY_PLAN",
      page: req.query.page,
      limit: req.query.limit,
      userId: req.user?.id
    });
    sendSuccess(res, "Admin study plans", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  createProblemSet = async (req: Request, res: Response): Promise<void> => {
    const collection = await this.problemService.createCollection("CURATED_LIST", req.user!.id, req.body);
    sendSuccess(res, "Problem set created", collection, undefined, 201);
  };

  createStudyPlan = async (req: Request, res: Response): Promise<void> => {
    const collection = await this.problemService.createCollection("STUDY_PLAN", req.user!.id, req.body);
    sendSuccess(res, "Study plan created", collection, undefined, 201);
  };

  updateCollection = async (req: Request, res: Response): Promise<void> => {
    const collection = await this.problemService.updateCollection(req.params.id, req.body);
    sendSuccess(res, "Collection updated", collection);
  };

  deleteCollection = async (req: Request, res: Response): Promise<void> => {
    await this.problemService.deleteCollection(req.params.id);
    sendSuccess(res, "Collection deleted", {});
  };

  setCollectionItems = async (req: Request, res: Response): Promise<void> => {
    const items = await this.problemService.setCollectionItems(req.params.id, req.body.items);
    sendSuccess(res, "Collection items updated", items);
  };

  adminDailyChallenges = async (req: Request, res: Response): Promise<void> => {
    const page = await this.problemService.adminDailyChallenges({
      page: req.query.page,
      limit: req.query.limit
    });
    sendSuccess(res, "Daily challenges", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  upsertDailyChallenge = async (req: Request, res: Response): Promise<void> => {
    const challenge = await this.problemService.upsertDailyChallenge(req.user!.id, {
      date: parsedDateParam(req, "date"),
      problemId: req.body.problemId,
      rewardXp: req.body.rewardXp
    });
    sendSuccess(res, "Daily challenge saved", challenge);
  };

  badgeDefinitions = async (req: Request, res: Response): Promise<void> => {
    const includeInactive = req.query.includeInactive === "true";
    const badges = await this.problemService.badgeDefinitions(includeInactive);
    sendSuccess(res, "Badge definitions", badges);
  };

  createBadgeDefinition = async (req: Request, res: Response): Promise<void> => {
    const badge = await this.problemService.createBadgeDefinition(req.user!.id, req.body);
    sendSuccess(res, "Badge definition created", badge, undefined, 201);
  };

  updateBadgeDefinition = async (req: Request, res: Response): Promise<void> => {
    const badge = await this.problemService.updateBadgeDefinition(req.params.id, req.body);
    sendSuccess(res, "Badge definition updated", badge);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;
    const problem = await this.problemService.getBySlug(slug, { userId: req.user?.id });
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
    // soft delete / archive - problem is not hard-deleted
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

function parsedDateParam(req: Request, key: string): Date {
  // The validation middleware writes Zod-transformed params back onto req.params.
  const value = (req.params as Record<string, unknown>)[key];
  if (value instanceof Date) {
    return value;
  }
  return new Date(String(value));
}
