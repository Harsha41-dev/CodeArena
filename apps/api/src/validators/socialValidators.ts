import { z } from "zod";

export const createDiscussionSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  body: z.object({
    title: z.string().min(3),
    content: z.string().min(3)
  })
});

export const createGeneralDiscussionSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(3).max(20_000),
    tags: z.array(z.string().trim().min(1).max(32)).max(8).optional()
  })
});

export const listGeneralDiscussionsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().trim().max(120).optional(),
    sort: z.enum(["newest", "top", "unanswered"]).optional()
  })
});

export const listProblemDiscussionsSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  query: z.object({
    sort: z.enum(["newest", "top", "unanswered"]).optional()
  })
});

export const listContestDiscussionsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    sort: z.enum(["newest", "top", "unanswered"]).optional()
  })
});

export const createContestDiscussionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(3).max(20_000)
  })
});

export const discussionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const updateDiscussionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      title: z.string().trim().min(3).max(160).optional(),
      content: z.string().trim().min(3).max(20_000).optional(),
      tags: z.array(z.string().trim().min(1).max(32)).max(8).optional()
    })
    .refine((value) => Object.keys(value).length > 0, "At least one discussion field is required")
});

export const voteDiscussionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ value: z.union([z.literal(1), z.literal(-1)]) })
});

export const acceptAnswerSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ commentId: z.string().min(1) })
});

export const createCommentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    content: z.string().min(1)
  })
});

export const updateCommentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    content: z.string().trim().min(1).max(10_000)
  })
});

export const upsertEditorialSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(3).max(50_000),
    isPublished: z.boolean().optional(),
    structure: z
      .object({
        sections: z
          .array(
            z.object({
              type: z.enum(["TEXT", "HINT", "SOLUTION", "COMPLEXITY", "DIAGRAM"]).optional(),
              title: z.string().trim().min(1).max(160),
              content: z.string().trim().min(1).max(50_000),
              language: z.string().trim().max(80).optional().nullable(),
              order: z.number().int().min(0).optional(),
              isLocked: z.boolean().optional()
            })
          )
          .max(100)
          .optional(),
        officialSolutions: z
          .array(
            z.object({
              language: z.string().trim().min(1).max(80),
              code: z.string().max(100_000),
              explanation: z.string().trim().max(50_000).optional().nullable(),
              timeComplexity: z.string().trim().max(120).optional().nullable(),
              spaceComplexity: z.string().trim().max(120).optional().nullable(),
              order: z.number().int().min(0).optional()
            })
          )
          .max(50)
          .optional()
      })
      .optional()
  })
});

export const editorialBySlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  query: z.object({
    includeDraft: z.enum(["true", "false"]).optional()
  })
});

export const editorialIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const updateEditorialSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      title: z.string().trim().min(3).max(160).optional(),
      content: z.string().trim().min(3).max(50_000).optional()
    })
    .refine((value) => Object.keys(value).length > 0, "At least one editorial field is required")
});

export const noteBySlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) })
});

export const upsertNoteSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  body: z.object({ content: z.string() })
});

export const updateNoteSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ content: z.string() })
});
