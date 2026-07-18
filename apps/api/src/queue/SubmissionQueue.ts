import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "../config/env";
import type { SubmissionWorker } from "../services/SubmissionWorker";

export interface QueueMetrics {
  driver: "memory" | "bullmq";
  waiting: number;
  pending: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  workerStatus?: "inline" | "external" | "unavailable";
}

export interface SubmissionQueue {
  addSubmission(submissionId: string): Promise<void>;
  processPending?(): Promise<void>;
  getMetrics(): Promise<QueueMetrics>;
}

// simple in-memory queue for local / test
export class InMemorySubmissionQueue implements SubmissionQueue {
  private readonly pending: string[] = [];
  private active = 0;
  private completed = 0;
  private failed = 0;

  constructor(
    private readonly worker: SubmissionWorker,
    private readonly autoProcess: boolean
  ) {}

  async addSubmission(submissionId: string): Promise<void> {
    this.pending.push(submissionId);

    // process right away if auto mode is on
    if (this.autoProcess) {
      await this.processPending();
    }
  }

  async processPending(): Promise<void> {
    while (this.pending.length > 0) {
      const submissionId = this.pending.shift();
      if (!submissionId) {
        continue;
      }

      this.active = this.active + 1;
      try {
        await this.worker.processSubmission(submissionId);
        this.completed = this.completed + 1;
      } catch (error) {
        this.failed = this.failed + 1;
        throw error;
      } finally {
        this.active = this.active - 1;
      }
    }
  }

  async getMetrics(): Promise<QueueMetrics> {
    let workerStatus: "inline" | "external";
    if (this.autoProcess) {
      workerStatus = "inline";
    } else {
      workerStatus = "external";
    }

    return {
      driver: "memory",
      waiting: this.pending.length,
      pending: this.pending.length,
      active: this.active,
      delayed: 0,
      failed: this.failed,
      completed: this.completed,
      workerStatus
    };
  }
}

// bullmq version for production with redis
export class BullMqSubmissionQueue implements SubmissionQueue {
  private readonly queue: Queue;

  constructor() {
    const redisUrl = env.REDIS_URL ?? "redis://localhost:6379";
    const connection = redisConnectionOptions(redisUrl);
    this.queue = new Queue("submissions", { connection });
  }

  async addSubmission(submissionId: string): Promise<void> {
    await this.queue.add(
      "judge",
      { submissionId },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000
        }
      }
    );
  }

  async getMetrics(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");

    const waiting = counts.waiting ?? 0;
    const delayed = counts.delayed ?? 0;

    return {
      driver: "bullmq",
      waiting,
      pending: waiting + delayed,
      active: counts.active ?? 0,
      delayed,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      workerStatus: "external"
    };
  }
}

// parse redis url into bullmq connection options
export function redisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  const options: ConnectionOptions = {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null
  };

  if (url.username) {
    options.username = url.username;
  }
  if (url.password) {
    options.password = url.password;
  }
  // rediss = tls
  if (url.protocol === "rediss:") {
    options.tls = {};
  }

  return options;
}
