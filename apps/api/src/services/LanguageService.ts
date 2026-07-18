import { env } from "../config/env";
import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";
import type {
  CreateLanguageInput,
  CreateLanguageVersionInput,
  LanguageRepository,
  UpdateLanguageInput,
  UpdateLanguageVersionInput,
  UpsertExecutionProfileInput,
  UpsertProblemLanguageInput,
  UpsertProblemStarterCodeInput
} from "../repositories/LanguageRepository";
import type { LanguageCategory } from "../types/domain";
import { judge0UnavailableMessage } from "./judge0Health";

interface Judge0Language {
  id: number;
  name: string;
  is_archived?: boolean;
}

// language catalog + versions + problem language config + judge0 sync
export class LanguageService {
  constructor(
    private readonly languages: LanguageRepository,
    private readonly appRepository: AppRepository
  ) {}

  listPublic() {
    // only active languages for the public API
    return this.languages.listLanguages(false);
  }

  listAdmin() {
    // admin sees disabled ones too
    return this.languages.listLanguages(true);
  }

  async getPublic(key: string) {
    const language = await this.languages.findLanguageByKey(key, false);
    if (!language) {
      throw ApiError.notFound("Language not found");
    }
    return language;
  }

  async createLanguage(input: CreateLanguageInput) {
    const created = await this.languages.createLanguage(input);
    return created;
  }

  async updateLanguage(id: string, input: UpdateLanguageInput) {
    const updated = await this.languages.updateLanguage(id, input);
    return updated;
  }

  async disableLanguage(id: string) {
    await this.languages.deactivateLanguage(id);
  }

  async versions(languageId: string) {
    await this.requireLanguage(languageId);
    const list = await this.languages.listVersions(languageId, true);
    return list;
  }

  async createVersion(
    languageId: string,
    input: Omit<CreateLanguageVersionInput, "languageId"> & {
      executionProfiles?: UpsertExecutionProfileInput[];
    }
  ) {
    await this.requireLanguage(languageId);

    // pull profiles out so createVersion only gets version fields
    const { executionProfiles, ...versionInput } = input;

    const version = await this.languages.createVersion({
      ...versionInput,
      languageId
    });

    // attach any execution profiles that came with the request
    const profiles = executionProfiles ?? [];
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      await this.languages.upsertExecutionProfile({
        ...profile,
        languageVersionId: version.id
      });
    }

    const full = await this.languages.findVersionById(version.id, true);
    return full;
  }

  async updateVersion(
    id: string,
    input: UpdateLanguageVersionInput & { executionProfiles?: UpsertExecutionProfileInput[] }
  ) {
    const { executionProfiles, ...versionInput } = input;

    const version = await this.languages.updateVersion(id, versionInput);

    const profiles = executionProfiles ?? [];
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      await this.languages.upsertExecutionProfile({
        ...profile,
        languageVersionId: id
      });
    }

    const full = await this.languages.findVersionById(version.id, true);
    return full;
  }

  async disableVersion(id: string) {
    await this.languages.deactivateVersion(id);
  }

  async problemLanguages(slug: string) {
    const problem = await this.appRepository.findProblemBySlug(slug);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    if (problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    const options = await this.languages.listProblemLanguageOptions(problem.id, false);
    return options;
  }

  async adminProblemLanguages(problemId: string) {
    await this.requireProblem(problemId);
    const options = await this.languages.listProblemLanguageOptions(problemId, true);
    return options;
  }

  async updateProblemLanguages(problemId: string, items: UpsertProblemLanguageInput[]) {
    await this.requireProblem(problemId);

    // validate each language/version before writing anything
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const language = await this.languages.findLanguageById(item.languageId, true);

      if (!language) {
        throw ApiError.badRequest(`Language ${item.languageId} does not exist`);
      }

      if (item.isEnabled && !language.isActive) {
        throw ApiError.badRequest(`${language.displayName} is disabled`);
      }

      if (item.languageVersionId) {
        let version = null;
        for (let j = 0; j < language.versions.length; j++) {
          if (language.versions[j].id === item.languageVersionId) {
            version = language.versions[j];
            break;
          }
        }

        if (!version) {
          throw ApiError.badRequest(`Version ${item.languageVersionId} does not belong to ${language.displayName}`);
        }

        if (item.isEnabled && !version.isActive) {
          throw ApiError.badRequest(`${version.label} is disabled`);
        }
      }
    }

    const result = await this.languages.upsertProblemLanguages(problemId, items);
    return result;
  }

  async upsertProblemStarterCode(input: UpsertProblemStarterCodeInput) {
    await this.requireProblem(input.problemId);

    const language = await this.languages.findLanguageById(input.languageId, true);
    if (!language) {
      throw ApiError.badRequest(`Language ${input.languageId} does not exist`);
    }

    if (input.languageVersionId) {
      let found = false;
      for (let i = 0; i < language.versions.length; i++) {
        if (language.versions[i].id === input.languageVersionId) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw ApiError.badRequest(`Version ${input.languageVersionId} does not belong to ${language.displayName}`);
      }
    }

    const starter = await this.languages.upsertProblemStarterCode(input);
    return starter;
  }

  async updateProblemStarterCode(id: string, code: string) {
    const updated = await this.languages.updateProblemStarterCode(id, { code });
    return updated;
  }

  // pull languages from Judge0 and upsert into our catalog
  async syncJudge0(): Promise<{ created: number; updated: number; skipped: number }> {
    if (!env.JUDGE0_BASE_URL) {
      throw ApiError.badRequest("JUDGE0_BASE_URL is not configured");
    }

    const baseUrl = env.JUDGE0_BASE_URL.replace(/\/+$/, "");
    const url = `${baseUrl}/languages`;

    let response: Response;
    try {
      let headers: Record<string, string> | undefined = undefined;
      if (env.JUDGE0_API_KEY) {
        headers = { "x-rapidapi-key": env.JUDGE0_API_KEY };
      }
      response = await fetch(url, { headers });
    } catch {
      throw ApiError.badRequest(judge0UnavailableMessage(env.JUDGE0_BASE_URL));
    }

    if (!response.ok) {
      throw ApiError.badRequest(`Judge0 languages sync failed with ${response.status}`);
    }

    const payload = (await response.json()) as Judge0Language[];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      const parsed = parseJudge0Name(item.name);

      // skip languages we don't map yet
      if (!parsed) {
        skipped = skipped + 1;
        continue;
      }

      let language = await this.languages.findLanguageByKey(parsed.key, true);

      if (!language) {
        language = await this.languages.createLanguage({
          key: parsed.key,
          displayName: parsed.displayName,
          monacoId: parsed.monacoId,
          fileExtension: parsed.fileExtension,
          category: parsed.category,
          isCompiled: parsed.isCompiled,
          isActive: !item.is_archived,
          sortOrder: 1000 + item.id
        });
        created = created + 1;
      }

      // match by judge0 id or by the full label string
      let existing = null;
      for (let j = 0; j < language.versions.length; j++) {
        const version = language.versions[j];
        if (version.judge0Id === item.id || version.label === item.name) {
          existing = version;
          break;
        }
      }

      if (existing) {
        if (existing.judge0Id !== item.id) {
          await this.languages.updateVersion(existing.id, { judge0Id: item.id });
        }
        await this.languages.upsertExecutionProfile({
          languageVersionId: existing.id,
          executorType: "JUDGE0",
          judge0Id: item.id
        });
        updated = updated + 1;
      } else {
        // brand new version for this language
        const isDefault = language.versions.length === 0;
        const version = await this.languages.createVersion({
          languageId: language.id,
          version: parsed.version,
          label: item.name,
          judge0Id: item.id,
          sourceFileName: `main.${parsed.fileExtension}`,
          starterTemplate: "",
          isDefault,
          isActive: !item.is_archived
        });
        await this.languages.upsertExecutionProfile({
          languageVersionId: version.id,
          executorType: "JUDGE0",
          judge0Id: item.id,
          isActive: !item.is_archived
        });
        created = created + 1;
      }
    }

    return { created, updated, skipped };
  }

  private async requireLanguage(id: string) {
    const language = await this.languages.findLanguageById(id, true);
    if (!language) {
      throw ApiError.notFound("Language not found");
    }
    return language;
  }

  private async requireProblem(id: string) {
    const problem = await this.appRepository.findProblemById(id);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }
}

