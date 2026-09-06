import { ApiError } from "../errors/ApiError";
import type { AppRepository, DiscussionSort, EditorialStructureInput } from "../repositories/AppRepository";
import { getPagination } from "../utils/pagination";

// editorials, discussions, bookmarks, notes - the social bits
export class SocialService {
  constructor(private readonly repository: AppRepository) {}

  async editorial(
    slug: string,
    input: { includeDraft?: boolean; userId?: string; isAdmin?: boolean } = {}
  ) {
    const problem = await this.requireProblemBySlug(slug);

    if (!input.includeDraft && !input.isAdmin) {
      if (!input.userId) {
        return null;
      }
      const status = await this.repository.getProblemSolvedStatus(input.userId, problem.id);
      if (!status?.attempted) {
        return null;
      }
    }

    const editorial = await this.repository.getEditorial(problem.id, input.includeDraft ?? false);
    return editorial;
  }

  async upsertEditorial(
    problemId: string,
    authorId: string,
    input: { title: string; content: string; isPublished?: boolean; structure?: EditorialStructureInput }
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
      isPublished: input.isPublished,
      structure: input.structure
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

  async discussions(slug: string, sort?: DiscussionSort) {
    const problem = await this.requireProblemBySlug(slug);

    // problem page just wants the list, not full pagination meta
    const page = await this.repository.listDiscussions({
      problemId: problem.id,
      page: 1,
      limit: 50,
      sort
    });
    return page.items;
  }

  async contestDiscussions(contestId: string, sort?: DiscussionSort) {
    await this.requireContestById(contestId);

    const page = await this.repository.listDiscussions({
      contestId,
      page: 1,
      limit: 50,
      sort
    });
    return page.items;
  }

  async listGeneralDiscussions(input: { page?: unknown; limit?: unknown; search?: string; sort?: DiscussionSort }) {
    const pagination = getPagination(input);
    const page = await this.repository.listDiscussions({
      page: pagination.page,
      limit: pagination.limit,
      search: input.search,
      sort: input.sort
    });
    return page;
  }

  async getDiscussion(id: string, viewerId?: string) {
    const discussion = await this.repository.findDiscussionById(id);
    if (!discussion) {
      throw ApiError.notFound("Discussion not found");
    }
    if (viewerId) {
      const comments = await Promise.all(
        discussion.comments.map(async (comment) => ({
          ...comment,
          isHelpfulByMe: await this.repository.hasDiscussionCommentHelpfulVote(comment.id, viewerId)
        }))
      );
      return { ...discussion, comments };
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
    await this.notifyMentions(input.content, authorId, `/problems/${problem.slug}?tab=discuss`);
    return created;
  }

  async createContestDiscussion(contestId: string, authorId: string, input: { title: string; content: string }) {
    await this.requireContestById(contestId);

    const created = await this.repository.createDiscussion({
      contestId,
      authorId,
      title: input.title,
      content: input.content,
      tags: ["clarification"]
    });
    await this.notifyMentions(input.content, authorId, `/contests/${contestId}?tab=discuss`);
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
    await this.notifyMentions(input.content, authorId, `/discuss/${created.id}`);
    return created;
  }

  async addComment(discussionId: string, authorId: string, content: string) {
    const discussion = await this.repository.findDiscussionById(discussionId);
    if (!discussion) {
      throw ApiError.notFound("Discussion not found");
    }
    const comment = await this.repository.addDiscussionComment({
      discussionId,
      authorId,
      content
    });
    if (discussion.authorId !== authorId) {
      await this.repository.createNotification({
        userId: discussion.authorId,
        actorId: authorId,
        type: "DISCUSSION_REPLY",
        title: "New discussion reply",
        body: `Someone replied to ${discussion.title}.`,
        link: `/discuss/${discussionId}`
      });
    }
    await this.notifyMentions(content, authorId, `/discuss/${discussionId}`);
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

  async markCommentHelpful(commentId: string, userId: string) {
    const comment = await this.repository.findDiscussionCommentById(commentId);
    if (!comment) {
      throw ApiError.notFound("Discussion comment not found");
    }
    if (comment.authorId === userId) {
      throw ApiError.badRequest("You cannot mark your own answer helpful");
    }
    return this.repository.voteDiscussionCommentHelpful(commentId, userId);
  }

  async unmarkCommentHelpful(commentId: string, userId: string): Promise<void> {
    const comment = await this.repository.findDiscussionCommentById(commentId);
    if (!comment) {
      throw ApiError.notFound("Discussion comment not found");
    }
    await this.repository.unvoteDiscussionCommentHelpful(commentId, userId);
  }

  async acceptAnswer(discussionId: string, commentId: string, actorId: string) {
    return this.repository.acceptDiscussionAnswer(discussionId, commentId, actorId);
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

  private async requireContestById(contestId: string) {
    const contest = await this.repository.findContestById(contestId);
    if (!contest) {
      throw ApiError.notFound("Contest not found");
    }
    if (contest.visibility !== "PUBLIC") {
      throw ApiError.notFound("Contest not found");
    }
    return contest;
  }

  private async notifyMentions(content: string, actorId: string, link: string): Promise<void> {
    const matches = [...content.matchAll(/@([a-zA-Z0-9_-]{2,40})/g)];
    const usernames = [...new Set(matches.map((match) => match[1]))];
    await Promise.all(
      usernames.map(async (username) => {
        const user = await this.repository.findUserByUsername(username);
        if (!user || user.id === actorId || user.status !== "ACTIVE") return;
        await this.repository.createNotification({
          userId: user.id,
          actorId,
          type: "SYSTEM",
          title: "You were mentioned",
          body: `@${username} was mentioned in a discussion.`,
          link
        });
      })
    );
  }
}
