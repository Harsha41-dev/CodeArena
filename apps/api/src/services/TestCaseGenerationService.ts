import { createHash } from "node:crypto";
import { env } from "../config/env";
import { ApiError } from "../errors/ApiError";
import type { Executor, ExecutionLanguageProfile, ExecutionResult } from "../executors/Executor";
import type { TestCaseGenerationQueue } from "../queue/TestCaseGenerationQueue";
import type { AppRepository } from "../repositories/AppRepository";
import type { LanguageRepository } from "../repositories/LanguageRepository";
import type {
  CheckerMode,
  CodeLanguage,
  CodeLanguageVersion,
  ExecutionProfile,
  Problem,
  ProblemAsset,
  ProblemAssetType
} from "../types/domain";
import { normalizeOutput } from "../utils/compareOutput";
import { currentExecutorType } from "./LanguageResolver";

export interface GenerationConfig {
  batchName: string;
  description?: string | null;
  visibility: "SAMPLE" | "HIDDEN";
  count: number;
  seedStart: number;
  seedEnd: number;
  inputMode: "STDIN";
  replaceExistingGenerated: boolean;
  runValidator: boolean;
  allowEmptyInput: boolean;
  allowEmptyOutput: boolean;
  skipDuplicates: boolean;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface AssetPayload {
  type: ProblemAssetType;
  languageId?: string | null;
  languageVersionId?: string | null;
  languageKey?: string;
  version?: string;
  filename: string;
  sourceCode: string;
}

export type CheckerVerdict = "ACCEPTED" | "WRONG_ANSWER" | "CHECKER_ERROR";

export interface CheckerRunInput {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface CheckerRunResult {
  verdict: CheckerVerdict;
  message: string;
  runtimeMs: number;
  memoryKb: number;
}

export interface CheckerRunner {
  runChecker(problem: Problem, input: CheckerRunInput): Promise<CheckerRunResult>;
}

// generates test cases by running generator + reference solution assets
// also handles custom checker preview / run
export class TestCaseGenerationService {
  constructor(
    private readonly repository: AppRepository,
    private readonly languageRepository: LanguageRepository,
    private readonly executor: Executor,
    private readonly queue: TestCaseGenerationQueue
  ) {}

  async listAssets(problemId: string) {
    await this.requireProblem(problemId);
    const assets = await this.repository.listProblemAssets(problemId);
    return assets;
  }

  async createAsset(problemId: string, userId: string, input: AssetPayload) {
    await this.requireProblem(problemId);
    const resolved = await this.resolveAssetLanguage(input);

    const created = await this.repository.createProblemAsset({
      problemId,
      type: input.type,
      languageId: resolved.language.id,
      languageVersionId: resolved.version.id,
      filename: input.filename,
      sourceCode: input.sourceCode,
      createdById: userId
    });
    return created;
  }

  async updateAsset(assetId: string, input: Partial<AssetPayload> & { isActive?: boolean }) {
    const asset = await this.repository.findProblemAssetById(assetId);
    if (!asset) {
      throw ApiError.notFound("Problem asset not found");
    }

    // only re-resolve language if something language-related was sent
    let shouldResolve = false;
    if (input.languageId !== undefined) {
      shouldResolve = true;
    }
    if (input.languageVersionId !== undefined) {
      shouldResolve = true;
    }
    if (input.languageKey !== undefined) {
      shouldResolve = true;
    }
    if (input.version !== undefined) {
      shouldResolve = true;
    }

    let resolved: {
      language: CodeLanguage;
      version: CodeLanguageVersion;
      executionProfile: ExecutionProfile;
    } | null = null;

    if (shouldResolve) {
      resolved = await this.resolveAssetLanguage({
        languageId: input.languageId !== undefined ? input.languageId : asset.languageId,
        languageVersionId: input.languageVersionId !== undefined ? input.languageVersionId : asset.languageVersionId,
        languageKey: input.languageKey,
        version: input.version
      });
    }

    const updated = await this.repository.updateProblemAsset(assetId, {
      languageId: resolved ? resolved.language.id : undefined,
      languageVersionId: resolved ? resolved.version.id : undefined,
      filename: input.filename,
      sourceCode: input.sourceCode,
      isActive: input.isActive
    });
    return updated;
  }

  async deleteAsset(assetId: string): Promise<void> {
    // soft deactivate rather than hard delete
    await this.repository.deactivateProblemAsset(assetId);
  }

  async setCheckerMode(problemId: string, checkerMode: CheckerMode) {
    await this.requireProblem(problemId);

    // custom mode needs an active checker asset first
    if (checkerMode === "CUSTOM_CHECKER") {
      await this.requireActiveAsset(problemId, "CHECKER");
    }

    const problem = await this.repository.updateProblem(problemId, { checkerMode });
    return problem;
  }

