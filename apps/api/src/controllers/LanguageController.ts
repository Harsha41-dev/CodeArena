import type { Request, Response } from "express";
import type { LanguageService } from "../services/LanguageService";
import { sendSuccess } from "../utils/apiResponse";

export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const languages = await this.languageService.listPublic();
    sendSuccess(res, "Languages", languages);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const key = req.params.key;
    const language = await this.languageService.getPublic(key);
    sendSuccess(res, "Language", language);
  };

  problemLanguages = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;
    const options = await this.languageService.problemLanguages(slug);
    sendSuccess(res, "Problem languages", options);
  };

  adminProblemLanguages = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const options = await this.languageService.adminProblemLanguages(problemId);
    sendSuccess(res, "Admin problem languages", options);
  };

  adminList = async (_req: Request, res: Response): Promise<void> => {
    const languages = await this.languageService.listAdmin();
    sendSuccess(res, "Admin languages", languages);
  };

  adminCreate = async (req: Request, res: Response): Promise<void> => {
    const created = await this.languageService.createLanguage(req.body);
    sendSuccess(res, "Language created", created, undefined, 201);
  };

  adminUpdate = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const updated = await this.languageService.updateLanguage(id, req.body);
    sendSuccess(res, "Language updated", updated);
  };

  adminDelete = async (req: Request, res: Response): Promise<void> => {
    // soft-disable so old submissions still show the language name
    const id = req.params.id;
    await this.languageService.disableLanguage(id);
    sendSuccess(res, "Language disabled", {});
  };

  versions = async (req: Request, res: Response): Promise<void> => {
    const languageId = req.params.id;
    const versions = await this.languageService.versions(languageId);
    sendSuccess(res, "Language versions", versions);
  };

  createVersion = async (req: Request, res: Response): Promise<void> => {
    const languageId = req.params.id;
    const created = await this.languageService.createVersion(languageId, req.body);
    sendSuccess(res, "Language version created", created, undefined, 201);
  };

  updateVersion = async (req: Request, res: Response): Promise<void> => {
    const versionId = req.params.id;
    const updated = await this.languageService.updateVersion(versionId, req.body);
    sendSuccess(res, "Language version updated", updated);
  };

  deleteVersion = async (req: Request, res: Response): Promise<void> => {
    const versionId = req.params.id;
    await this.languageService.disableVersion(versionId);
    sendSuccess(res, "Language version disabled", {});
  };

  syncJudge0 = async (_req: Request, res: Response): Promise<void> => {
    // pulls language ids from Judge0 into our catalog
    const result = await this.languageService.syncJudge0();
    sendSuccess(res, "Judge0 language sync complete", result);
  };

  updateProblemLanguages = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const languages = req.body.languages;
    const result = await this.languageService.updateProblemLanguages(problemId, languages);
    sendSuccess(res, "Problem languages updated", result);
  };

  upsertStarterCode = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const result = await this.languageService.upsertProblemStarterCode({
      ...req.body,
      problemId
    });
    sendSuccess(res, "Starter code saved", result, undefined, 201);
  };

  updateStarterCode = async (req: Request, res: Response): Promise<void> => {
    const starterCodeId = req.params.starterCodeId;
    const code = req.body.code as string;
    const result = await this.languageService.updateProblemStarterCode(starterCodeId, code);
    sendSuccess(res, "Starter code updated", result);
  };
}
