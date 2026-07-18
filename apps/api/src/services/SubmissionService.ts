import { ApiError } from "../errors/ApiError";
import { logger } from "../config/logger";
import type { SubmissionStatusEvent } from "../events/SubmissionEventBus";
import type { Executor } from "../executors/Executor";
import type { SubmissionQueue } from "../queue/SubmissionQueue";
import type { AppRepository } from "../repositories/AppRepository";
import type { Submission, SubmissionStatus, SubmissionTestCaseResult, TestCase } from "../types/domain";
import { compareOutput, hashJudgeOutput, normalizeOutput } from "../utils/compareOutput";
import { getPagination } from "../utils/pagination";
import type { LanguageResolver, LanguageSelectionInput, ResolvedLanguage } from "./LanguageResolver";

// handles run samples, custom run, and queueing official submits
// actual judging of official submissions happens in the worker
export class SubmissionService {
  constructor(
    private readonly repository: AppRepository,
    private readonly executor: Executor,
    private readonly queue: SubmissionQueue,
    private readonly languageResolver: LanguageResolver
  ) {}

  // sample run = only public sample tests, no submission row saved
  async runSamples(
    userId: string,
    input: { problemSlug?: string; problemId?: string; code: string } & LanguageSelectionInput
  ) {
    let problem = null;
    if (input.problemId) {
      problem = await this.repository.findProblemById(input.problemId);
    } else {
      problem = await this.repository.findProblemBySlug(input.problemSlug ?? "");
    }

    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    if (problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    const resolved = await this.languageResolver.resolveForProblem(problem, input);
    logger.info(
      { userId, problemSlug: problem.slug, languageVersion: resolved.languageVersionSnapshot },
      "Run request received"
    );

    const testCases = await this.repository.listTestCases(problem.id, true);
    if (testCases.length === 0) {
      throw ApiError.badRequest("Problem has no sample test cases configured");
    }

    const results = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const result = await this.runTestCase(problem.slug, input.code, resolved, tc);
      results.push(result);
    }

    // mark as attempted (not solved) — solved only happens after official AC
    await this.repository.upsertSolvedStatus(userId, problem.id, false);

    return {
      status: sampleRunStatus(results),
      results
    };
  }

