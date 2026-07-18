import { Worker } from "bullmq";
import { createAppContext } from "../appContext";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { redisConnectionOptions } from "../queue/SubmissionQueue";

// separate process for judging when Redis/BullMQ is configured
// without Redis the API handles the in-memory queue itself
const context = createAppContext({ autoProcessSubmissions: false });

if (!env.REDIS_URL) {
  logger.warn("REDIS_URL is not configured. Worker runner is idle; in-memory queue runs inside the API process.");
} else {
  const connection = redisConnectionOptions(env.REDIS_URL);

  // how many submissions to judge at once
  let concurrency = 2;
  if (process.env.WORKER_CONCURRENCY) {
    concurrency = Number(process.env.WORKER_CONCURRENCY);
  }

  // submission judge worker
  const worker = new Worker(
    "submissions",
    async (job) => {
      const payload = job.data as { submissionId: string };
      logger.info(
        {
          jobId: job.id,
          submissionId: payload.submissionId,
          attempt: job.attemptsMade + 1
        },
        "BullMQ worker picked submission job"
      );
      await context.worker.processSubmission(payload.submissionId);
      return { submissionId: payload.submissionId };
    },
    { connection, concurrency }
  );

  worker.on("completed", (job) => {
    const data = job.data as { submissionId?: string };
    logger.info({ jobId: job.id, submissionId: data.submissionId }, "Submission job completed");
  });

  worker.on("failed", (job, error) => {
    let submissionId: string | undefined;
    if (job?.data) {
      submissionId = (job.data as { submissionId?: string }).submissionId;
    }
    logger.error({ jobId: job?.id, submissionId, error }, "Submission job failed");
  });

  // also handle test case generation in this process
  const generationWorker = new Worker(
    "test-case-generation",
    async (job) => {
      const payload = job.data as { jobId: string };
      logger.info({ bullJobId: job.id, generationJobId: payload.jobId }, "BullMQ worker picked test generation job");
      await context.testCaseGenerationWorker.processJob(payload.jobId);
      return { jobId: payload.jobId };
    },
    { connection, concurrency: 1 }
  );

  generationWorker.on("completed", (job) => {
    const data = job.data as { jobId?: string };
    logger.info({ bullJobId: job.id, generationJobId: data.jobId }, "Test generation job completed");
  });

  generationWorker.on("failed", (job, error) => {
    let generationJobId: string | undefined;
    if (job?.data) {
      generationJobId = (job.data as { jobId?: string }).jobId;
    }
    logger.error({ bullJobId: job?.id, generationJobId, error }, "Test generation job failed");
  });
}
