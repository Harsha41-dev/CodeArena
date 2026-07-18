import type { Executor } from "../executors/Executor";
import { ApiError } from "../errors/ApiError";
import { isTerminalSubmissionStatus, type SubmissionEventPublisher } from "../events/SubmissionEventBus";
import type { AppRepository, CreateSubmissionResultInput } from "../repositories/AppRepository";
import type { Problem, Submission, SubmissionStatus, TestCase } from "../types/domain";
import { compareOutput, hashJudgeOutput, normalizeOutput } from "../utils/compareOutput";
import { logger } from "../config/logger";
import type { LanguageResolver, ResolvedLanguage } from "./LanguageResolver";
import { executionProfileFromResolved } from "./SubmissionService";
import type { CheckerRunner } from "./TestCaseGenerationService";

export class SubmissionWorker {
  constructor(
    private readonly repository: AppRepository,
    private readonly executor: Executor,
    private readonly languageResolver?: LanguageResolver,
    private readonly submissionEvents?: SubmissionEventPublisher,
    private readonly checkerRunner?: CheckerRunner
  ) {}

  async processSubmission(submissionId: string): Promise<void> {
    const submission = await this.repository.findSubmissionById(submissionId);

    // nothing to do if it doesn't exist
    if (!submission) {
      throw ApiError.notFound("Submission not found");
    }

    // skip if already done
    if (isTerminalSubmissionStatus(submission.status)) {
      logger.info({ submissionId, status: submission.status }, "Submission already terminal; skipping judge");
      return;
    }

    // avoid double-running the same job
    if (submission.status === "RUNNING") {
      logger.warn({ submissionId }, "Submission already running; skipping duplicate judge job");
      return;
    }

    const problem = await this.repository.findProblemById(submission.problemId);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }

    let passedTestCases = 0;
    let totalTestCases = 0;
    let totalRuntime = 0;
    let maxMemory = 0;

