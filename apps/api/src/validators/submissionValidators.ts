import { z } from "zod";

// language can be picked a few different ways (legacy + new catalog)
const languageSelectionSchema = {
  language: z.string().trim().min(1).max(64).optional(),
  languageId: z.string().min(1).optional(),
  languageVersionId: z.string().min(1).optional(),
  languageKey: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional()
};

function hasProblemSelector(value: { problemSlug?: string; problemId?: string }): boolean {
  if (value.problemSlug) return true;
  if (value.problemId) return true;
  return false;
}

function hasLanguageSelector(value: {
  language?: string;
  languageId?: string;
  languageVersionId?: string;
  languageKey?: string;
}): boolean {
  if (value.language) return true;
  if (value.languageId) return true;
  if (value.languageVersionId) return true;
  if (value.languageKey) return true;
  return false;
}

export const runCodeSchema = z.object({
  body: z
    .object({
      problemSlug: z.string().min(1).optional(),
      problemId: z.string().min(1).optional(),
      ...languageSelectionSchema,
      code: z.string().min(1).max(64_000)
    })
    .refine(hasProblemSelector, { message: "problemSlug or problemId is required", path: ["problemSlug"] })
    .refine(hasLanguageSelector, {
      message: "language, languageKey, languageId, or languageVersionId is required",
      path: ["language"]
    })
});

export const runCustomCodeSchema = z.object({
  body: z
    .object({
      problemId: z.string().min(1),
      ...languageSelectionSchema,
      code: z.string().min(1).max(64_000),
      input: z.string().max(64_000)
    })
    .refine(hasLanguageSelector, {
      message: "language, languageKey, languageId, or languageVersionId is required",
      path: ["language"]
    })
});

export const submitCodeSchema = z.object({
  body: z
    .object({
      problemSlug: z.string().min(1).optional(),
      problemId: z.string().min(1).optional(),
      ...languageSelectionSchema,
      code: z.string().min(1).max(64_000),
      contestId: z.string().optional()
    })
    .refine(hasProblemSelector, { message: "problemSlug or problemId is required", path: ["problemSlug"] })
    .refine(hasLanguageSelector, {
      message: "language, languageKey, languageId, or languageVersionId is required",
      path: ["language"]
    })
});

export const contestSubmitCodeSchema = submitCodeSchema.extend({
  params: z.object({ id: z.string().min(1) })
});

export const submissionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const listSubmissionsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    problemSlug: z.string().optional(),
    status: z
      .enum([
        "PENDING",
        "RUNNING",
        "ACCEPTED",
        "WRONG_ANSWER",
        "TIME_LIMIT_EXCEEDED",
        "MEMORY_LIMIT_EXCEEDED",
        "RUNTIME_ERROR",
        "COMPILATION_ERROR",
        "INTERNAL_ERROR"
      ])
      .optional()
  })
});