  async previewChecker(problemId: string, input: CheckerRunInput): Promise<CheckerRunResult> {
    const problem = await this.requireProblem(problemId);

    let timeLimitMs = input.timeLimitMs;
    if (timeLimitMs === undefined || timeLimitMs === null) {
      timeLimitMs = problem.timeLimitMs;
    }

    let memoryLimitMb = input.memoryLimitMb;
    if (memoryLimitMb === undefined || memoryLimitMb === null) {
      memoryLimitMb = problem.memoryLimitMb;
    }

    return this.runChecker(problem, {
      input: input.input,
      expectedOutput: input.expectedOutput,
      actualOutput: input.actualOutput,
      timeLimitMs,
      memoryLimitMb
    });
  }

  async runChecker(problem: Problem, input: CheckerRunInput): Promise<CheckerRunResult> {
    const checker = await this.requireActiveAsset(problem.id, "CHECKER");
    const stdin = buildCheckerStdin(input);

    const result = await this.executeAssetRaw(problem, checker, stdin, {
      timeLimitMs: input.timeLimitMs,
      memoryLimitMb: input.memoryLimitMb
    });

    // prefer stderr, then compile output, then stdout for the message
    let rawMessage = "";
    if (result.stderr) {
      rawMessage = result.stderr;
    } else if (result.compileOutput) {
      rawMessage = result.compileOutput;
    } else if (result.stdout) {
      rawMessage = result.stdout;
    }

    const safeMessage = sanitizeCheckerMessage(rawMessage);
    const runtimeMs = result.runtimeMs ?? 0;
    const memoryKb = result.memoryKb ?? 0;

    if (result.status === "ACCEPTED") {
      return {
        verdict: "ACCEPTED",
        message: safeMessage || "Checker accepted output",
        runtimeMs,
        memoryKb
      };
    }

    if (result.status === "WRONG_ANSWER") {
      return {
        verdict: "WRONG_ANSWER",
        message: safeMessage || "Checker rejected output",
        runtimeMs,
        memoryKb
      };
    }

    // anything else is treated as checker error
    return {
      verdict: "CHECKER_ERROR",
      message: `Checker failed with ${result.status}`,
      runtimeMs,
      memoryKb
    };
  }

  async preview(
    problemId: string,
    input: { seed: number; runValidator?: boolean; timeLimitMs?: number; memoryLimitMb?: number }
  ) {
    const problem = await this.requireProblem(problemId);

    const config = normalizeGenerationConfig({
      batchName: "Preview",
      visibility: "HIDDEN",
      seedStart: input.seed,
      seedEnd: input.seed,
      count: 1,
      replaceExistingGenerated: false,
      runValidator: input.runValidator ?? false,
      timeLimitMs: input.timeLimitMs ?? problem.timeLimitMs,
      memoryLimitMb: input.memoryLimitMb ?? problem.memoryLimitMb
    });

    return this.generateOne(problem, input.seed, config);
  }

  async startJob(problemId: string, requestedById: string, rawConfig: Partial<GenerationConfig>) {
    await this.requireProblem(problemId);
    const config = normalizeGenerationConfig(rawConfig);

    const job = await this.repository.createTestCaseGenerationJob({
      problemId,
      requestedById,
      config: { ...config },
      totalCases: config.count
    });

    // queue will pick this up (or process inline in memory mode)
    await this.queue.addGenerationJob(job.id);
    return job;
  }

  async listJobs(problemId: string) {
    await this.requireProblem(problemId);
    const jobs = await this.repository.listTestCaseGenerationJobs(problemId);
    return jobs;
  }

  async getJob(jobId: string) {
    const job = await this.repository.findTestCaseGenerationJobById(jobId);
    if (!job) {
      throw ApiError.notFound("Test generation job not found");
    }
    return job;
  }

  async cancelJob(jobId: string) {
    const job = await this.getJob(jobId);

    // already finished — just return as-is
    if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
      return job;
    }

    const updated = await this.repository.updateTestCaseGenerationJob(job.id, {
      status: "CANCELLED",
      completedAt: new Date()
    });
    return updated;
  }

  async listBatches(problemId: string) {
    await this.requireProblem(problemId);
    const batches = await this.repository.listGeneratedTestCaseBatches(problemId);

    // strip full test case list, just return a count
    const summaries = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const { testCases, ...summary } = batch;
      let generatedCases = 0;
      if (testCases) {
        generatedCases = testCases.length;
      }
      summaries.push({
        ...summary,
        generatedCases
      });
    }
    return summaries;
  }

  async deleteBatch(batchId: string): Promise<void> {
    await this.repository.deleteGeneratedTestCaseBatch(batchId);
  }

