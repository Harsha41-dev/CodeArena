import { z } from "zod";

const pageQuery = {
  page: z.string().optional(),
  limit: z.string().optional()
};

export const startPracticeSessionSchema = z.object({
  body: z.object({
    type: z.enum(["VIRTUAL_CONTEST", "MOCK_INTERVIEW"]),
    title: z.string().trim().min(3).max(160).optional(),
    durationSeconds: z.number().int().min(60).max(8 * 60 * 60).optional(),
    problemIds: z.array(z.string().min(1)).max(50).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    topic: z.string().trim().max(80).optional(),
    company: z.string().trim().max(80).optional(),
    count: z.number().int().min(1).max(50).optional(),
    settings: z.record(z.string(), z.unknown()).optional().nullable()
  })
});

export const listPracticeSessionsSchema = z.object({
  query: z.object({
    ...pageQuery,
    type: z.enum(["VIRTUAL_CONTEST", "MOCK_INTERVIEW"]).optional()
  })
});

export const practiceSessionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const updatePracticeProblemSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    problemItemId: z.string().min(1)
  }),
  body: z
    .object({
      outcome: z.enum(["SOLVED", "REVIEW", "SKIPPED"]).optional().nullable(),
      secondsSpent: z.number().int().min(0).max(8 * 60 * 60).optional().nullable(),
      submissionId: z.string().min(1).optional().nullable()
    })
    .refine((body) => Object.keys(body).length > 0, "At least one practice problem field is required")
});

export const finishPracticeSessionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      summary: z.record(z.string(), z.unknown()).optional().nullable()
    })
    .default({})
});
