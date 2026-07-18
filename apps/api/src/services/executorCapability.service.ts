import { env } from "../config/env";
import type { AppRepository } from "../repositories/AppRepository";
import type { LanguageRepository } from "../repositories/LanguageRepository";
import type {
  CodeLanguage,
  CodeLanguageVersion,
  ExecutionProfile,
  ExecutorType,
  Problem,
  ProblemLanguageOption
} from "../types/domain";
import { currentExecutorType } from "./LanguageResolver";
import { checkJudge0Health } from "./judge0Health";
import { ApiError } from "../errors/ApiError";

export interface ExecutorCapabilityQuery {
  problemId?: string;
  problemSlug?: string;
  admin?: boolean;
}

export interface ExecutorCapabilityEntry {
  language: Pick<CodeLanguage, "id" | "key" | "displayName" | "category" | "isActive">;
  version: Pick<CodeLanguageVersion, "id" | "version" | "label" | "isActive">;
  canRun: boolean;
  canSubmit: boolean;
  reason?: string;
  admin?: {
    executorType: ExecutorType;
    executionProfileId?: string | null;
    executionProfileActive?: boolean;
    judge0Id?: number | null;
    dockerImage?: string | null;
    hasCompileCommand: boolean;
    hasRunCommand: boolean;
    languageActive: boolean;
    versionActive: boolean;
    problemEnabled?: boolean;
    missingConfigReason?: string;
  };
}

export interface ExecutorCapabilityResponse {
  executorMode: typeof env.EXECUTOR_MODE;
  executorType: ExecutorType;
  executorConfigured: boolean;
  executorConfigurationReason?: string;
  problem?: Pick<Problem, "id" | "slug" | "title">;
  summary: {
    activeSupportedLanguageVersions: number;
    unsupportedLanguageVersions: number;
    missingJudge0Ids: number;
    missingDockerProfiles: number;
    inactiveExecutionProfiles: number;
    globallyDisabledLanguages: number;
    problemDisabledLanguages: number;
  };
  languages: ExecutorCapabilityEntry[];
}

// tells the UI which languages can actually run/submit right now
export class ExecutorCapabilityService {
  constructor(
    private readonly languages: LanguageRepository,
    private readonly repository: AppRepository
  ) {}

