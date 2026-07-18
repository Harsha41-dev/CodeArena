import { z } from "zod";

const categorySchema = z.enum([
  "GENERAL_PURPOSE",
  "SYSTEMS",
  "SCRIPTING",
  "FUNCTIONAL",
  "JVM",
  "DOTNET",
  "DATABASE",
  "SHELL",
  "EDUCATIONAL",
  "OTHER"
]);

const executorTypeSchema = z.enum(["MOCK", "DOCKER", "JUDGE0"]);

export const languageKeySchema = z.object({
  params: z.object({ key: z.string().min(1) })
});

export const languageIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const languageVersionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const createLanguageSchema = z.object({
  body: z.object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    displayName: z.string().trim().min(1),
    monacoId: z.string().trim().min(1),
    fileExtension: z.string().trim().min(1).max(16),
    category: categorySchema.default("OTHER"),
    isCompiled: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0)
  })
});

export const updateLanguageSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createLanguageSchema.shape.body.partial()
});

const executionProfileInputSchema = z.object({
  executorType: executorTypeSchema,
  judge0Id: z.number().int().positive().nullable().optional(),
  dockerImage: z.string().nullable().optional(),
  compileCommand: z.string().nullable().optional(),
  runCommand: z.string().nullable().optional(),
  environment: z.record(z.unknown()).nullable().optional(),
  limits: z.record(z.unknown()).nullable().optional(),
  isActive: z.boolean().optional()
});

export const createLanguageVersionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    version: z.string().trim().min(1),
    label: z.string().trim().min(1),
    judge0Id: z.number().int().positive().nullable().optional(),
    dockerImage: z.string().nullable().optional(),
    compileCommand: z.string().nullable().optional(),
    runCommand: z.string().nullable().optional(),
    timeLimitMultiplier: z.number().positive().default(1),
    memoryLimitMultiplier: z.number().positive().default(1),
    sourceFileName: z.string().trim().min(1),
    executableFileName: z.string().nullable().optional(),
    starterTemplate: z.string().nullable().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    executionProfiles: z.array(executionProfileInputSchema).optional()
  })
});

export const updateLanguageVersionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createLanguageVersionSchema.shape.body.partial()
});

export const problemLanguagePatchSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    languages: z.array(
      z.object({
        languageId: z.string().min(1),
        languageVersionId: z.string().min(1).nullable().optional(),
        isEnabled: z.boolean()
      })
    )
  })
});

export const upsertStarterCodeSchema = z.object({
  params: z.object({ problemId: z.string().min(1) }),
  body: z.object({
    languageId: z.string().min(1),
    languageVersionId: z.string().min(1).nullable().optional(),
    code: z.string()
  })
});

export const updateStarterCodeSchema = z.object({
  params: z.object({
    problemId: z.string().min(1),
    starterCodeId: z.string().min(1)
  }),
  body: z.object({ code: z.string() })
});
