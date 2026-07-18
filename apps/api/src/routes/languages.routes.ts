import { Router } from "express";
import type { AppContext } from "../appContext";
import { LanguageController } from "../controllers/LanguageController";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createLanguageSchema,
  createLanguageVersionSchema,
  languageIdSchema,
  languageKeySchema,
  languageVersionIdSchema,
  problemLanguagePatchSchema,
  updateLanguageSchema,
  updateLanguageVersionSchema,
  updateStarterCodeSchema,
  upsertStarterCodeSchema
} from "../validators/languageValidators";
import { problemSlugSchema } from "../validators/problemValidators";

export function createLanguagesRoutes(context: AppContext): Router {
  const router = Router();
  const languages = new LanguageController(context.services.languages);

  router.get("/languages", asyncHandler(languages.list));
  router.get("/languages/:key", validate(languageKeySchema), asyncHandler(languages.get));
  router.get("/problems/:slug/languages", validate(problemSlugSchema), asyncHandler(languages.problemLanguages));

  router.get("/admin/languages", authenticate, requireRole("ADMIN"), asyncHandler(languages.adminList));
  router.post(
    "/admin/languages",
    authenticate,
    requireRole("ADMIN"),
    validate(createLanguageSchema),
    asyncHandler(languages.adminCreate)
  );
  router.post("/admin/languages/sync/judge0", authenticate, requireRole("ADMIN"), asyncHandler(languages.syncJudge0));
  router.get(
    "/admin/languages/:id/versions",
    authenticate,
    requireRole("ADMIN"),
    validate(languageIdSchema),
    asyncHandler(languages.versions)
  );
  router.post(
    "/admin/languages/:id/versions",
    authenticate,
    requireRole("ADMIN"),
    validate(createLanguageVersionSchema),
    asyncHandler(languages.createVersion)
  );
  router.patch(
    "/admin/languages/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateLanguageSchema),
    asyncHandler(languages.adminUpdate)
  );
  router.delete(
    "/admin/languages/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(languageIdSchema),
    asyncHandler(languages.adminDelete)
  );
  router.patch(
    "/admin/language-versions/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateLanguageVersionSchema),
    asyncHandler(languages.updateVersion)
  );
  router.delete(
    "/admin/language-versions/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(languageVersionIdSchema),
    asyncHandler(languages.deleteVersion)
  );
  router.get(
    "/admin/problems/:problemId/languages",
    authenticate,
    requireRole("ADMIN"),
    validate(problemLanguagePatchSchema.pick({ params: true })),
    asyncHandler(languages.adminProblemLanguages)
  );
  router.patch(
    "/admin/problems/:problemId/languages",
    authenticate,
    requireRole("ADMIN"),
    validate(problemLanguagePatchSchema),
    asyncHandler(languages.updateProblemLanguages)
  );
  router.post(
    "/admin/problems/:problemId/starter-code",
    authenticate,
    requireRole("ADMIN"),
    validate(upsertStarterCodeSchema),
    asyncHandler(languages.upsertStarterCode)
  );
  router.patch(
    "/admin/problems/:problemId/starter-code/:starterCodeId",
    authenticate,
    requireRole("ADMIN"),
    validate(updateStarterCodeSchema),
    asyncHandler(languages.updateStarterCode)
  );

  return router;
}
