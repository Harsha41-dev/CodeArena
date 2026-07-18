import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { createAppContext, type AppContext, type AppContextOptions } from "./appContext";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { ApiError } from "./errors/ApiError";
import { swaggerDocument } from "./config/swagger";
import { errorHandler } from "./middlewares/errorHandler";
import type { QueueMetrics } from "./queue/SubmissionQueue";
import { createApiRouter } from "./routes";

// wires middleware + routes; tests can pass fake repos via options
export function createApp(options: AppContextOptions = {}): express.Express {
  const app = express();
  const context = createAppContext(options);

  // stash context so workers / helpers can grab it from the app instance
  app.locals.context = context;

  // security + body parsing
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));

  // looser limit in tests so suites don't trip 429s
  let rateLimitMax = 120;
  if (env.NODE_ENV === "test") {
    rateLimitMax = 1000;
  }

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(ApiError.tooManyRequests("Too many requests. Try again later."));
      }
    })
  );

  app.use(pinoHttp({ logger }));

  // quick sanity check when debugging network issues
  app.get("/ping", (_req, res) => {
    res.json({ success: true, message: "pong" });
  });

  // fuller health: db + executor + queue
  app.get("/health", async (_req, res, next) => {
    try {
      const database = await context.repository.healthCheck();
      const executor = await context.services.executorCapabilities.health(false);

      let queue: QueueMetrics;
      let queueUnavailable = false;

      try {
        queue = await context.queue.getMetrics();
      } catch {
        // redis might be down — still return something useful
        queueUnavailable = true;
        let driver: "bullmq" | "memory" = "memory";
        if (env.REDIS_URL) {
          driver = "bullmq";
        }
        queue = {
          driver,
          waiting: 0,
          pending: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 0,
          workerStatus: "unavailable"
        };
      }

      let overallOk = false;
      if (database.ok && executor.executorConfigured && !queueUnavailable) {
        overallOk = true;
      }

      let message = "degraded";
      if (database.ok && executor.executorConfigured) {
        message = "healthy";
      }

      res.json({
        success: overallOk,
        message,
        data: {
          api: { ok: true },
          uptime: process.uptime(),
          database,
          redis: {
            configured: Boolean(env.REDIS_URL),
            ok: queueUnavailable ? false : undefined
          },
          executorMode: executor.executorMode,
          executorConfigured: executor.executorConfigured,
          executor,
          repository: database.driver,
          queue,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use("/api/v1", createApiRouter(context));

  // must be last — catches ApiError + unexpected stuff
  app.use(errorHandler);

  return app;
}

export function getAppContext(app: express.Express): AppContext {
  return app.locals.context as AppContext;
}
