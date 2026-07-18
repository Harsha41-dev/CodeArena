import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";
import { getPagination } from "../utils/pagination";

// editorials, discussions, bookmarks, notes — the social bits
export class SocialService {
  constructor(private readonly repository: AppRepository) {}

  async editorial(slug: string, includeDraft = false) {
    const problem = await this.requireProblemBySlug(slug);
    const editorial = await this.repository.getEditorial(problem.id, includeDraft);
    return editorial;
  }

  async upsertEditorial(
    problemId: string,
    authorId: string,
    input: { title: string; content: string; isPublished?: boolean }
  ) {
    const problem = await this.repository.findProblemById(problemId);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }

    const saved = await this.repository.upsertEditorial({
      problemId,
      authorId,
      title: input.title,
      content: input.content,
      isPublished: input.isPublished
    });
    return saved;
  }

  async updateEditorial(id: string, input: { title?: string; content?: string }) {
    const updated = await this.repository.updateEditorial(id, input);
    return updated;
  }

  async deleteEditorial(id: string): Promise<void> {
    await this.repository.deleteEditorial(id);
  }

  async publishEditorial(id: string) {
    const published = await this.repository.setEditorialPublished(id, true);
    return published;
  }

  async unpublishEditorial(id: string) {
    const unpublished = await this.repository.setEditorialPublished(id, false);
    return unpublished;
  }

  async discussions(slug: string) {
    const problem = await this.requireProblemBySlug(slug);

    // problem page just wants the list, not full pagination meta
    const page = await this.repository.listDiscussions({
      problemId: problem.id,
      page: 1,
      limit: 50
    });
    return page.items;
  }

  async listGeneralDiscussions(input: { page?: unknown; limit?: unknown; search?: string }) {
    const pagination = getPagination(input);
    const page = await this.repository.listDiscussions({
      page: pagination.page,
      limit: pagination.limit,
      search: input.search
    });
    return page;
  }

  async getDiscussion(id: string) {
    const discussion = await this.repository.findDiscussionById(id);
    if (!discussion) {
      throw ApiError.notFound("Discussion not found");
    }
    return discussion;
  }

  async createDiscussion(slug: string, authorId: string, input: { title: string; content: string }) {
    const problem = await this.requireProblemBySlug(slug);

    const created = await this.repository.createDiscussion({
      problemId: problem.id,
      authorId,
      title: input.title,
      content: input.content,
      tags: []
    });
    return created;
  }

  async createGeneralDiscussion(authorId: string, input: { title: string; content: string; tags?: string[] }) {
    let tags: string[] = [];
    if (input.tags) {
      tags = input.tags;
    }

    const created = await this.repository.createDiscussion({
      authorId,
      title: input.title,
      content: input.content,
      tags
    });
    return created;
  }

  async addComment(discussionId: string, authorId: string, content: string) {
    const comment = await this.repository.addDiscussionComment({
      discussionId,
      authorId,
      content
    });
    return comment;
  }

  async updateDiscussion(
    id: string,
    authorId: string,
    isAdmin: boolean,
    input: { title?: string; content?: string; tags?: string[] }
  ) {
    // repo checks author/admin permissions
    const updated = await this.repository.updateDiscussion(id, authorId, isAdmin, input);
    return updated;
  }

  async deleteDiscussion(id: string, authorId: string, isAdmin: boolean): Promise<void> {
    await this.repository.deleteDiscussion(id, authorId, isAdmin);
  }

  async updateComment(id: string, authorId: string, isAdmin: boolean, content: string) {
    const updated = await this.repository.updateDiscussionComment(id, authorId, isAdmin, content);
    return updated;
  }

  async deleteComment(id: string, authorId: string, isAdmin: boolean): Promise<void> {
    await this.repository.deleteDiscussionComment(id, authorId, isAdmin);
  }

  async voteDiscussion(id: string, userId: string, value: 1 | -1) {
    const vote = await this.repository.voteDiscussion(id, userId, value);
    return vote;
  }

  async bookmarks(userId: string) {
    const list = await this.repository.listBookmarks(userId);
    return list;
  }

  async addBookmark(userId: string, slug: string) {
    const problem = await this.requireProblemBySlug(slug);
    const bookmark = await this.repository.addBookmark(userId, problem.id);
    return bookmark;
  }

  async removeBookmark(userId: string, slug: string): Promise<void> {
    const problem = await this.requireProblemBySlug(slug);
    await this.repository.removeBookmark(userId, problem.id);
  }

  async getNote(userId: string, slug: string) {
    const problem = await this.requireProblemBySlug(slug);
    const note = await this.repository.getNote(userId, problem.id);
    return note;
  }

  async upsertNote(userId: string, slug: string, content: string) {
    const problem = await this.requireProblemBySlug(slug);
    const note = await this.repository.upsertNote(userId, problem.id, content);
    return note;
  }

  async updateNote(id: string, userId: string, content: string) {
    const note = await this.repository.updateNote(id, userId, content);
    return note;
  }

  async deleteNote(id: string, userId: string): Promise<void> {
    await this.repository.deleteNote(id, userId);
  }

  // slug lookups always need a public problem
  private async requireProblemBySlug(slug: string) {
    const problem = await this.repository.findProblemBySlug(slug);
    if (!problem) {
      throw ApiError.notFound("Problem not found");
    }
    if (problem.visibility !== "PUBLIC") {
      throw ApiError.notFound("Problem not found");
    }
    return problem;
  }
}