// rough name parsing for Judge0 language labels
// returns null if we don't support that language family yet
function parseJudge0Name(name: string): {
  key: string;
  displayName: string;
  version: string;
  monacoId: string;
  fileExtension: string;
  category: LanguageCategory;
  isCompiled: boolean;
} | null {
  const normalized = name.toLowerCase();

  if (normalized.includes("c++")) {
    return {
      key: "cpp",
      displayName: "C++",
      version: name,
      monacoId: "cpp",
      fileExtension: "cpp",
      category: "SYSTEMS",
      isCompiled: true
    };
  }

  if (normalized.startsWith("c ")) {
    return {
      key: "c",
      displayName: "C",
      version: name,
      monacoId: "c",
      fileExtension: "c",
      category: "SYSTEMS",
      isCompiled: true
    };
  }

  if (normalized.includes("java")) {
    return {
      key: "java",
      displayName: "Java",
      version: name,
      monacoId: "java",
      fileExtension: "java",
      category: "JVM",
      isCompiled: true
    };
  }

  if (normalized.includes("python")) {
    return {
      key: "python",
      displayName: "Python",
      version: name,
      monacoId: "python",
      fileExtension: "py",
      category: "SCRIPTING",
      isCompiled: false
    };
  }

  if (normalized.includes("javascript") || normalized.includes("node")) {
    return {
      key: "javascript",
      displayName: "JavaScript",
      version: name,
      monacoId: "javascript",
      fileExtension: "js",
      category: "SCRIPTING",
      isCompiled: false
    };
  }

  if (normalized.includes("typescript")) {
    return {
      key: "typescript",
      displayName: "TypeScript",
      version: name,
      monacoId: "typescript",
      fileExtension: "ts",
      category: "SCRIPTING",
      isCompiled: true
    };
  }

  if (normalized.includes("go")) {
    return {
      key: "go",
      displayName: "Go",
      version: name,
      monacoId: "go",
      fileExtension: "go",
      category: "GENERAL_PURPOSE",
      isCompiled: true
    };
  }

  if (normalized.includes("rust")) {
    return {
      key: "rust",
      displayName: "Rust",
      version: name,
      monacoId: "rust",
      fileExtension: "rs",
      category: "SYSTEMS",
      isCompiled: true
    };
  }

  if (normalized.includes("ruby")) {
    return {
      key: "ruby",
      displayName: "Ruby",
      version: name,
      monacoId: "ruby",
      fileExtension: "rb",
      category: "SCRIPTING",
      isCompiled: false
    };
  }

  return null;
}
