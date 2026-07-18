import "dotenv/config";
import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no", ""].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(10),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  EXECUTOR_MODE: z.enum(["mock", "docker", "judge0"]).default("mock"),
  ALLOW_MOCK_EXECUTOR: envBoolean.default(false),
  ALLOW_MOCK_EXECUTOR_IN_PRODUCTION: envBoolean.default(false),
  JUDGE0_BASE_URL: z.string().optional(),
  JUDGE0_API_KEY: z.string().optional(),
  DOCKER_MEMORY_LIMIT: z.string().default("256m"),
  DOCKER_TIME_LIMIT: z.coerce.number().int().positive().default(2),
  MAX_GENERATED_CASES_PER_JOB: z.coerce.number().int().positive().default(100),
  MAX_GENERATED_INPUT_BYTES: z.coerce.number().int().positive().default(65_536),
  MAX_GENERATED_OUTPUT_BYTES: z.coerce.number().int().positive().default(65_536),
  MAX_GENERATION_JOB_RUNTIME_MS: z.coerce.number().int().positive().default(120_000)
});

// parse once at startup — fail fast if env is garbage
export const env = envSchema.parse(process.env);

// mock executor is for tests; don't silently use it in normal dev without opt-in
if (env.EXECUTOR_MODE === "mock") {
  if (env.NODE_ENV !== "test" && !env.ALLOW_MOCK_EXECUTOR) {
    throw new Error("EXECUTOR_MODE=mock is allowed only for tests unless ALLOW_MOCK_EXECUTOR=true");
  }
}

if (env.NODE_ENV === "production") {
  const weakAccess = env.JWT_ACCESS_SECRET === "dev-access-secret-change-me";
  const weakRefresh = env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-me";
  if (weakAccess || weakRefresh) {
    throw new Error("Production JWT secrets must be configured");
  }

  if (env.EXECUTOR_MODE === "mock" && !env.ALLOW_MOCK_EXECUTOR_IN_PRODUCTION) {
    throw new Error("EXECUTOR_MODE=mock is not allowed in production unless ALLOW_MOCK_EXECUTOR_IN_PRODUCTION=true");
  }
}
