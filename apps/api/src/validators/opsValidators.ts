import { z } from "zod";

const pageQuery = {
  page: z.string().optional(),
  limit: z.string().optional()
};

export const solutionVisibilitySchema = z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]);
export const reportTargetTypeSchema = z.enum(["PROBLEM", "SUBMISSION", "DISCUSSION", "COMMENT", "SOLUTION", "USER"]);
export const moderationStatusSchema = z.enum(["OPEN", "TRIAGED", "RESOLVED", "DISMISSED"]);

export const listProblemSolutionsSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  query: z.object(pageQuery)
});

export const createSolutionSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  body: z
    .object({
      submissionId: z.string().min(1).optional().nullable(),
      title: z.string().trim().min(3).max(160),
      content: z.string().trim().min(3).max(50_000),
      code: z.string().max(100_000).optional(),
      language: z.string().trim().min(1).max(80).optional(),
      timeComplexity: z.string().trim().max(120).optional().nullable(),
      spaceComplexity: z.string().trim().max(120).optional().nullable(),
      visibility: solutionVisibilitySchema.optional()
    })
    .refine((body) => Boolean(body.submissionId) || (Boolean(body.code) && Boolean(body.language)), {
      message: "Provide submissionId or both code and language"
    })
});

export const solutionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const updateSolutionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      title: z.string().trim().min(3).max(160).optional(),
      content: z.string().trim().min(3).max(50_000).optional(),
      code: z.string().max(100_000).optional(),
      language: z.string().trim().min(1).max(80).optional(),
      timeComplexity: z.string().trim().max(120).optional().nullable(),
      spaceComplexity: z.string().trim().max(120).optional().nullable(),
      visibility: solutionVisibilitySchema.optional(),
      isPinned: z.boolean().optional()
    })
    .refine((body) => Object.keys(body).length > 0, "At least one solution field is required")
});

export const voteSolutionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ value: z.union([z.literal(1), z.literal(-1)]) })
});

export const createReportSchema = z.object({
  body: z.object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().min(1),
    reason: z.string().trim().min(3).max(160),
    details: z.string().trim().max(10_000).optional().nullable()
  })
});

export const listReportsSchema = z.object({
  query: z.object({
    ...pageQuery,
    status: moderationStatusSchema.optional(),
    targetType: reportTargetTypeSchema.optional()
  })
});

export const updateReportSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      status: moderationStatusSchema.optional(),
      resolution: z.string().trim().max(10_000).optional().nullable()
    })
    .refine((body) => Object.keys(body).length > 0, "At least one report field is required")
});

export const usernameSchema = z.object({
  params: z.object({ username: z.string().trim().min(1).max(40) })
});

export const listUserConnectionsSchema = z.object({
  params: z.object({ username: z.string().trim().min(1).max(40) }),
  query: z.object(pageQuery)
});

export const listNotificationsSchema = z.object({
  query: z.object({
    ...pageQuery,
    unreadOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true"))
  })
});

export const notificationIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const listAuditLogsSchema = z.object({
  query: z.object({
    ...pageQuery,
    actorId: z.string().min(1).optional(),
    entityType: z.string().trim().min(1).max(80).optional()
  })
});

export const abuseAnalyticsSchema = z.object({
  query: z.object({
    hours: z.string().optional()
  })
});

export const listBackupsSchema = z.object({
  query: z.object({
    ...pageQuery,
    status: z.enum(["RUNNING", "COMPLETED", "FAILED"]).optional()
  })
});

export const listHealthSnapshotsSchema = z.object({
  query: z.object({
    ...pageQuery,
    status: z.enum(["HEALTHY", "DEGRADED", "DOWN"]).optional()
  })
});

export const listMonitoringAlertsSchema = z.object({
  query: z.object({
    ...pageQuery,
    status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional()
  })
});

export const alertIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const contestIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const listRatingsSchema = z.object({
  query: z.object(pageQuery)
});

export const listRatingJobsSchema = z.object({
  query: z.object({
    ...pageQuery,
    status: z.enum(["SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional()
  })
});

export const scheduleRatingJobSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    scheduledAt: z.coerce.date().optional().nullable()
  })
});
