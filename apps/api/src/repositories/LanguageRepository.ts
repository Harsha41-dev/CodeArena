import { Prisma, PrismaClient } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { languageCatalog } from "../constants/languageCatalog";
import { ApiError } from "../errors/ApiError";
import type {
  CodeLanguage,
  CodeLanguageVersion,
  ExecutionProfile,
  ExecutorType,
  LanguageCategory,
  LanguageWithVersions,
  ProblemLanguage,
  ProblemLanguageOption,
  ProblemStarterCode
} from "../types/domain";

export interface CreateLanguageInput {
  key: string;
  displayName: string;
  monacoId: string;
  fileExtension: string;
  category: LanguageCategory;
  isCompiled?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateLanguageInput = Partial<Omit<CreateLanguageInput, "key">> & { key?: string };

export interface CreateLanguageVersionInput {
  languageId: string;
  version: string;
  label: string;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  timeLimitMultiplier?: number;
  memoryLimitMultiplier?: number;
  sourceFileName: string;
  executableFileName?: string | null;
  starterTemplate?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export type UpdateLanguageVersionInput = Partial<Omit<CreateLanguageVersionInput, "languageId">>;

export interface UpsertExecutionProfileInput {
  languageVersionId: string;
  executorType: ExecutorType;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  environment?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  isActive?: boolean;
}

export interface UpsertProblemLanguageInput {
  languageId: string;
  languageVersionId?: string | null;
  isEnabled: boolean;
}

export interface UpsertProblemStarterCodeInput {
  problemId: string;
  languageId: string;
  languageVersionId?: string | null;
  code: string;
}

// language catalog + versions + per-problem config
// memory + prisma implementations live in this file
export interface LanguageRepository {
  // languages
  listLanguages(includeInactive?: boolean): Promise<LanguageWithVersions[]>;
  findLanguageById(id: string, includeInactive?: boolean): Promise<LanguageWithVersions | null>;
  findLanguageByKey(key: string, includeInactive?: boolean): Promise<LanguageWithVersions | null>;
  createLanguage(input: CreateLanguageInput): Promise<LanguageWithVersions>;
  updateLanguage(id: string, input: UpdateLanguageInput): Promise<LanguageWithVersions>;
  deactivateLanguage(id: string): Promise<void>;

  // versions
  listVersions(
    languageId: string,
    includeInactive?: boolean
  ): Promise<Array<CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] }>>;
  findVersionById(
    id: string,
    includeInactive?: boolean
  ): Promise<(CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] }) | null>;
  findDefaultVersion(
    languageId: string
  ): Promise<(CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] }) | null>;
  findVersionByLanguageKey(
    key: string,
    version?: string
  ): Promise<(CodeLanguageVersion & { executionProfiles?: ExecutionProfile[]; language: CodeLanguage }) | null>;
  createVersion(
    input: CreateLanguageVersionInput
  ): Promise<CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] }>;
  updateVersion(
    id: string,
    input: UpdateLanguageVersionInput
  ): Promise<CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] }>;
  deactivateVersion(id: string): Promise<void>;

  // how a version runs under mock / judge0 / docker
  findExecutionProfile(languageVersionId: string, executorType: ExecutorType): Promise<ExecutionProfile | null>;
  upsertExecutionProfile(input: UpsertExecutionProfileInput): Promise<ExecutionProfile>;

  // problem-level enablement + starter code
  listProblemLanguageOptions(problemId: string, includeInactive?: boolean): Promise<ProblemLanguageOption[]>;
  upsertProblemLanguages(problemId: string, items: UpsertProblemLanguageInput[]): Promise<ProblemLanguage[]>;
  upsertProblemStarterCode(input: UpsertProblemStarterCodeInput): Promise<ProblemStarterCode>;
  updateProblemStarterCode(id: string, input: { code: string }): Promise<ProblemStarterCode>;
}

