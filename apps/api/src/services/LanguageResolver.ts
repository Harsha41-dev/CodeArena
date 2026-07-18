import { env } from "../config/env";
import { logger } from "../config/logger";
import { legacyLanguageKeyMap } from "../constants/languageCatalog";
import { ApiError } from "../errors/ApiError";
import type { LanguageRepository } from "../repositories/LanguageRepository";
import type {
  CodeLanguage,
  CodeLanguageVersion,
  ExecutionProfile,
  ExecutorType,
  LegacyLanguage,
  Problem,
  ProblemLanguageOption
} from "../types/domain";

export interface LanguageSelectionInput {
  language?: string;
  languageId?: string;
  languageVersionId?: string;
  languageKey?: string;
  version?: string;
}

export interface ResolvedLanguage {
  language: CodeLanguage;
  version: CodeLanguageVersion;
  executionProfile: ExecutionProfile;
  starterCode: string;
  effectiveTimeLimitMs: number;
  effectiveMemoryLimitMb: number;
  legacyLanguage: LegacyLanguage;
  languageKeySnapshot: string;
  languageNameSnapshot: string;
  languageVersionSnapshot: string;
}

// figures out which language+version+profile a submit/run should use
export class LanguageResolver {
  constructor(private readonly languageRepository: LanguageRepository) {}

  async resolveForProblem(problem: Problem, input: LanguageSelectionInput): Promise<ResolvedLanguage> {
    const option = await this.resolveProblemOption(problem.id, input);

    // basic enablement checks
    if (!option.language.isActive) {
      throw ApiError.badRequest("Language is disabled");
    }
    if (!option.version.isActive) {
      throw ApiError.badRequest("Language version is disabled");
    }
    if (!option.isEnabled) {
      throw ApiError.badRequest("Language is not enabled for this problem");
    }

    const executorType = currentExecutorType();

    // judge0 needs a base url configured
    if (executorType === "JUDGE0" && !env.JUDGE0_BASE_URL) {
      throw executorUnavailable(option.version.label, executorType, "JUDGE0_BASE_URL is not configured");
    }

    const executionProfile = await this.languageRepository.findExecutionProfile(option.version.id, executorType);

    if (!executionProfile) {
      throw executorUnavailable(option.version.label, executorType, "missing execution profile");
    }

    // judge0 needs a language id on the profile or version
    if (executorType === "JUDGE0") {
      const judge0Id = executionProfile.judge0Id || option.version.judge0Id;
      if (!judge0Id) {
        throw executorUnavailable(option.version.label, executorType, "missing Judge0 language id");
      }
    }

    // docker needs image + at least one command
    if (executorType === "DOCKER") {
      const hasImage = Boolean(executionProfile.dockerImage);
      const hasCommand = Boolean(executionProfile.runCommand || executionProfile.compileCommand);
      if (!hasImage || !hasCommand) {
        throw executorUnavailable(option.version.label, executorType, "missing Docker execution profile");
      }
    }

    // starter code: problem override first, then version template
    let starterCode = "";
    if (option.starterCode) {
      starterCode = option.starterCode;
    } else if (option.version.starterTemplate) {
      starterCode = option.version.starterTemplate;
    }

    // apply language multipliers on top of problem limits
    const effectiveTimeLimitMs = Math.ceil(problem.timeLimitMs * option.version.timeLimitMultiplier);
    const effectiveMemoryLimitMb = Math.ceil(problem.memoryLimitMb * option.version.memoryLimitMultiplier);

    return {
      language: option.language,
      version: option.version,
      executionProfile,
      starterCode,
      effectiveTimeLimitMs,
      effectiveMemoryLimitMb,
      legacyLanguage: toLegacyLanguage(option.language.key),
      languageKeySnapshot: option.language.key,
      languageNameSnapshot: option.language.displayName,
      languageVersionSnapshot: option.version.label
    };
  }

  async listProblemOptions(problemId: string, includeInactive = false): Promise<ProblemLanguageOption[]> {
    const options = await this.languageRepository.listProblemLanguageOptions(problemId, includeInactive);
    return options;
  }