    try {
      logger.info({ submissionId, problemSlug: problem.slug }, "Worker picked submission job");

      // mark as running so the UI can show progress
      const runningSubmission = await this.repository.updateSubmission(submission.id, {
        status: "RUNNING"
      });
      await this.publishStatusEvent(runningSubmission, passedTestCases, totalTestCases);

      // wipe old results from a previous attempt
      await this.repository.clearSubmissionResults(submission.id);

      // only judge non-sample cases
      const testCases = await this.repository.listTestCases(problem.id, false);
      totalTestCases = testCases.length;

      if (testCases.length === 0) {
        throw ApiError.badRequest("Problem has no judge test cases configured");
      }

      await this.publishStatusEvent(runningSubmission, passedTestCases, totalTestCases);

      let finalStatus: SubmissionStatus = "ACCEPTED";
      let errorMessage: string | null = null;

      // figure out language settings if resolver is available
      let resolvedLanguage: ResolvedLanguage | null = null;
      if (this.languageResolver) {
        const selection = submissionLanguageSelection(submission);
        resolvedLanguage = await this.languageResolver.resolveForProblem(problem, selection);
      }

      // run each test case one by one
      for (let i = 0; i < testCases.length; i += 1) {
        const testCase = testCases[i];
        const languageLabel = resolvedLanguage?.languageVersionSnapshot ?? submission.language;

        logger.info({ submissionId, testCaseId: testCase.id, language: languageLabel }, "Execution started");

        const result = await this.judgeTestCase(
          problem,
          submission.code,
          submission,
          resolvedLanguage,
          problem.timeLimitMs,
          problem.memoryLimitMb,
          testCase
        );

        logger.info(
          {
            submissionId,
            testCaseId: testCase.id,
            status: result.status,
            runtimeMs: result.runtimeMs,
            memoryKb: result.memoryKb
          },
          "Execution finished"
        );

        // keep track of totals
        if (result.runtimeMs != null) {
          totalRuntime = totalRuntime + result.runtimeMs;
        }
        if (result.memoryKb != null) {
          if (result.memoryKb > maxMemory) {
            maxMemory = result.memoryKb;
          }
        }

        await this.repository.addSubmissionResult({
          submissionId: submission.id,
          ...result
        });

        if (result.status === "ACCEPTED") {
          passedTestCases = passedTestCases + 1;
        }

        // first failure sets the final verdict
        if (result.status !== "ACCEPTED" && finalStatus === "ACCEPTED") {
          finalStatus = result.status;
          if (result.stderr != null) {
            errorMessage = result.stderr;
          } else {
            errorMessage = null;
          }

          // hard errors - no point running more cases
          const hardErrors = [
            "COMPILATION_ERROR",
            "RUNTIME_ERROR",
            "TIME_LIMIT_EXCEEDED",
            "MEMORY_LIMIT_EXCEEDED",
            "INTERNAL_ERROR"
          ];
          if (hardErrors.includes(result.status)) {
            break;
          }
        }
      }

      const completedSubmission = await this.repository.updateSubmission(submission.id, {
        status: finalStatus,
        runtimeMs: totalRuntime,
        memoryKb: maxMemory,
        errorMessage,
        completedAt: new Date()
      });

      logger.info(
        { submissionId, status: finalStatus, runtimeMs: totalRuntime, memoryKb: maxMemory },
        "Verdict calculated"
      );

      // mark problem as solved only on AC
      const isSolved = finalStatus === "ACCEPTED";
      await this.repository.upsertSolvedStatus(submission.userId, submission.problemId, isSolved);
      await this.repository.updateContestSubmissionStatus(submission.id, finalStatus);
      await this.publishStatusEvent(completedSubmission, passedTestCases, totalTestCases);
    } catch (error) {
      let message = "Submission worker failed";
      if (error instanceof Error) {
        message = error.message;
      }

      logger.error({ submissionId, err: error }, "Submission worker failed");

      const failedUpdate: {
        status: SubmissionStatus;
        runtimeMs?: number;
        memoryKb?: number;
        errorMessage: string;
        completedAt: Date;
      } = {
        status: "INTERNAL_ERROR",
        errorMessage: message,
        completedAt: new Date()
      };

      if (totalRuntime) {
        failedUpdate.runtimeMs = totalRuntime;
      }
      if (maxMemory) {
        failedUpdate.memoryKb = maxMemory;
      }

      const failedSubmission = await this.repository.updateSubmission(submission.id, failedUpdate);
      await this.repository.updateContestSubmissionStatus(submission.id, "INTERNAL_ERROR");
      await this.publishStatusEvent(failedSubmission, passedTestCases, totalTestCases);
    }
  }

  private async judgeTestCase(
    problem: Problem,
    code: string,
    submission: Submission,
    resolvedLanguage: ResolvedLanguage | null,
    timeLimitMs: number,
    memoryLimitMb: number,
    testCase: TestCase
  ): Promise<Omit<CreateSubmissionResultInput, "submissionId">> {
    // pick language string for the executor
    let languageForExec: string;
    if (resolvedLanguage?.languageVersionSnapshot) {
      languageForExec = resolvedLanguage.languageVersionSnapshot;
    } else if (submission.languageVersionSnapshot) {
      languageForExec = submission.languageVersionSnapshot;
    } else {
      languageForExec = submission.language;
    }

    let timeLimit = timeLimitMs;
    if (resolvedLanguage?.effectiveTimeLimitMs != null) {
      timeLimit = resolvedLanguage.effectiveTimeLimitMs;
    }

    let memoryLimit = memoryLimitMb;
    if (resolvedLanguage?.effectiveMemoryLimitMb != null) {
      memoryLimit = resolvedLanguage.effectiveMemoryLimitMb;
    }

    let profile = undefined;
    if (resolvedLanguage) {
      profile = executionProfileFromResolved(resolvedLanguage);
    }

    const execution = await this.executor.execute({
      problemSlug: problem.slug,
      sourceCode: code,
      language: languageForExec,
      profile,
      stdin: testCase.input,
      timeLimitMs: timeLimit,
      memoryLimitMb: memoryLimit
    });

    let status: SubmissionStatus = execution.status;
    let stderr: string | null = null;
    if (execution.stderr != null) {
      stderr = execution.stderr;
    } else if (execution.compileOutput != null) {
      stderr = execution.compileOutput;
    }

    let runtimeMs = execution.runtimeMs;
    let memoryKb = execution.memoryKb;

    // only check output if the program actually ran fine
    if (execution.status === "ACCEPTED") {
      if (problem.checkerMode === "CUSTOM_CHECKER") {
        // custom checker path
        if (!this.checkerRunner) {
          status = "INTERNAL_ERROR";
          stderr = "Checker is not configured for this judge worker";
        } else {
          try {
            const checker = await this.checkerRunner.runChecker(problem, {
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput: execution.stdout,
              timeLimitMs: timeLimit,
              memoryLimitMb: memoryLimit
            });

            if (checker.verdict === "ACCEPTED") {
              status = "ACCEPTED";
              stderr = null;
            } else if (checker.verdict === "WRONG_ANSWER") {
              status = "WRONG_ANSWER";
              if (checker.message) {
                stderr = checker.message;
              } else {
                stderr = "Checker rejected output";
              }
            } else {
              status = "INTERNAL_ERROR";
              if (checker.message) {
                stderr = checker.message;
              } else {
                stderr = "Checker rejected output";
              }
            }

            // add checker time on top of program time
            const execRuntime = execution.runtimeMs ?? 0;
            runtimeMs = execRuntime + checker.runtimeMs;

            const execMemory = execution.memoryKb ?? 0;
            if (checker.memoryKb > execMemory) {
              memoryKb = checker.memoryKb;
            } else {
              memoryKb = execMemory;
            }
          } catch (error) {
            logger.warn({ submissionId: submission.id, testCaseId: testCase.id, err: error }, "Custom checker failed");
            status = "INTERNAL_ERROR";
            stderr = "Checker failed. Contact an administrator.";
          }
        }
      } else {
        // normal exact / token compare
        const outputMatched = compareOutput(execution.stdout, testCase.expectedOutput, testCase.isStrict);
        if (outputMatched) {
          status = "ACCEPTED";
        } else {
          status = "WRONG_ANSWER";
          stderr = null;
        }
      }
    }

    // log hashes so we can debug WA without dumping full output
    logger.info(
      {
        submissionId: submission.id,
        problemId: problem.id,
        language: languageForExec,
        testCaseId: testCase.id,
        expectedOutputHash: hashJudgeOutput(testCase.expectedOutput),
        actualOutputHash: hashJudgeOutput(execution.stdout),
        normalizedExpectedHash: hashJudgeOutput(normalizeOutput(testCase.expectedOutput)),
        normalizedActualHash: hashJudgeOutput(normalizeOutput(execution.stdout)),
        verdict: status
      },
      "Judge testcase verdict calculated"
    );

    return {
      testCaseId: testCase.id,
      status,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: execution.stdout,
      stderr,
      runtimeMs,
      memoryKb
    };
  }

  private async publishStatusEvent(
    submission: Submission,
    passedTestCases: number,
    totalTestCases: number
  ): Promise<void> {
    // optional - might not be wired up in tests
    if (!this.submissionEvents) {
      return;
    }

    try {
      await this.submissionEvents.publishSubmissionStatus({
        submissionId: submission.id,
        status: submission.status,
        passedTestCases,
        totalTestCases,
        runtime: submission.runtimeMs ?? null,
        memory: submission.memoryKb ?? null,
        updatedAt: submission.updatedAt.toISOString()
      });
    } catch (error) {
      logger.warn({ submissionId: submission.id, err: error }, "Could not publish submission status event");
    }
  }
}

// just packs the language fields the resolver expects
function submissionLanguageSelection(submission: Submission) {
  const result: {
    language: string;
    languageId?: string;
    languageVersionId?: string;
    languageKey?: string;
    version?: string;
  } = {
    language: submission.language
  };

  if (submission.languageId != null) {
    result.languageId = submission.languageId;
  }
  if (submission.languageVersionId != null) {
    result.languageVersionId = submission.languageVersionId;
  }
  if (submission.languageKeySnapshot != null) {
    result.languageKey = submission.languageKeySnapshot;
  }
  if (submission.languageVersionSnapshot != null) {
    result.version = submission.languageVersionSnapshot;
  }

  return result;
}
