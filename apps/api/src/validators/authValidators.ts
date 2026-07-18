import { z } from "zod";

// register body — keep password min 8 for now
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/),
    displayName: z.string().min(2).max(80),
    password: z.string().min(8).max(128)
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10)
  })
});

export const logoutSchema = z.object({
  body: z.object({
    // optional — frontend might already have cleared storage
    refreshToken: z.string().min(10).optional()
  })
});
