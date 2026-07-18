import { ApiError } from "../errors/ApiError";
import type { AppRepository, CreateProblemInput, UpdateProblemInput } from "../repositories/AppRepository";
import type { Difficulty, ProblemStatus } from "../types/domain";
import { getPagination } from "../utils/pagination";

// problem listing, CRUD, and test case helpers for admins
export class ProblemService {
  constructor(private readonly repository: AppRepository) {}

  async list(input: {
    page?: unknown;
    limit?: unknown;
    difficulty?: Difficulty;
    tag?: string;
    status?: ProblemStatus;
    search?: string;
    userId?: string;
  }) {
    const pagination = getPagination(input);

    // just pass filters through to the repo
    const result = await this.repository.listProblems({
      page: pagination.page,
      limit: pagination.limit,
      difficulty: input.difficulty,
      tag: input.tag,
      status: input.status,
      search: input.search,
      userId: input.userId
    });

    return result;
  }

  async getBySlug(slug: string) {
    const problem = await this.repository.findProblemBySlug(slug);

    // only public problems are visible to normal users
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    if (problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }

    const sampleTestCases = await this.repository.listTestCases(problem.id, true);

    return {
      ...problem,
      sampleTestCases
    };
  }

  async create(input: CreateProblemInput) {
    // custom checker needs the checker asset first — can't enable it on create
    if (input.checkerMode === "CUSTOM_CHECKER") {
      throw ApiError.badRequest("Create the problem and checker asset before enabling custom checker mode");
    }

    const created = await this.repository.createProblem(input);
    return created;
  }

  async update(id: string, input: UpdateProblemInput) {
    await this.requireProblem(id);

    // if switching to custom checker, make sure the asset exists
    if (input.checkerMode === "CUSTOM_CHECKER") {
      const checker = await this.repository.findActiveProblemAsset(id, "CHECKER");
      if (!checker) {
        throw ApiError.badRequest("checker asset is required");
      }
    }

    const updated = await this.repository.updateProblem(id, input);
    return updated;
  }

  async archive(id: string): Promise<void> {
    await this.requireProblem(id);
    await this.repository.archiveProblem(id);
  }

  async addTestCase(problemId: string, input: Omit<Parameters<AppRepository["addTestCase"]>[0], "problemId">) {
    await this.requireProblem(problemId);

    const created = await this.repository.addTestCase({
      ...input,
      problemId
    });
    return created;
  }

  async updateTestCase(id: string, input: Parameters<AppRepository["updateTestCase"]>[1]) {
    const updated = await this.repository.updateTestCase(id, input);
    return updated;
  }

  async deleteTestCase(id: string): Promise<void> {
    await this.repository.deleteTestCase(id);
  }

  async tags() {
    const allTags = await this.repository.listTags();
    return allTags;
  }

  // helper so we don't repeat the not-found check
  private async requireProblem(id: string) {
    const problem = await this.repository.findProblemById(id);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }
}
