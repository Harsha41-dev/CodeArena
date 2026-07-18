import { Queue } from "bullmq";
import { env } from "../config/env";
import type { TestCaseGenerationWorker } from "../services/TestCaseGenerationWorker";
import { redisConnectionOptions } from "./SubmissionQueue";

export interface TestCaseGenerationQueueMetrics {
  driver: "memory" | "bullmq";
  waiting: number;
  pending: number;
  active: number;
  failed: number;
  completed: number;
  workerStatus?: "inline" | "external";
}

export interface TestCaseGenerationQueue {
  addGenerationJob(jobId: string): Promise<void>;
  processPending?(): Promise<void>;
  getMetrics(): Promise<TestCaseGenerationQueueMetrics>;
}

// in-memory queue for local / test
export class InMemoryTestCaseGenerationQueue implements TestCaseGenerationQueue {
  private readonly pending: string[] = [];
  private active = 0;
  private failed = 0;
  private completed = 0;

  constructor(
    private readonly worker: TestCaseGenerationWorker,
    private readonly autoProcess: boolean
  ) {}

  async addGenerationJob(jobId: string): Promise<void> {
    this.pending.push(jobId);

    // kick off processing if auto mode is on
    if (this.autoProcess) {
      await this.processPending();
    }
  }

  async processPending(): Promise<void> {
    while (this.pending.length > 0) {
      const jobId = this.pending.shift();
      if (!jobId) {
        continue;
      }

      this.active = this.active + 1;
      try {
        await this.worker.processJob(jobId);
        this.completed = this.completed + 1;
      } catch (error) {
        this.failed = this.failed + 1;
        throw error;
      } finally {
        this.active = this.active - 1;
      }
    }
  }

  async getMetrics(): Promise<TestCaseGenerationQueueMetrics> {
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
      failed: this.failed,
      completed: this.completed,
      workerStatus
    };
  }
}

// bullmq version for redis-backed jobs
export class BullMqTestCaseGenerationQueue implements TestCaseGenerationQueue {
  private readonly queue: Queue;

  constructor() {
    const redisUrl = env.REDIS_URL ?? "redis://localhost:6379";
    const connection = redisConnectionOptions(redisUrl);
    this.queue = new Queue("test-case-generation", { connection });
  }

  async addGenerationJob(jobId: string): Promise<void> {
    // only try once - generation jobs are not super safe to retry blindly
    await this.queue.add("generate", { jobId }, { attempts: 1 });
  }

  async getMetrics(): Promise<TestCaseGenerationQueueMetrics> {
    const counts = await this.queue.getJobCounts("waiting", "active", "failed", "completed");

    return {
      driver: "bullmq",
      waiting: counts.waiting ?? 0,
      pending: counts.waiting ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      workerStatus: "external"
    };
  }
}