  // one seed → generator → (optional validator) → reference solution
  async generateOne(
    problem: Problem,
    seed: number,
    config: Pick<
      GenerationConfig,
      "runValidator" | "timeLimitMs" | "memoryLimitMb" | "allowEmptyInput" | "allowEmptyOutput"
    >
  ) {
    const generator = await this.requireActiveAsset(problem.id, "GENERATOR");
    const reference = await this.requireActiveAsset(problem.id, "REFERENCE_SOLUTION");

    // generator usually gets the seed on stdin (and as an arg)
    const generatedInput = await this.executeAsset(problem, generator, `${seed}\n`, config, [String(seed)]);

    // normalize line endings
    let normalizedInput = generatedInput.stdout.replace(/\r\n/g, "\n");
    normalizedInput = normalizedInput.replace(/\r/g, "\n");

    enforceContentLimit(normalizedInput, env.MAX_GENERATED_INPUT_BYTES, "Generated input is too large");

    if (!config.allowEmptyInput && !normalizedInput.trim()) {
      throw ApiError.badRequest("Generator produced empty input");
    }

    // optional validator step
    if (config.runValidator) {
      const validator = await this.repository.findActiveProblemAsset(problem.id, "VALIDATOR");
      if (validator) {
        const validation = await this.executeAsset(problem, validator, normalizedInput, config);
        if (validation.status !== "ACCEPTED") {
          throw ApiError.badRequest("Generated input failed validator");
        }
      }
    }

    const expected = await this.executeAsset(problem, reference, normalizedInput, config);
    const expectedOutput = normalizeOutput(expected.stdout);

    enforceContentLimit(expectedOutput, env.MAX_GENERATED_OUTPUT_BYTES, "Generated output is too large");

    if (!config.allowEmptyOutput && !expectedOutput.trim()) {
      throw ApiError.badRequest("Reference solution produced empty output");
    }

    return {
      seed,
      generatedInput: normalizedInput,
      expectedOutput,
      inputHash: hashContent(normalizedInput),
      outputHash: hashContent(expectedOutput),
      generatorStatus: generatedInput.status,
      referenceStatus: expected.status
    };
  }

  // like executeAssetRaw but throws if status isn't AC
  private async executeAsset(
    problem: Problem,
    asset: ProblemAsset,
    stdin: string,
    config: Pick<GenerationConfig, "timeLimitMs" | "memoryLimitMb">,
    args: string[] = []
  ): Promise<ExecutionResult> {
    const result = await this.executeAssetRaw(problem, asset, stdin, config, args);

    if (result.status !== "ACCEPTED") {
      // e.g. "generator failed with TIME_LIMIT_EXCEEDED"
      const label = asset.type.replace(/_/g, " ").toLowerCase();
      throw ApiError.badRequest(`${label} failed with ${result.status}`);
    }

    return result;
  }

  private async executeAssetRaw(
    problem: Problem,
    asset: ProblemAsset,
    stdin: string,
    config: Pick<GenerationConfig, "timeLimitMs" | "memoryLimitMb">,
    args: string[] = []
  ): Promise<ExecutionResult> {
    const language = await this.resolveAssetLanguage({
      languageId: asset.languageId,
      languageVersionId: asset.languageVersionId
    });

    const result = await this.executor.execute({
      problemSlug: problem.slug,
      language: language.version.label,
      profile: executionProfileFromAssetLanguage(language),
      sourceCode: asset.sourceCode,
      stdin,
      args,
      timeLimitMs: config.timeLimitMs,
      memoryLimitMb: config.memoryLimitMb
    });

    return result;
  }

