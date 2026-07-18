import { z } from "zod";

export const executorCapabilitiesSchema = z.object({
  query: z.object({
    problemId: z.string().min(1).optional(),
    problemSlug: z.string().min(1).optional()
  })
});
