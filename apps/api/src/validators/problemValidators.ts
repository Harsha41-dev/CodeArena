import { z } from "zod";

// legacy starter code map (one string per classic language key)
const languageStarterCode = z.object({
  CPP: z.string(),
  JAVA: z.string(),
  PYTHON: z.string(),
  JAVASCRIPT: z.string()
});

const checkerMode = z.enum(["STANDARD", "CUSTOM_CHECKER"]);

// query filters for problem list
export const listProblemsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    tag: z.string().optional(),
    status: z.enum(["NOT_ATTEMPTED", "ATTEMPTED", "SOLVED"]).optional(),
    search: z.string().optional()
  })
});

export const problemSlugSchema = z.object({
  params: z.object({
    slug: z.string().min(1)
  })
});

export const createProblemSchema = z.object({
  body: z.object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case slug"),
    title: z.string().min(3),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    description: z.string().min(10),
    constraints: z.string().min(1),
    inputFormat: z.string().min(1),
    outputFormat: z.string().min(1),
    starterCode: languageStarterCode,
    tags: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
    visibility: z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]).default("PUBLIC"),
    checkerMode: checkerMode.default("STANDARD"),
    timeLimitMs: z.number().int().min(250).max(10_000).default(2000),
    memoryLimitMb: z.number().int().min(16).max(1024).default(256)
  })
});

export const updateProblemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createProblemSchema.shape.body.partial()
});

export const problemIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const createTestCaseSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isSample: z.boolean().default(false),
    isStrict: z.boolean().default(true),
    explanation: z.string().optional(),
    order: z.number().int().default(0)
  })
});

export const updateTestCaseSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      input: z.string(),
      expectedOutput: z.string(),
      isSample: z.boolean(),
      isStrict: z.boolean(),
      explanation: z.string().optional(),
      order: z.number().int()
    })
    .partial()
});