// in-memory language store (seeded from languageCatalog)
export class MemoryLanguageRepository implements LanguageRepository {
  private languages: CodeLanguage[] = [];
  private versions: CodeLanguageVersion[] = [];
  private profiles: ExecutionProfile[] = [];
  private problemLanguages: ProblemLanguage[] = [];
  private starterCodes: ProblemStarterCode[] = [];

  constructor(seed = true) {
    if (seed) {
      this.seed();
    }
  }

  async listLanguages(includeInactive = false): Promise<LanguageWithVersions[]> {
    const filtered: CodeLanguage[] = [];
    for (let i = 0; i < this.languages.length; i++) {
      const language = this.languages[i];
      if (includeInactive || language.isActive) {
        filtered.push(language);
      }
    }

    filtered.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    const result: LanguageWithVersions[] = [];
    for (let i = 0; i < filtered.length; i++) {
      result.push(this.withVersions(filtered[i], includeInactive));
    }
    return result;
  }

  async findLanguageById(id: string, includeInactive = false): Promise<LanguageWithVersions | null> {
    let language: CodeLanguage | undefined = undefined;
    for (let i = 0; i < this.languages.length; i++) {
      const item = this.languages[i];
      if (item.id === id && (includeInactive || item.isActive)) {
        language = item;
        break;
      }
    }
    if (!language) {
      return null;
    }
    return this.withVersions(language, includeInactive);
  }

  async findLanguageByKey(key: string, includeInactive = false): Promise<LanguageWithVersions | null> {
    const normalized = key.toLowerCase();
    let language: CodeLanguage | undefined = undefined;
    for (let i = 0; i < this.languages.length; i++) {
      const item = this.languages[i];
      if (item.key === normalized && (includeInactive || item.isActive)) {
        language = item;
        break;
      }
    }
    if (!language) {
      return null;
    }
    return this.withVersions(language, includeInactive);
  }

  async createLanguage(input: CreateLanguageInput): Promise<LanguageWithVersions> {
    if (this.languages.some((language) => language.key === input.key.toLowerCase())) {
      throw ApiError.conflict("Language key already exists");
    }
    const now = new Date();
    const language: CodeLanguage = {
      id: uuid(),
      key: input.key.toLowerCase(),
      displayName: input.displayName,
      monacoId: input.monacoId,
      fileExtension: input.fileExtension,
      category: input.category,
      isActive: input.isActive ?? true,
      isCompiled: input.isCompiled ?? false,
      sortOrder: input.sortOrder ?? this.languages.length + 1,
      createdAt: now,
      updatedAt: now
    };
    this.languages.push(language);
    return this.withVersions(language, true);
  }

  async updateLanguage(id: string, input: UpdateLanguageInput): Promise<LanguageWithVersions> {
    const language = this.requireLanguage(id, true);
    if (input.key && this.languages.some((item) => item.id !== id && item.key === input.key?.toLowerCase())) {
      throw ApiError.conflict("Language key already exists");
    }
    Object.assign(language, { ...input, key: input.key?.toLowerCase() ?? language.key, updatedAt: new Date() });
    return this.withVersions(language, true);
  }

  async deactivateLanguage(id: string): Promise<void> {
    const language = this.requireLanguage(id, true);
    language.isActive = false;
    language.updatedAt = new Date();
  }

  async listVersions(languageId: string, includeInactive = false) {
    return this.versionsFor(languageId, includeInactive);
  }

  async findVersionById(id: string, includeInactive = false) {
    const version = this.versions.find((item) => item.id === id && (includeInactive || item.isActive));
    return version ? this.withProfiles(version) : null;
  }

  async findDefaultVersion(languageId: string) {
    const version =
      this.versions.find((item) => item.languageId === languageId && item.isDefault && item.isActive) ??
      this.versions.find((item) => item.languageId === languageId && item.isActive);
    return version ? this.withProfiles(version) : null;
  }

