import { z } from "zod";
import { env } from "../config/env";

const assetType = z.enum(["GENERATOR", "REFERENCE_SOLUTION", "VALIDATOR", "CHECKER"]);
const checkerMode = z.enum(["STANDARD", "CUSTOM_CHECKER"]);

export const problemAssetCreateSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    type: assetType,
    languageId: z.string().min(1).optional(),
    languageVersionId: z.string().min(1).optional(),
    languageKey: z.string().trim().min(1).optional(),
    version: z.string().trim().min(1).optional(),
    filename: z.string().trim().min(1).max(120),
    sourceCode: z.string().min(1).max(64_000)
  })
});

export const problemAssetUpdateSchema = z.object({
  params: z.object({ assetId: z.string().min(1) }),
  body: z
    .object({
      languageId: z.string().min(1).nullable().optional(),
      languageVersionId: z.string().min(1).nullable().optional(),
      languageKey: z.string().trim().min(1).optional(),
      version: z.string().trim().min(1).optional(),
      filename: z.string().trim().min(1).max(120).optional(),
      sourceCode: z.string().min(1).max(64_000).optional(),
      isActive: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, "At least one field is required")
});

export const problemAssetIdSchema = z.object({
  params: z.object({ assetId: z.string().min(1) })
});

export const generationProblemIdSchema = z.object({
  params: z.object({ problemId: z.string().min(1) })
});

export const generationJobIdSchema = z.object({
  params: z.object({ jobId: z.string().min(1) })
});

export const generationBatchIdSchema = z.object({
  params: z.object({ batchId: z.string().min(1) })
});

export const generationPreviewSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    seed: z.number().int(),
    runValidator: z.boolean().optional(),
    timeLimitMs: z.number().int().min(250).max(30_000).optional(),
    memoryLimitMb: z.number().int().min(16).max(1024).optional()
  })
});

export const checkerModeSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    checkerMode
  })
});

export const checkerPreviewSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    input: z.string().max(env.MAX_GENERATED_INPUT_BYTES),
    expectedOutput: z.string().max(env.MAX_GENERATED_OUTPUT_BYTES),
    actualOutput: z.string().max(env.MAX_GENERATED_OUTPUT_BYTES),
    timeLimitMs: z.number().int().min(250).max(30_000).optional(),
    memoryLimitMb: z.number().int().min(16).max(1024).optional()
  })
});

export const generationJobCreateSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    batchName: z.string().trim().min(1).max(120),
    description: z.string().max(500).optional(),
    visibility: z.enum(["SAMPLE", "HIDDEN"]).default("HIDDEN"),
    count: z.number().int().min(1).max(env.MAX_GENERATED_CASES_PER_JOB).optional(),
    seedStart: z.number().int().default(1),
    seedEnd: z.number().int().optional(),
    inputMode: z.literal("STDIN").default("STDIN"),
    replaceExistingGenerated: z.boolean().default(false),
    runValidator: z.boolean().default(false),
    allowEmptyInput: z.boolean().default(false),
    allowEmptyOutput: z.boolean().default(false),
    skipDuplicates: z.boolean().default(true),
    timeLimitMs: z.number().int().min(250).max(30_000).default(2000),
    memoryLimitMb: z.number().int().min(16).max(1024).default(256)
  })
});
