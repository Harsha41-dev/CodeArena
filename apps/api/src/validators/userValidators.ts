import { z } from "zod";

export const usernameParamSchema = z.object({
  params: z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/, "Username may contain letters, numbers, underscores, and hyphens")
  })
});

export const updateMeSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().min(2).max(80).optional(),
      bio: z.string().trim().max(280).nullable().optional(),
      avatarUrl: z.string().trim().url().max(500).nullable().optional(),
      country: z.string().trim().min(2).max(80).nullable().optional(),
      countryCode: z
        .string()
        .trim()
        .length(2)
        .regex(/^[A-Z]{2}$/)
        .nullable()
        .optional()
    })
    .refine((value) => Object.keys(value).length > 0, "At least one profile field is required")
});

export const adminListUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().trim().max(120).optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional()
  })
});

export const adminUserIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const adminUpdateUserSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      displayName: z.string().trim().min(2).max(80).optional(),
      bio: z.string().trim().max(280).nullable().optional(),
      avatarUrl: z.string().trim().url().max(500).nullable().optional(),
      country: z.string().trim().min(2).max(80).nullable().optional(),
      countryCode: z
        .string()
        .trim()
        .length(2)
        .regex(/^[A-Z]{2}$/)
        .nullable()
        .optional()
    })
    .refine((value) => Object.keys(value).length > 0, "At least one user field is required")
});

export const adminUpdateUserRoleSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ role: z.enum(["USER", "ADMIN"]) })
});

export const adminUpdateUserStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]) })
});