  async runCustom(_userId: string, input: { problemId: string; code: string; input: string } & LanguageSelectionInput) {
    const problem = await this.repository.findProblemById(input.problemId);
    if (!problem || problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    const resolved = await this.languageResolver.resolveForProblem(problem, input);
    logger.info(
      { problemSlug: problem.slug, languageVersion: resolved.languageVersionSnapshot },
      "Custom run request received"
    );

    const startedAt = Date.now();
    const execution = await this.executor.execute({
      problemSlug: problem.slug,
      language: resolved.languageVersionSnapshot,
      profile: executionProfileFromResolved(resolved),
      sourceCode: input.code,
      stdin: input.input,
      timeLimitMs: resolved.effectiveTimeLimitMs,
      memoryLimitMb: resolved.effectiveMemoryLimitMb
    });

    logger.info(
      {
        problemSlug: problem.slug,
        status: execution.status,
        runtimeMs: execution.runtimeMs,
        elapsedMs: Date.now() - startedAt
      },
      "Custom execution finished"
    );

    return {
      status: execution.status,
      stdout: execution.stdout,
      stderr: execution.stderr ? execution.stderr : "",
      compileOutput: execution.compileOutput ? execution.compileOutput : "",
      runtime: execution.runtimeMs,
      memory: execution.memoryKb
    };
  }

  async submit(
    userId: string,
    input: { problemSlug?: string; problemId?: string; code: string; contestId?: string } & LanguageSelectionInput
  ) {
    let problem = null;
    if (input.problemId) {
      problem = await this.repository.findProblemById(input.problemId);
    } else {
      problem = await this.repository.findProblemBySlug(input.problemSlug ?? "");
    }

    if (!problem || problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    const resolved = await this.languageResolver.resolveForProblem(problem, input);
    logger.info(
      {
        userId,
        problemSlug: problem.slug,
        languageVersion: resolved.languageVersionSnapshot,
        contestId: input.contestId
      },
      "Submit request received"
    );

    // contest submit has extra checks
    if (input.contestId) {
      const contest = await this.repository.findContestById(input.contestId);
      if (!contest || contest.visibility !== "PUBLIC") {
        throw ApiError.notFound("Contest not found");
      }

      let problemInContest = false;
      for (let i = 0; i < contest.problems.length; i++) {
        if (contest.problems[i].problemId === problem.id) {
          problemInContest = true;
          break;
        }
      }
      if (!problemInContest) {
        throw ApiError.badRequest("Problem is not part of this contest");
      }

      const registered = await this.repository.isContestRegistered(input.contestId, userId);
      if (!registered) {
        throw ApiError.forbidden("Register for the contest before submitting");
      }
    }

    const submission = await this.repository.createSubmission({
      userId,
      problemId: problem.id,
      code: input.code,
      language: resolved.legacyLanguage,
      languageId: resolved.language.id,
      languageVersionId: resolved.version.id,
      languageKeySnapshot: resolved.languageKeySnapshot,
      languageNameSnapshot: resolved.languageNameSnapshot,
      languageVersionSnapshot: resolved.languageVersionSnapshot
    });

    if (input.contestId) {
      await this.repository.addContestSubmission({
        contestId: input.contestId,
        userId,
        problemId: problem.id,
        submissionId: submission.id,
        status: "PENDING",
        penaltyMinutes: 0
      });
    }

    await this.queue.addSubmission(submission.id);
    logger.info({ submissionId: submission.id, userId, problemSlug: problem.slug }, "Submit request queued");
    return submission;
  }

  async getSubmission(userId: string, submissionId: string, isAdmin: boolean) {
    const submission = await this.getAuthorizedSubmission(userId, submissionId, isAdmin);
    const problem = await this.repository.findProblemById(submission.problemId);
    const results = await this.repository.getSubmissionResults(submission.id);
    const safeResults = await this.sanitizeSubmissionResults(submission.problemId, results, isAdmin);

    return {
      ...submission,
      problem,
      results: safeResults
    };
  }

  async getSubmissionStatusEvent(
    userId: string,
    submissionId: string,
    isAdmin: boolean
  ): Promise<SubmissionStatusEvent> {
    const submission = await this.getAuthorizedSubmission(userId, submissionId, isAdmin);
    return this.buildSubmissionStatusEvent(submission);
  }

  async list(
    userId: string,
    input: { page?: unknown; limit?: unknown; problemSlug?: string; status?: SubmissionStatus },
    isAdmin: boolean
  ) {
    const pagination = getPagination(input);

    let problemId: string | undefined;
    if (input.problemSlug) {
      const problem = await this.repository.findProblemBySlug(input.problemSlug);
      problemId = problem?.id;
    }

    return this.repository.listSubmissions({
      ...pagination,
      userId: isAdmin ? undefined : userId,
      problemId,
      status: input.status
    });
  }

  async listByProblem(userId: string, slug: string, isAdmin: boolean) {
    const problem = await this.repository.findProblemBySlug(slug);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    if (!isAdmin && problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    return this.repository.listSubmissions({
      page: 1,
      limit: 50,
      userId: isAdmin ? undefined : userId,
      problemId: problem.id
    });
  }

  private async runTestCase(problemSlug: string, code: string, resolved: ResolvedLanguage, testCase: TestCase) {
    logger.info(
      { problemSlug, testCaseId: testCase.id, languageVersion: resolved.languageVersionSnapshot },
      "Sample execution started"
    );

    const execution = await this.executor.execute({
      problemSlug,
      language: resolved.languageVersionSnapshot,
      profile: executionProfileFromResolved(resolved),
      sourceCode: code,
      stdin: testCase.input,
      timeLimitMs: resolved.effectiveTimeLimitMs,
      memoryLimitMb: resolved.effectiveMemoryLimitMb
    });

    logger.info(
      { problemSlug, testCaseId: testCase.id, status: execution.status, runtimeMs: execution.runtimeMs },
      "Sample execution finished"
    );

    let status: SubmissionStatus;
    if (execution.status === "ACCEPTED") {
      const ok = compareOutput(execution.stdout, testCase.expectedOutput, testCase.isStrict);
      if (ok) {
        status = "ACCEPTED";
      } else {
        status = "WRONG_ANSWER";
      }
    } else {
      status = execution.status;
    }

    logger.info(
      {
        problemSlug,
        language: resolved.languageVersionSnapshot,
        testCaseId: testCase.id,
        expectedOutputHash: hashJudgeOutput(testCase.expectedOutput),
        actualOutputHash: hashJudgeOutput(execution.stdout),
        normalizedExpectedHash: hashJudgeOutput(normalizeOutput(testCase.expectedOutput)),
        normalizedActualHash: hashJudgeOutput(normalizeOutput(execution.stdout)),
        verdict: status
      },
      "Sample verdict calculated"
    );

    return {
      testCaseId: testCase.id,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: execution.stdout,
      status,
      runtimeMs: execution.runtimeMs,
      memoryKb: execution.memoryKb,
      stderr: execution.stderr ?? execution.compileOutput ?? null
    };
  }

  private async getAuthorizedSubmission(userId: string, submissionId: string, isAdmin: boolean): Promise<Submission> {
    const submission = await this.repository.findSubmissionById(submissionId);
    if (!submission) {
      throw ApiError.notFound("Submission not found");
    }

    // only owner or admin can view
    if (!isAdmin && submission.userId !== userId) {
      throw ApiError.forbidden("Cannot view this submission");
    }

    return submission;
  }

  // hide hidden test I/O from normal users
  private async sanitizeSubmissionResults(
    problemId: string,
    results: SubmissionTestCaseResult[],
    isAdmin: boolean
  ): Promise<SubmissionTestCaseResult[]> {
    if (isAdmin) {
      return results;
    }
    if (results.length === 0) {
      return results;
    }

    const allCases = await this.repository.listTestCases(problemId);
    const casesById = new Map<string, TestCase>();
    for (let i = 0; i < allCases.length; i++) {
      casesById.set(allCases[i].id, allCases[i]);
    }

    const safe: SubmissionTestCaseResult[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const testCase = result.testCaseId ? casesById.get(result.testCaseId) : null;

      if (!testCase || testCase.isSample) {
        safe.push(result);
        continue;
      }

      // redact hidden judge cases
      safe.push({
        ...result,
        input: "[hidden judge test]",
        expectedOutput: "[hidden judge output]",
        actualOutput: "[hidden judge output]",
        stderr: null
      });
    }

    return safe;
  }

  private async buildSubmissionStatusEvent(submission: Submission): Promise<SubmissionStatusEvent> {
    const results = await this.repository.getSubmissionResults(submission.id);
    const judgeCases = await this.repository.listTestCases(submission.problemId, false);

    let passed = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "ACCEPTED") {
        passed += 1;
      }
    }

    const total = Math.max(results.length, judgeCases.length);

    return {
      submissionId: submission.id,
      status: submission.status,
      passedTestCases: passed,
      totalTestCases: total,
      runtime: submission.runtimeMs ?? null,
      memory: submission.memoryKb ?? null,
      updatedAt: submission.updatedAt.toISOString()
    };
  }
}

function sampleRunStatus(results: Array<{ status: SubmissionStatus }>): SubmissionStatus {
  for (let i = 0; i < results.length; i++) {
    if (results[i].status !== "ACCEPTED") {
      return results[i].status;
    }
  }
  return "ACCEPTED";
}

export function executionProfileFromResolved(resolved: ResolvedLanguage) {
  // flatten the resolved language into what executors expect
  return {
    languageId: resolved.language.id,
    languageVersionId: resolved.version.id,
    languageKey: resolved.language.key,
    displayName: resolved.language.displayName,
    monacoId: resolved.language.monacoId,
    fileExtension: resolved.language.fileExtension,
    version: resolved.version.version,
    label: resolved.version.label,
    sourceFileName: resolved.version.sourceFileName,
    executableFileName: resolved.version.executableFileName,
    isCompiled: resolved.language.isCompiled,
    timeLimitMultiplier: resolved.version.timeLimitMultiplier,
    memoryLimitMultiplier: resolved.version.memoryLimitMultiplier,
    executorType: resolved.executionProfile.executorType,
    judge0Id: resolved.executionProfile.judge0Id ?? resolved.version.judge0Id,
    dockerImage: resolved.executionProfile.dockerImage ?? resolved.version.dockerImage,
    compileCommand: resolved.executionProfile.compileCommand ?? resolved.version.compileCommand,
    runCommand: resolved.executionProfile.runCommand ?? resolved.version.runCommand,
    environment: resolved.executionProfile.environment,
    limits: resolved.executionProfile.limits
  };
}
