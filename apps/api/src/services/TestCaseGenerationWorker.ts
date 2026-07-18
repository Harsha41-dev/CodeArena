import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";
import type { TestCaseGenerationService, GenerationConfig } from "./TestCaseGenerationService";

export class TestCaseGenerationWorker {
  constructor(
    private readonly repository: AppRepository,
    private readonly service: TestCaseGenerationService
  ) {}

  async processJob(jobId: string): Promise<void> {
    const job = await this.repository.findTestCaseGenerationJobById(jobId);

    if (!job) {
      throw ApiError.notFound("Test generation job not found");
    }

    // skip if already done / cancelled / failed
    const terminalStatuses = ["COMPLETED", "FAILED", "CANCELLED"];
    if (terminalStatuses.includes(job.status)) {
      logger.info({ jobId, status: job.status }, "Test generation job already terminal; skipping");
      return;
    }

    const startedAt = Date.now();
    const config = job.config as unknown as GenerationConfig;
    let batchId: string | null = null;

    try {
      const problem = await this.repository.findProblemById(job.problemId);
      if (!problem) {
        throw ApiError.notFound("Problem not found");
      }

      // start the job
      await this.repository.updateTestCaseGenerationJob(job.id, {
        status: "RUNNING",
        errorMessage: null
      });

      // wipe old generated cases if the config says so
      if (config.replaceExistingGenerated) {
        await this.repository.deleteGeneratedTestCases(job.problemId);
      }

      // create a batch to group the new cases
      const batch = await this.repository.createGeneratedTestCaseBatch({
        problemId: job.problemId,
        jobId: job.id,
        name: config.batchName,
        description: config.description,
        createdById: job.requestedById ?? null
      });
      batchId = batch.id;

      let generatedCases = 0;

      // generate one by one so we can cancel mid-way
      for (let offset = 0; offset < config.count; offset += 1) {
        // bail if job is taking too long
        const elapsed = Date.now() - startedAt;
        if (elapsed > env.MAX_GENERATION_JOB_RUNTIME_MS) {
          throw ApiError.badRequest("Generation job exceeded runtime limit");
        }

        // re-check status in case admin cancelled
        const latest = await this.repository.findTestCaseGenerationJobById(job.id);
        if (latest?.status === "CANCELLED") {
          // clean up the half-done batch
          await this.repository.deleteGeneratedTestCaseBatch(batch.id);
          await this.repository.updateTestCaseGenerationJob(job.id, {
            generatedCases: 0,
            completedAt: new Date()
          });
          return;
        }

        const seed = config.seedStart + offset;
        const generated = await this.service.generateOne(problem, seed, config);

        // check for duplicates
        const duplicate = await this.repository.findTestCaseByInputHash(problem.id, generated.inputHash);

        if (duplicate) {
          if (config.skipDuplicates) {
            logger.info({ jobId, seed, inputHash: generated.inputHash }, "Skipping duplicate generated test input");
            continue;
          } else {
            throw ApiError.badRequest("Generator produced duplicate input");
          }
        }

        // order goes after existing cases
        const existingCases = await this.repository.listTestCases(problem.id);
        const order = existingCases.length + 1;

        const isSample = config.visibility === "SAMPLE";

        await this.repository.addTestCase({
          problemId: problem.id,
          batchId: batch.id,
          generatedByJobId: job.id,
          input: generated.generatedInput,
          expectedOutput: generated.expectedOutput,
          isSample: isSample,
          isStrict: true,
          explanation: `Generated with seed ${seed}`,
          order,
          inputHash: generated.inputHash,
          outputHash: generated.outputHash,
          generatorSeed: seed,
          isGenerated: true
        });

        generatedCases = generatedCases + 1;
        await this.repository.updateTestCaseGenerationJob(job.id, {
          generatedCases
        });
      }

      // all done
      await this.repository.updateTestCaseGenerationJob(job.id, {
        status: "COMPLETED",
        generatedCases,
        completedAt: new Date()
      });
    } catch (error) {
      const message = safeGenerationError(error);
      logger.error({ jobId, error: message }, "Test generation job failed");

      // try to clean up the batch so we don't leave junk behind
      if (batchId) {
        try {
          await this.repository.deleteGeneratedTestCaseBatch(batchId);
        } catch (cleanupError) {
          logger.error({ jobId, err: cleanupError }, "Could not clean up failed generated testcase batch");
        }
      }

      await this.repository.updateTestCaseGenerationJob(job.id, {
        status: "FAILED",
        errorMessage: message,
        generatedCases: 0,
        completedAt: new Date()
      });
    }
  }
}

// keep error messages short so the db column doesn't blow up
function safeGenerationError(error: unknown): string {
  let message = "Test generation failed";
  if (error instanceof Error) {
    message = error.message;
  }
  // max 500 chars
  if (message.length > 500) {
    return message.slice(0, 500);
  }
  return message;
}