  async findVersionByLanguageKey(key: string, version?: string) {
    const language = await this.findLanguageByKey(key);
    if (!language) return null;
    const selected =
      (version
        ? language.versions.find(
            (item) =>
              item.id === version ||
              item.version.toLowerCase() === version.toLowerCase() ||
              item.label.toLowerCase() === version.toLowerCase()
          )
        : language.versions.find((item) => item.isDefault)) ?? language.versions[0];
    return selected ? { ...selected, language } : null;
  }

  async createVersion(input: CreateLanguageVersionInput) {
    this.requireLanguage(input.languageId, true);
    if (this.versions.some((version) => version.languageId === input.languageId && version.version === input.version)) {
      throw ApiError.conflict("Language version already exists");
    }
    if (input.isDefault)
      this.versions
        .filter((version) => version.languageId === input.languageId)
        .forEach((version) => (version.isDefault = false));
    const now = new Date();
    const version: CodeLanguageVersion = {
      id: uuid(),
      languageId: input.languageId,
      version: input.version,
      label: input.label,
      judge0Id: input.judge0Id ?? null,
      dockerImage: input.dockerImage ?? null,
      compileCommand: input.compileCommand ?? null,
      runCommand: input.runCommand ?? null,
      timeLimitMultiplier: input.timeLimitMultiplier ?? 1,
      memoryLimitMultiplier: input.memoryLimitMultiplier ?? 1,
      sourceFileName: input.sourceFileName,
      executableFileName: input.executableFileName ?? null,
      starterTemplate: input.starterTemplate ?? null,
      isDefault: input.isDefault ?? this.versions.every((item) => item.languageId !== input.languageId),
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.versions.push(version);
    this.addDefaultProfiles(version);
    return this.withProfiles(version);
  }

  async updateVersion(id: string, input: UpdateLanguageVersionInput) {
    const version = this.requireVersion(id, true);
    if (input.isDefault)
      this.versions
        .filter((item) => item.languageId === version.languageId && item.id !== id)
        .forEach((item) => (item.isDefault = false));
    Object.assign(version, input, { updatedAt: new Date() });
    this.addDefaultProfiles(version);
    return this.withProfiles(version);
  }

  async deactivateVersion(id: string): Promise<void> {
    const version = this.requireVersion(id, true);
    version.isActive = false;
    version.updatedAt = new Date();
  }

  async findExecutionProfile(languageVersionId: string, executorType: ExecutorType): Promise<ExecutionProfile | null> {
    return (
      this.profiles.find(
        (profile) =>
          profile.languageVersionId === languageVersionId && profile.executorType === executorType && profile.isActive
      ) ?? null
    );
  }

  async upsertExecutionProfile(input: UpsertExecutionProfileInput): Promise<ExecutionProfile> {
    let profile = this.profiles.find(
      (item) => item.languageVersionId === input.languageVersionId && item.executorType === input.executorType
    );
    const now = new Date();
    if (!profile) {
      profile = {
        id: uuid(),
        languageVersionId: input.languageVersionId,
        executorType: input.executorType,
        judge0Id: input.judge0Id ?? null,
        dockerImage: input.dockerImage ?? null,
        compileCommand: input.compileCommand ?? null,
        runCommand: input.runCommand ?? null,
        environment: input.environment ?? null,
        limits: input.limits ?? null,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now
      };
      this.profiles.push(profile);
      return profile;
    }
    Object.assign(profile, input, { updatedAt: now });
    return profile;
  }

  async listProblemLanguageOptions(problemId: string, includeInactive = false): Promise<ProblemLanguageOption[]> {
    const rows = this.problemLanguages.filter((row) => row.problemId === problemId);
    const rowByLanguage = new Map(rows.map((row) => [row.languageId, row]));
    const starters = this.starterCodes.filter((starter) => starter.problemId === problemId);
    const languages = await this.listLanguages(includeInactive);
    const options: ProblemLanguageOption[] = [];
    for (const language of languages) {
      const row = rowByLanguage.get(language.id);
      if (!includeInactive && (!language.isActive || row?.isEnabled === false)) continue;
      const versions = row?.languageVersionId
        ? language.versions.filter((item) => item.id === row.languageVersionId)
        : language.versions;
      for (const version of versions) {
        if (!includeInactive && !version.isActive) continue;
        const exactStarter = starters.find(
          (starter) => starter.languageId === language.id && starter.languageVersionId === version.id
        );
        const languageStarter = starters.find(
          (starter) => starter.languageId === language.id && !starter.languageVersionId
        );
        options.push({
          language,
          version,
          executionProfile: version.executionProfiles?.[0] ?? null,
          isEnabled: row?.isEnabled ?? true,
          isPinnedVersion: Boolean(row?.languageVersionId),
          starterCode: exactStarter?.code ?? languageStarter?.code ?? version.starterTemplate ?? "",
          hasProblemStarterCode: Boolean(exactStarter ?? languageStarter)
        });
      }
    }
    return options;
  }

  async upsertProblemLanguages(problemId: string, items: UpsertProblemLanguageInput[]): Promise<ProblemLanguage[]> {
    return items.map((input) => {
      let row = this.problemLanguages.find(
        (item) => item.problemId === problemId && item.languageId === input.languageId
      );
      const now = new Date();
      if (!row) {
        row = {
          id: uuid(),
          problemId,
          languageId: input.languageId,
          languageVersionId: input.languageVersionId ?? null,
          isEnabled: input.isEnabled,
          createdAt: now,
          updatedAt: now
        };
        this.problemLanguages.push(row);
        return row;
      }
      Object.assign(row, {
        languageVersionId: Object.prototype.hasOwnProperty.call(input, "languageVersionId")
          ? (input.languageVersionId ?? null)
          : row.languageVersionId,
        isEnabled: input.isEnabled,
        updatedAt: now
      });
      return row;
    });
  }

  async upsertProblemStarterCode(input: UpsertProblemStarterCodeInput): Promise<ProblemStarterCode> {
    let starter = this.starterCodes.find(
      (item) =>
        item.problemId === input.problemId &&
        item.languageId === input.languageId &&
        (item.languageVersionId ?? null) === (input.languageVersionId ?? null)
    );
    const now = new Date();
    if (!starter) {
      starter = {
        id: uuid(),
        ...input,
        languageVersionId: input.languageVersionId ?? null,
        createdAt: now,
        updatedAt: now
      };
      this.starterCodes.push(starter);
      return starter;
    }
    starter.code = input.code;
    starter.updatedAt = now;
    return starter;
  }

  async updateProblemStarterCode(id: string, input: { code: string }): Promise<ProblemStarterCode> {
    const starter = this.starterCodes.find((item) => item.id === id);
    if (!starter) throw ApiError.notFound("Starter code not found");
    starter.code = input.code;
    starter.updatedAt = new Date();
    return starter;
  }

  private seed(): void {
    for (const input of languageCatalog) {
      const now = new Date();
      const language: CodeLanguage = {
        id: uuid(),
        key: input.key,
        displayName: input.displayName,
        monacoId: input.monacoId,
        fileExtension: input.fileExtension,
        category: input.category,
        isActive: true,
        isCompiled: input.isCompiled,
        sortOrder: input.sortOrder,
        createdAt: now,
        updatedAt: now
      };
      this.languages.push(language);
      for (const versionInput of input.versions) {
        const version: CodeLanguageVersion = {
          id: uuid(),
          languageId: language.id,
          version: versionInput.version,
          label: versionInput.label,
          judge0Id: versionInput.judge0Id ?? null,
          dockerImage: versionInput.dockerImage ?? null,
          compileCommand: versionInput.compileCommand ?? null,
          runCommand: versionInput.runCommand ?? null,
          timeLimitMultiplier: versionInput.timeLimitMultiplier ?? 1,
          memoryLimitMultiplier: versionInput.memoryLimitMultiplier ?? 1,
          sourceFileName: versionInput.sourceFileName,
          executableFileName: versionInput.executableFileName ?? null,
          starterTemplate: versionInput.starterTemplate,
          isDefault: versionInput.isDefault ?? false,
          isActive: versionInput.isActive ?? true,
          createdAt: now,
          updatedAt: now
        };
        this.versions.push(version);
        this.addDefaultProfiles(version);
      }
    }
  }

  private addDefaultProfiles(version: CodeLanguageVersion): void {
    const existingMock = this.profiles.find(
      (profile) => profile.languageVersionId === version.id && profile.executorType === "MOCK"
    );
    if (!existingMock) {
      this.profiles.push({
        id: uuid(),
        languageVersionId: version.id,
        executorType: "MOCK",
        judge0Id: null,
        dockerImage: null,
        compileCommand: null,
        runCommand: null,
        environment: null,
        limits: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    if (version.judge0Id) {
      void this.upsertExecutionProfile({
        languageVersionId: version.id,
        executorType: "JUDGE0",
        judge0Id: version.judge0Id
      });
    }
    if (version.dockerImage && (version.runCommand || version.compileCommand)) {
      void this.upsertExecutionProfile({
        languageVersionId: version.id,
        executorType: "DOCKER",
        dockerImage: version.dockerImage,
        compileCommand: version.compileCommand,
        runCommand: version.runCommand
      });
    }
  }

  private withVersions(language: CodeLanguage, includeInactive = false): LanguageWithVersions {
    return {
      ...language,
      versions: this.versionsFor(language.id, includeInactive)
    };
  }

  private versionsFor(languageId: string, includeInactive = false) {
    return this.versions
      .filter((version) => version.languageId === languageId && (includeInactive || version.isActive))
      .map((version) => this.withProfiles(version));
  }

  private withProfiles(version: CodeLanguageVersion): CodeLanguageVersion & { executionProfiles: ExecutionProfile[] } {
    return {
      ...version,
      executionProfiles: this.profiles.filter((profile) => profile.languageVersionId === version.id)
    };
  }

  private requireLanguage(id: string, includeInactive = false): CodeLanguage {
    let language: CodeLanguage | undefined = undefined;
    for (let i = 0; i < this.languages.length; i++) {
      const item = this.languages[i];
      if (item.id === id && (includeInactive || item.isActive)) {
        language = item;
        break;
      }
    }
    if (!language) {
      throw ApiError.notFound("Language not found");
    }
    return language;
  }

  private requireVersion(id: string, includeInactive = false): CodeLanguageVersion {
    let version: CodeLanguageVersion | undefined = undefined;
    for (let i = 0; i < this.versions.length; i++) {
      const item = this.versions[i];
      if (item.id === id && (includeInactive || item.isActive)) {
        version = item;
        break;
      }
    }
    if (!version) {
      throw ApiError.notFound("Language version not found");
    }
    return version;
  }
}

export class PrismaLanguageRepository implements LanguageRepository {
  constructor(private readonly prisma = new PrismaClient()) {}

  async listLanguages(includeInactive = false): Promise<LanguageWithVersions[]> {
    const languages = await this.prisma.language.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        versions: { include: { executionProfiles: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }
      },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }]
    });
    return languages.map((language) => this.mapLanguage(language, includeInactive));
  }

