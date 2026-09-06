import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

// entrypoint - keep this thin; wiring lives in app.ts / appContext
const app = createApp();

if (env.RATING_JOB_INTERVAL_MS > 0) {
  const timer = setInterval(() => {
    void app.locals.context.services.ops.processScheduledRatingJobs(null).catch((error: unknown) => {
      logger.warn({ err: error }, "Scheduled rating job processing failed");
    });
  }, env.RATING_JOB_INTERVAL_MS);
  timer.unref();
}

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "CodeArena API listening");
});
