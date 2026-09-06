import { z } from "zod";

// legacy starter code map (one string per classic language key)
const languageStarterCode = z.object({
  CPP: z.string(),
  JAVA: z.string(),
  PYTHON: z.string(),
  JAVASCRIPT: z.string()
});

const checkerMode = z.enum(["STANDARD", "CUSTOM_CHECKER"]);
const visibility = z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]);

const companyInput = z
  .object({
    companyId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case slug")
      .optional(),
    frequency: z.number().int().min(0).max(100_000).optional(),
    isFeatured: z.boolean().optional()
  })
  .refine((value) => Boolean(value.companyId) || Boolean(value.name), "Provide companyId or name");

// query filters for problem list
const problemListQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  tag: z.string().optional(),
  topic: z.string().trim().max(80).optional(),
  company: z.string().trim().max(80).optional(),
  status: z.enum(["NOT_ATTEMPTED", "ATTEMPTED", "SOLVED"]).optional(),
  search: z.string().optional(),
  sort: z
    .enum(["newest", "oldest", "title", "difficulty", "acceptance", "submissions", "solved", "frequency"])
    .optional()
});

export const listProblemsSchema = z.object({
  query: problemListQuery
});

export const adminListProblemsSchema = z.object({
  query: problemListQuery.extend({
    visibility: z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]).optional()
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
    visibility: visibility.default("PUBLIC"),
    checkerMode: checkerMode.default("STANDARD"),
    timeLimitMs: z.number().int().min(250).max(10_000).default(2000),
    memoryLimitMb: z.number().int().min(16).max(1024).default(256),
    companies: z.array(companyInput).max(24).optional()
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

export const collectionListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

export const collectionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const createLearningCollectionSchema = z.object({
  body: z.object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case slug"),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(3).max(10_000),
    badge: z.string().trim().max(120).optional().nullable(),
    dailyUnlockCount: z.number().int().min(0).max(20).optional(),
    visibility: visibility.optional()
  })
});

export const updateLearningCollectionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createLearningCollectionSchema.shape.body
    .partial()
    .refine((value) => Object.keys(value).length > 0, "At least one collection field is required")
});

export const setLearningCollectionItemsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    items: z
      .array(
        z.object({
          problemId: z.string().min(1),
          order: z.number().int().min(0).optional(),
          note: z.string().trim().max(500).optional().nullable()
        })
      )
      .max(500)
  })
});

export const upsertDailyChallengeSchema = z.object({
  params: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .transform((value) => new Date(`${value}T00:00:00.000Z`))
  }),
  body: z.object({
    problemId: z.string().min(1),
    rewardXp: z.number().int().min(0).max(1000).optional()
  })
});

export const listDailyChallengesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

export const createBadgeDefinitionSchema = z.object({
  body: z.object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case key"),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(3).max(500),
    icon: z.string().trim().max(80).optional().nullable(),
    triggerType: z.string().trim().min(2).max(80),
    triggerValue: z.number().int().min(0).max(100_000).optional(),
    isActive: z.boolean().optional()
  })
});

export const updateBadgeDefinitionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createBadgeDefinitionSchema.shape.body
    .partial()
    .refine((value) => Object.keys(value).length > 0, "At least one badge field is required")
});

export const listBadgeDefinitionsSchema = z.object({
  query: z.object({
    includeInactive: z.enum(["true", "false"]).optional()
  })
});