  private async resolveAssetLanguage(input: {
    languageId?: string | null;
    languageVersionId?: string | null;
    languageKey?: string | null;
    version?: string | null;
  }) {
    let selectedVersion = null;

    if (input.languageVersionId) {
      selectedVersion = await this.languageRepository.findVersionById(input.languageVersionId);
    } else if (input.languageId) {
      selectedVersion = await this.languageRepository.findDefaultVersion(input.languageId);
    } else {
      // fall back to python if nothing specified
      const key = input.languageKey ?? "python";
      const version = input.version ?? undefined;
      selectedVersion = await this.languageRepository.findVersionByLanguageKey(key, version);
    }

    if (!selectedVersion) {
      throw ApiError.badRequest("Language version is not available");
    }

    const language = await this.languageRepository.findLanguageById(selectedVersion.languageId);
    if (!language) {
      throw ApiError.badRequest("Language is not available");
    }

    if (!language.isActive || !selectedVersion.isActive) {
      throw ApiError.badRequest("Language or version is disabled");
    }

    const executorType = currentExecutorType();
    const unavailableMsg = "Selected language version is not executable in the current judge environment";

    if (executorType === "JUDGE0" && !env.JUDGE0_BASE_URL) {
      throw new ApiError(400, "LANGUAGE_EXECUTOR_UNAVAILABLE", unavailableMsg);
    }

    const executionProfile = await this.languageRepository.findExecutionProfile(selectedVersion.id, executorType);

    if (!executionProfile) {
      throw new ApiError(400, "LANGUAGE_EXECUTOR_UNAVAILABLE", unavailableMsg);
    }

    if (executorType === "JUDGE0") {
      const judge0Id = executionProfile.judge0Id || selectedVersion.judge0Id;
      if (!judge0Id) {
        throw new ApiError(400, "LANGUAGE_EXECUTOR_UNAVAILABLE", unavailableMsg);
      }
    }

    if (executorType === "DOCKER") {
      const hasImage = Boolean(executionProfile.dockerImage);
      const hasCommand = Boolean(executionProfile.runCommand || executionProfile.compileCommand);
      if (!hasImage || !hasCommand) {
        throw new ApiError(400, "LANGUAGE_EXECUTOR_UNAVAILABLE", unavailableMsg);
      }
    }

    return {
      language,
      version: selectedVersion,
      executionProfile
    };
  }

  private async requireActiveAsset(problemId: string, type: ProblemAssetType): Promise<ProblemAsset> {
    const asset = await this.repository.findActiveProblemAsset(problemId, type);
    if (!asset) {
      const label = type.replace(/_/g, " ").toLowerCase();
      throw ApiError.badRequest(`${label} asset is required`);
    }
    return asset;
  }

  private async requireProblem(problemId: string): Promise<Problem> {
    const problem = await this.repository.findProblemById(problemId);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }
}

// fill defaults + validate seed/count ranges
export function normalizeGenerationConfig(raw: Partial<GenerationConfig>): GenerationConfig {
  const seedStart = Number(raw.seedStart ?? 1);
  const defaultEnd = seedStart + Number(raw.count ?? 1) - 1;
  const seedEnd = Number(raw.seedEnd ?? defaultEnd);

  if (!Number.isInteger(seedStart) || !Number.isInteger(seedEnd) || seedEnd < seedStart) {
    throw ApiError.badRequest("Seed range is invalid");
  }

  const count = Number(raw.count ?? seedEnd - seedStart + 1);
  if (!Number.isInteger(count) || count < 1) {
    throw ApiError.badRequest("Generated case count must be positive");
  }

  if (count > env.MAX_GENERATED_CASES_PER_JOB) {
    throw ApiError.badRequest(`Generation jobs are limited to ${env.MAX_GENERATED_CASES_PER_JOB} cases`);
  }

  // seeds must cover the requested count
  if (seedStart + count - 1 > seedEnd) {
    throw ApiError.badRequest("Seed range does not contain enough seeds for count");
  }

  let batchName = "Generated tests";
  if (raw.batchName && raw.batchName.trim()) {
    batchName = raw.batchName.trim();
  }

  return {
    batchName,
    description: raw.description ?? null,
    visibility: raw.visibility ?? "HIDDEN",
    count,
    seedStart,
    seedEnd,
    inputMode: "STDIN",
    replaceExistingGenerated: raw.replaceExistingGenerated ?? false,
    runValidator: raw.runValidator ?? false,
    allowEmptyInput: raw.allowEmptyInput ?? false,
    allowEmptyOutput: raw.allowEmptyOutput ?? false,
    skipDuplicates: raw.skipDuplicates ?? true,
    timeLimitMs: raw.timeLimitMs ?? 2000,
    memoryLimitMb: raw.memoryLimitMb ?? 256
  };
}

export function hashContent(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function enforceContentLimit(value: string, maxBytes: number, message: string): void {
  const size = Buffer.byteLength(value, "utf8");
  if (size > maxBytes) {
    throw ApiError.badRequest(message);
  }
}

// checker gets input + expected + actual in one stdin blob
function buildCheckerStdin(input: CheckerRunInput): string {
  return `${input.input}\n---EXPECTED---\n${input.expectedOutput}\n---ACTUAL---\n${input.actualOutput}`;
}

function sanitizeCheckerMessage(value: string): string {
  let cleaned = value.replace(/\r\n/g, "\n");
  cleaned = cleaned.replace(/\r/g, "\n");
  cleaned = cleaned.trim();
  // cap message length so we don't dump huge stderr into the API
  cleaned = cleaned.slice(0, 500);
  return cleaned;
}

function executionProfileFromAssetLanguage(resolved: {
  language: CodeLanguage;
  version: CodeLanguageVersion;
  executionProfile: ExecutionProfile;
}): ExecutionLanguageProfile {
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