  async findLanguageById(id: string, includeInactive = false): Promise<LanguageWithVersions | null> {
    const language = await this.prisma.language.findFirst({
      where: { id, ...(includeInactive ? {} : { isActive: true }) },
      include: { versions: { include: { executionProfiles: true } } }
    });
    return language ? this.mapLanguage(language, includeInactive) : null;
  }

  async findLanguageByKey(key: string, includeInactive = false): Promise<LanguageWithVersions | null> {
    const language = await this.prisma.language.findFirst({
      where: { key: key.toLowerCase(), ...(includeInactive ? {} : { isActive: true }) },
      include: { versions: { include: { executionProfiles: true } } }
    });
    return language ? this.mapLanguage(language, includeInactive) : null;
  }

  async createLanguage(input: CreateLanguageInput): Promise<LanguageWithVersions> {
    const language = await this.prisma.language.create({
      data: {
        key: input.key.toLowerCase(),
        displayName: input.displayName,
        monacoId: input.monacoId,
        fileExtension: input.fileExtension,
        category: input.category,
        isActive: input.isActive ?? true,
        isCompiled: input.isCompiled ?? false,
        sortOrder: input.sortOrder ?? 0
      },
      include: { versions: { include: { executionProfiles: true } } }
    });
    return this.mapLanguage(language, true);
  }