  // pick the right problem language option based on the request fields
  private async resolveProblemOption(problemId: string, input: LanguageSelectionInput): Promise<ProblemLanguageOption> {
    // include inactive so we can give a clearer error later if disabled
    const options = await this.languageRepository.listProblemLanguageOptions(problemId, true);

    const rawLanguage = input.language ? input.language.trim() : undefined;

    // support old CPP/JAVA/PYTHON style keys
    let legacy: { key: string; version?: string } | undefined = undefined;
    if (rawLanguage) {
      legacy = legacyLanguageKeyMap[rawLanguage.toUpperCase()];
    }

    let languageKey: string | undefined = undefined;
    if (input.languageKey) {
      languageKey = input.languageKey.trim().toLowerCase();
    } else if (legacy) {
      languageKey = legacy.key;
    } else if (rawLanguage) {
      languageKey = rawLanguage.toLowerCase();
    }

    let requestedVersion = input.version;
    if (!requestedVersion && legacy) {
      requestedVersion = legacy.version;
    }

    let option: ProblemLanguageOption | undefined = undefined;

    if (input.languageVersionId) {
      // most specific: exact version id
      for (let i = 0; i < options.length; i++) {
        const item = options[i];
        if (item.version.id !== input.languageVersionId) {
          continue;
        }
        if (input.languageId && item.language.id !== input.languageId) {
          continue;
        }
        if (languageKey && item.language.key !== languageKey) {
          continue;
        }
        option = item;
        break;
      }
    } else if (input.languageId) {
      const languageOptions: ProblemLanguageOption[] = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].language.id === input.languageId) {
          languageOptions.push(options[i]);
        }
      }
      option = selectRequestedVersion(languageOptions, requestedVersion);
    } else if (languageKey) {
      const languageOptions: ProblemLanguageOption[] = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].language.key === languageKey) {
          languageOptions.push(options[i]);
        }
      }
      option = selectRequestedVersion(languageOptions, requestedVersion);
    }

    if (!option) {
      throw ApiError.badRequest("Language or version is not available for this problem");
    }

    return option;
  }
}

function executorUnavailable(label: string, executorType: ExecutorType, reason: string): ApiError {
  logger.warn({ languageVersion: label, executorType, reason }, "Executor unavailable for selected language version");
  return new ApiError(
    400,
    "LANGUAGE_EXECUTOR_UNAVAILABLE",
    "Selected language version is not executable in the current judge environment"
  );
}

// if a version string is given, match by id / version / label; else pick default
function selectRequestedVersion(
  options: ProblemLanguageOption[],
  requestedVersion?: string
): ProblemLanguageOption | undefined {
  if (requestedVersion) {
    const normalized = requestedVersion.toLowerCase();
    for (let i = 0; i < options.length; i++) {
      const item = options[i];
      if (item.version.id === requestedVersion) {
        return item;
      }
      if (item.version.version.toLowerCase() === normalized) {
        return item;
      }
      if (item.version.label.toLowerCase() === normalized) {
        return item;
      }
    }
    return undefined;
  }

  // prefer the default version, otherwise first one
  for (let i = 0; i < options.length; i++) {
    if (options[i].version.isDefault) {
      return options[i];
    }
  }
  return options[0];
}

export function currentExecutorType(): ExecutorType {
  if (env.EXECUTOR_MODE === "docker") {
    return "DOCKER";
  }
  if (env.EXECUTOR_MODE === "judge0") {
    return "JUDGE0";
  }
  return "MOCK";
}

// map language keys back to the old 4-value enum used on submissions
function toLegacyLanguage(key: string): LegacyLanguage {
  if (key === "cpp" || key === "c") {
    return "CPP";
  }
  if (key === "java" || key === "kotlin" || key === "scala" || key === "clojure") {
    return "JAVA";
  }
  if (key === "javascript" || key === "typescript") {
    return "JAVASCRIPT";
  }
  return "PYTHON";
}
