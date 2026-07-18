import { z } from "zod";

export const contestIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const createContestSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case slug"),
    description: z.string().min(5),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    problemIds: z.array(z.string()).min(1),
    visibility: z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]).optional()
  })
});

export const updateContestSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      title: z.string().min(3).optional(),
      slug: z
        .string()
        .trim()
        .min(3)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case slug")
        .optional(),
      description: z.string().min(5).optional(),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      status: z.enum(["UPCOMING", "LIVE", "ENDED"]).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]).optional()
    })
    .refine((value) => Object.keys(value).length > 0, "At least one contest field is required")
});

export const addContestProblemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    problemId: z.string().min(1),
    points: z.number().int().min(1).max(10_000).optional()
  })
});

export const removeContestProblemSchema = z.object({
  params: z.object({ id: z.string().min(1), problemId: z.string().min(1) })
});