  async updateLanguage(id: string, input: UpdateLanguageInput): Promise<LanguageWithVersions> {
    const language = await this.prisma.language.update({
      where: { id },
      data: {
        ...input,
        key: input.key?.toLowerCase()
      },
      include: { versions: { include: { executionProfiles: true } } }
    });
    return this.mapLanguage(language, true);
  }

  async deactivateLanguage(id: string): Promise<void> {
    await this.prisma.language.update({ where: { id }, data: { isActive: false } });
  }

  async listVersions(languageId: string, includeInactive = false) {
    const versions = await this.prisma.languageVersion.findMany({
      where: { languageId, ...(includeInactive ? {} : { isActive: true }) },
      include: { executionProfiles: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
    return versions.map((version) => this.mapVersion(version));
  }

  async findVersionById(id: string, includeInactive = false) {
    const version = await this.prisma.languageVersion.findFirst({
      where: { id, ...(includeInactive ? {} : { isActive: true }) },
      include: { executionProfiles: true }
    });
    return version ? this.mapVersion(version) : null;
  }

  async findDefaultVersion(languageId: string) {
    const version =
      (await this.prisma.languageVersion.findFirst({
        where: { languageId, isDefault: true, isActive: true },
        include: { executionProfiles: true }
      })) ??
      (await this.prisma.languageVersion.findFirst({
        where: { languageId, isActive: true },
        include: { executionProfiles: true }
      }));
    return version ? this.mapVersion(version) : null;
  }

  async findVersionByLanguageKey(key: string, version?: string) {
    const language = await this.findLanguageByKey(key);
    if (!language) return null;
    const selected =
      (version
        ? language.versions.find(
            (item) =>
              item.id === version ||
              item.version.toLowerCase() === version.toLowerCase() ||
              item.label.toLowerCase() === version.toLowerCase()
          )
        : language.versions.find((item) => item.isDefault)) ?? language.versions[0];
    return selected ? { ...selected, language } : null;
  }

  async createVersion(input: CreateLanguageVersionInput) {
    if (input.isDefault)
      await this.prisma.languageVersion.updateMany({
        where: { languageId: input.languageId },
        data: { isDefault: false }
      });
    const version = await this.prisma.languageVersion.create({
      data: {
        ...input,
        timeLimitMultiplier: input.timeLimitMultiplier ?? 1,
        memoryLimitMultiplier: input.memoryLimitMultiplier ?? 1,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false
      },
      include: { executionProfiles: true }
    });
    await this.ensureProfiles(this.mapVersion(version));
    return (await this.findVersionById(version.id, true))!;
  }

  async updateVersion(id: string, input: UpdateLanguageVersionInput) {
    const existing = await this.findVersionById(id, true);
    if (!existing) throw ApiError.notFound("Language version not found");
    if (input.isDefault)
      await this.prisma.languageVersion.updateMany({
        where: { languageId: existing.languageId, id: { not: id } },
        data: { isDefault: false }
      });
    const version = await this.prisma.languageVersion.update({
      where: { id },
      data: input,
      include: { executionProfiles: true }
    });
    await this.ensureProfiles(this.mapVersion(version));
    return (await this.findVersionById(id, true))!;
  }

  async deactivateVersion(id: string): Promise<void> {
    await this.prisma.languageVersion.update({ where: { id }, data: { isActive: false } });
  }

  async findExecutionProfile(languageVersionId: string, executorType: ExecutorType): Promise<ExecutionProfile | null> {
    const profile = await this.prisma.executionProfile.findFirst({
      where: { languageVersionId, executorType, isActive: true }
    });
    return profile ? this.mapProfile(profile) : null;
  }

  async upsertExecutionProfile(input: UpsertExecutionProfileInput): Promise<ExecutionProfile> {
    const profile = await this.prisma.executionProfile.upsert({
      where: {
        languageVersionId_executorType: { languageVersionId: input.languageVersionId, executorType: input.executorType }
      },
      update: {
        judge0Id: input.judge0Id,
        dockerImage: input.dockerImage,
        compileCommand: input.compileCommand,
        runCommand: input.runCommand,
        environment: toJsonInput(input.environment),
        limits: toJsonInput(input.limits),
        isActive: input.isActive
      },
      create: {
        languageVersionId: input.languageVersionId,
        executorType: input.executorType,
        judge0Id: input.judge0Id,
        dockerImage: input.dockerImage,
        compileCommand: input.compileCommand,
        runCommand: input.runCommand,
        environment: toJsonInput(input.environment),
        limits: toJsonInput(input.limits),
        isActive: input.isActive ?? true
      }
    });
    return this.mapProfile(profile);
  }

  async listProblemLanguageOptions(problemId: string, includeInactive = false): Promise<ProblemLanguageOption[]> {
    const [languages, rows, starters] = await Promise.all([
      this.listLanguages(includeInactive),
      this.prisma.problemLanguage.findMany({ where: { problemId } }),
      this.prisma.problemStarterCode.findMany({ where: { problemId } })
    ]);
    const rowByLanguage = new Map(rows.map((row) => [row.languageId, row]));
    return languages.flatMap((language) => {
      const row = rowByLanguage.get(language.id);
      if (!includeInactive && (!language.isActive || row?.isEnabled === false)) return [];
      const versions = row?.languageVersionId
        ? language.versions.filter((item) => item.id === row.languageVersionId)
        : language.versions;
      return versions.flatMap((version) => {
        if (!includeInactive && !version.isActive) return [];
        const exactStarter = starters.find(
          (starter) => starter.languageId === language.id && starter.languageVersionId === version.id
        );
        const languageStarter = starters.find(
          (starter) => starter.languageId === language.id && !starter.languageVersionId
        );
        return [
          {
            language,
            version,
            executionProfile: version.executionProfiles?.[0] ?? null,
            isEnabled: row?.isEnabled ?? true,
            isPinnedVersion: Boolean(row?.languageVersionId),
            starterCode: exactStarter?.code ?? languageStarter?.code ?? version.starterTemplate ?? "",
            hasProblemStarterCode: Boolean(exactStarter ?? languageStarter)
          }
        ];
      });
    });
  }

  async upsertProblemLanguages(problemId: string, items: UpsertProblemLanguageInput[]): Promise<ProblemLanguage[]> {
    return Promise.all(
      items.map(
        (item) =>
          this.prisma.problemLanguage.upsert({
            where: { problemId_languageId: { problemId, languageId: item.languageId } },
            update: { languageVersionId: item.languageVersionId, isEnabled: item.isEnabled },
            create: {
              problemId,
              languageId: item.languageId,
              languageVersionId: item.languageVersionId,
              isEnabled: item.isEnabled
            }
          }) as Promise<ProblemLanguage>
      )
    );
  }

  async upsertProblemStarterCode(input: UpsertProblemStarterCodeInput): Promise<ProblemStarterCode> {
    const existing = await this.prisma.problemStarterCode.findFirst({
      where: {
        problemId: input.problemId,
        languageId: input.languageId,
        languageVersionId: input.languageVersionId ?? null
      }
    });
    if (existing) {
      return this.prisma.problemStarterCode.update({
        where: { id: existing.id },
        data: { code: input.code }
      }) as Promise<ProblemStarterCode>;
    }
    return this.prisma.problemStarterCode.create({
      data: { ...input, languageVersionId: input.languageVersionId ?? null }
    }) as Promise<ProblemStarterCode>;
  }

  async updateProblemStarterCode(id: string, input: { code: string }): Promise<ProblemStarterCode> {
    return this.prisma.problemStarterCode.update({ where: { id }, data: input }) as Promise<ProblemStarterCode>;
  }

  private async ensureProfiles(version: CodeLanguageVersion): Promise<void> {
    await this.upsertExecutionProfile({ languageVersionId: version.id, executorType: "MOCK" });
    if (version.judge0Id)
      await this.upsertExecutionProfile({
        languageVersionId: version.id,
        executorType: "JUDGE0",
        judge0Id: version.judge0Id
      });
    if (version.dockerImage && (version.compileCommand || version.runCommand)) {
      await this.upsertExecutionProfile({
        languageVersionId: version.id,
        executorType: "DOCKER",
        dockerImage: version.dockerImage,
        compileCommand: version.compileCommand,
        runCommand: version.runCommand
      });
    }
  }

  private mapLanguage(language: PrismaLanguageRow, includeInactive: boolean): LanguageWithVersions {
    return {
      id: language.id,
      key: language.key,
      displayName: language.displayName,
      monacoId: language.monacoId,
      fileExtension: language.fileExtension,
      category: language.category as LanguageCategory,
      isActive: language.isActive,
      isCompiled: language.isCompiled,
      sortOrder: language.sortOrder,
      createdAt: language.createdAt,
      updatedAt: language.updatedAt,
      versions: (language.versions ?? [])
        .filter((version) => includeInactive || version.isActive)
        .map((version) => this.mapVersion(version))
    };
  }

  private mapVersion(version: PrismaVersionRow): CodeLanguageVersion & { executionProfiles?: ExecutionProfile[] } {
    return {
      id: version.id,
      languageId: version.languageId,
      version: version.version,
      label: version.label,
      judge0Id: version.judge0Id,
      dockerImage: version.dockerImage,
      compileCommand: version.compileCommand,
      runCommand: version.runCommand,
      timeLimitMultiplier: version.timeLimitMultiplier,
      memoryLimitMultiplier: version.memoryLimitMultiplier,
      sourceFileName: version.sourceFileName,
      executableFileName: version.executableFileName,
      starterTemplate: version.starterTemplate,
      isDefault: version.isDefault,
      isActive: version.isActive,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      executionProfiles: (version.executionProfiles ?? []).map((profile) => this.mapProfile(profile))
    };
  }

  private mapProfile(profile: PrismaProfileRow): ExecutionProfile {
    return {
      id: profile.id,
      languageVersionId: profile.languageVersionId,
      executorType: profile.executorType as ExecutorType,
      judge0Id: profile.judge0Id,
      dockerImage: profile.dockerImage,
      compileCommand: profile.compileCommand,
      runCommand: profile.runCommand,
      environment: asRecord(profile.environment),
      limits: asRecord(profile.limits),
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
  }
}

/** Structural Prisma row shapes — avoids `any` while accepting generated client payloads. */
interface PrismaLanguageRow {
  id: string;
  key: string;
  displayName: string;
  monacoId: string;
  fileExtension: string;
  category: string;
  isActive: boolean;
  isCompiled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  versions?: PrismaVersionRow[];
}

interface PrismaVersionRow {
  id: string;
  languageId: string;
  version: string;
  label: string;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  timeLimitMultiplier: number;
  memoryLimitMultiplier: number;
  sourceFileName: string;
  executableFileName?: string | null;
  starterTemplate?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  executionProfiles?: PrismaProfileRow[];
}

interface PrismaProfileRow {
  id: string;
  languageVersionId: string;
  executorType: string;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  environment?: unknown;
  limits?: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toJsonInput(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