  async capabilities(query: ExecutorCapabilityQuery = {}): Promise<ExecutorCapabilityResponse> {
    const executorType = currentExecutorType();
    const problem = await this.findProblem(query);
    const isAdmin = query.admin ?? false;

    let options: ProblemLanguageOption[];
    if (problem) {
      options = await this.languages.listProblemLanguageOptions(problem.id, isAdmin);
    } else {
      options = await this.globalOptions(isAdmin);
    }

    // describe each option
    const entries: ExecutorCapabilityEntry[] = [];
    for (let i = 0; i < options.length; i++) {
      const entry = this.describeOption(options[i], executorType, isAdmin);
      entries.push(entry);
    }

    // non-admin only sees active language+version rows
    let visibleEntries: ExecutorCapabilityEntry[] = [];
    if (isAdmin) {
      visibleEntries = entries;
    } else {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.language.isActive && entry.version.isActive) {
          visibleEntries.push(entry);
        }
      }
    }

    const configuration = executorConfiguration(executorType);

    let problemInfo: Pick<Problem, "id" | "slug" | "title"> | undefined = undefined;
    if (problem) {
      problemInfo = {
        id: problem.id,
        slug: problem.slug,
        title: problem.title
      };
    }

    return {
      executorMode: env.EXECUTOR_MODE,
      executorType,
      executorConfigured: configuration.executorConfigured,
      executorConfigurationReason: configuration.executorConfigurationReason,
      problem: problemInfo,
      summary: summarize(visibleEntries),
      languages: visibleEntries
    };
  }

  async health(admin = false) {
    const capabilities = await this.capabilities({ admin });

    let judge0Probe = null;
    if (capabilities.executorType === "JUDGE0") {
      judge0Probe = await checkJudge0Health();
    }

    let baseUrlConfigured: boolean | undefined = undefined;
    if (capabilities.executorType === "JUDGE0") {
      baseUrlConfigured = Boolean(env.JUDGE0_BASE_URL);
    }

    return {
      executorMode: capabilities.executorMode,
      executorType: capabilities.executorType,
      executorConfigured: capabilities.executorConfigured,
      executorConfigurationReason: capabilities.executorConfigurationReason,
      isProductionJudge: capabilities.executorType === "JUDGE0",
      baseUrlConfigured,
      judge0Reachable: judge0Probe ? judge0Probe.judge0Reachable : undefined,
      judge0LanguagesCount: judge0Probe ? judge0Probe.languagesCount : undefined,
      supportedLanguageVersions: capabilities.summary.activeSupportedLanguageVersions,
      unsupportedLanguageVersions: capabilities.summary.unsupportedLanguageVersions
    };
  }

  // public health endpoint — throws if judge0 is configured but unreachable
  async publicHealth() {
    const executorType = currentExecutorType();
    const configuration = executorConfiguration(executorType);

    let baseUrlConfigured: boolean | undefined = undefined;
    if (executorType === "JUDGE0") {
      baseUrlConfigured = Boolean(env.JUDGE0_BASE_URL);
    }

    const base = {
      executorMode: env.EXECUTOR_MODE,
      executorType,
      executorConfigured: configuration.executorConfigured,
      executorConfigurationReason: configuration.executorConfigurationReason,
      isProductionJudge: executorType === "JUDGE0",
      baseUrlConfigured
    };

    // mock/docker don't need a live probe
    if (executorType !== "JUDGE0") {
      return base;
    }

    const probe = await checkJudge0Health();
    if (!probe.judge0Reachable) {
      const message = probe.message ?? "Judge0 is not reachable. Start local Judge0 Docker services first.";
      throw ApiError.badRequest(message);
    }

    return {
      ...base,
      executorConfigured: true,
      judge0Reachable: true,
      judge0LanguagesCount: probe.languagesCount
    };
  }

  private async findProblem(query: ExecutorCapabilityQuery): Promise<Problem | null> {
    if (query.problemId) {
      const problem = await this.repository.findProblemById(query.problemId);
      if (!problem) {
        return null;
      }
      // non-admin can't inspect private problems
      if (!query.admin && problem.visibility !== "PUBLIC") {
        return null;
      }
      return problem;
    }

    if (query.problemSlug) {
      const problem = await this.repository.findProblemBySlug(query.problemSlug);
      if (!problem) {
        return null;
      }
      if (!query.admin && problem.visibility !== "PUBLIC") {
        return null;
      }
      return problem;
    }

    return null;
  }

  // when no problem is given, build options from the full language catalog
  private async globalOptions(includeInactive: boolean): Promise<ProblemLanguageOption[]> {
    const languages = await this.languages.listLanguages(includeInactive);
    const executorType = currentExecutorType();
    const options: ProblemLanguageOption[] = [];

    for (let i = 0; i < languages.length; i++) {
      const language = languages[i];
      for (let j = 0; j < language.versions.length; j++) {
        const version = language.versions[j];

        // pick the profile for the current executor if present
        let executionProfile = null;
        if (version.executionProfiles) {
          for (let k = 0; k < version.executionProfiles.length; k++) {
            if (version.executionProfiles[k].executorType === executorType) {
              executionProfile = version.executionProfiles[k];
              break;
            }
          }
        }

        options.push({
          language,
          version,
          executionProfile,
          isEnabled: true,
          isPinnedVersion: false,
          starterCode: version.starterTemplate ?? "",
          hasProblemStarterCode: false
        });
      }
    }

    return options;
  }

  private describeOption(
    option: ProblemLanguageOption,
    executorType: ExecutorType,
    admin: boolean
  ): ExecutorCapabilityEntry {
    // prefer profile from the version list, fall back to option.executionProfile
    let profile: ExecutionProfile | null = null;
    if (option.version.executionProfiles) {
      for (let i = 0; i < option.version.executionProfiles.length; i++) {
        if (option.version.executionProfiles[i].executorType === executorType) {
          profile = option.version.executionProfiles[i];
          break;
        }
      }
    }
    if (!profile && option.executionProfile) {
      profile = option.executionProfile;
    }

    const configIssue = capabilityIssue(option.language, option.version, option.isEnabled, profile, executorType);

    const canExecute = !configIssue;

    const entry: ExecutorCapabilityEntry = {
      language: {
        id: option.language.id,
        key: option.language.key,
        displayName: option.language.displayName,
        category: option.language.category,
        isActive: option.language.isActive
      },
      version: {
        id: option.version.id,
        version: option.version.version,
        label: option.version.label,
        isActive: option.version.isActive
      },
      canRun: canExecute,
      canSubmit: canExecute,
      reason: configIssue ? publicReason(configIssue) : undefined
    };

    // extra debug fields only for admins
    if (admin) {
      entry.admin = {
        executorType,
        executionProfileId: profile ? profile.id : null,
        executionProfileActive: profile ? profile.isActive : undefined,
        judge0Id: profile?.judge0Id ?? option.version.judge0Id ?? null,
        dockerImage: profile?.dockerImage ?? option.version.dockerImage ?? null,
        hasCompileCommand: Boolean(profile?.compileCommand ?? option.version.compileCommand),
        hasRunCommand: Boolean(profile?.runCommand ?? option.version.runCommand),
        languageActive: option.language.isActive,
        versionActive: option.version.isActive,
        problemEnabled: option.isEnabled,
        missingConfigReason: configIssue ?? undefined
      };
    }

    return entry;
  }
}

