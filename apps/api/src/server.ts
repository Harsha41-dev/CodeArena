import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

// entrypoint — keep this thin; wiring lives in app.ts / appContext
const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "CodeArena API listening");
});
