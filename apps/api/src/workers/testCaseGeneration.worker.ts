import { Worker } from "bullmq";
import { createAppContext } from "../appContext";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { redisConnectionOptions } from "../queue/SubmissionQueue";

// standalone worker process just for test case generation
const context = createAppContext({
  autoProcessSubmissions: false,
  autoProcessTestCaseGeneration: false
});

if (!env.REDIS_URL) {
  logger.warn(
    "REDIS_URL is not configured. Test-case generation worker is idle; in-memory queue runs inside the API process."
  );
} else {
  const connection = redisConnectionOptions(env.REDIS_URL);

  const worker = new Worker(
    "test-case-generation",
    async (job) => {
      const payload = job.data as { jobId: string };
      logger.info({ bullJobId: job.id, generationJobId: payload.jobId }, "Picked test generation job");
      await context.testCaseGenerationWorker.processJob(payload.jobId);
      return { jobId: payload.jobId };
    },
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => {
    const data = job.data as { jobId?: string };
    logger.info({ bullJobId: job.id, generationJobId: data.jobId }, "Test generation job completed");
  });

  worker.on("failed", (job, error) => {
    let generationJobId: string | undefined;
    if (job?.data) {
      generationJobId = (job.data as { jobId?: string }).jobId;
    }
    logger.error({ bullJobId: job?.id, generationJobId, error }, "Test generation job failed");
  });
}