export function executorConfiguration(executorType = currentExecutorType()): {
  executorConfigured: boolean;
  executorConfigurationReason?: string;
} {
  if (executorType === "JUDGE0" && !env.JUDGE0_BASE_URL) {
    return {
      executorConfigured: false,
      executorConfigurationReason: "JUDGE0_BASE_URL is not configured"
    };
  }
  return { executorConfigured: true };
}

// returns a reason string if this language/version can't run, else null
function capabilityIssue(
  language: CodeLanguage,
  version: CodeLanguageVersion,
  problemEnabled: boolean,
  profile: ExecutionProfile | null,
  executorType: ExecutorType
): string | null {
  if (!language.isActive) {
    return "Language is globally disabled";
  }
  if (!version.isActive) {
    return "Language version is disabled";
  }
  if (!problemEnabled) {
    return "Language is disabled for this problem";
  }

  const configuration = executorConfiguration(executorType);
  if (!configuration.executorConfigured) {
    return configuration.executorConfigurationReason ?? "Executor is not configured";
  }

  if (!profile) {
    return "Missing execution profile";
  }
  if (!profile.isActive) {
    return "Execution profile is inactive";
  }

  if (executorType === "JUDGE0") {
    const judge0Id = profile.judge0Id ?? version.judge0Id;
    if (!judge0Id) {
      return "Missing Judge0 language id";
    }
  }

  if (executorType === "DOCKER") {
    const dockerImage = profile.dockerImage ?? version.dockerImage;
    if (!dockerImage) {
      return "Missing Docker image";
    }

    const runCommand = profile.runCommand ?? version.runCommand;
    const compileCommand = profile.compileCommand ?? version.compileCommand;
    if (!runCommand && !compileCommand) {
      return "Missing Docker compile/run command";
    }
  }

  return null;
}

// user-facing reason is a bit shorter / less technical
function publicReason(issue: string): string {
  if (issue === "Language is globally disabled") {
    return "Language is disabled";
  }
  if (issue === "Language version is disabled") {
    return "Language version is disabled";
  }
  if (issue === "Language is disabled for this problem") {
    return "Language is not enabled for this problem";
  }
  return "Selected language version is not executable in the current judge environment";
}

function summarize(entries: ExecutorCapabilityEntry[]) {
  const summary = {
    activeSupportedLanguageVersions: 0,
    unsupportedLanguageVersions: 0,
    missingJudge0Ids: 0,
    missingDockerProfiles: 0,
    inactiveExecutionProfiles: 0,
    globallyDisabledLanguages: 0,
    problemDisabledLanguages: 0
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.canRun) {
      summary.activeSupportedLanguageVersions += 1;
    } else {
      summary.unsupportedLanguageVersions += 1;
    }

    if (!entry.language.isActive) {
      summary.globallyDisabledLanguages += 1;
    }

    if (entry.admin && entry.admin.problemEnabled === false) {
      summary.problemDisabledLanguages += 1;
    }

    if (entry.admin && entry.admin.missingConfigReason === "Missing Judge0 language id") {
      summary.missingJudge0Ids += 1;
    }

    if (entry.admin && entry.admin.missingConfigReason) {
      if (entry.admin.missingConfigReason.startsWith("Missing Docker")) {
        summary.missingDockerProfiles += 1;
      }
    }

    if (entry.admin && entry.admin.missingConfigReason === "Execution profile is inactive") {
      summary.inactiveExecutionProfiles += 1;
    }
  }

  return summary;
}
