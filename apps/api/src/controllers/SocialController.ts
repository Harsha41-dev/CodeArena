import type { Request, Response } from "express";
import type { SocialService } from "../services/SocialService";
import { sendSuccess } from "../utils/apiResponse";

export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  editorial = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;

    // admins can ask for drafts with ?includeDraft=true
    let includeDraft = false;
    if (req.user && req.user.role === "ADMIN" && req.query.includeDraft === "true") {
      includeDraft = true;
    }

    const editorial = await this.socialService.editorial(slug, includeDraft);
    sendSuccess(res, "Editorial", editorial);
  };

  upsertEditorial = async (req: Request, res: Response): Promise<void> => {
    const problemId = req.params.problemId;
    const authorId = req.user!.id;
    const editorial = await this.socialService.upsertEditorial(problemId, authorId, req.body);
    sendSuccess(res, "Editorial saved", editorial, undefined, 201);
  };

  updateEditorial = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const editorial = await this.socialService.updateEditorial(id, req.body);
    sendSuccess(res, "Editorial updated", editorial);
  };

  deleteEditorial = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    await this.socialService.deleteEditorial(id);
    sendSuccess(res, "Editorial deleted", {});
  };

  publishEditorial = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const editorial = await this.socialService.publishEditorial(id);
    sendSuccess(res, "Editorial published", editorial);
  };

  unpublishEditorial = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const editorial = await this.socialService.unpublishEditorial(id);
    sendSuccess(res, "Editorial unpublished", editorial);
  };

  discussions = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;
    const items = await this.socialService.discussions(slug);
    sendSuccess(res, "Discussions", items);
  };

  createDiscussion = async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug;
    const authorId = req.user!.id;
    const discussion = await this.socialService.createDiscussion(slug, authorId, req.body);
    sendSuccess(res, "Discussion created", discussion, undefined, 201);
  };

  listGeneralDiscussions = async (req: Request, res: Response): Promise<void> => {
    let search: string | undefined = undefined;
    if (typeof req.query.search === "string") {
      search = req.query.search;
    }

    const page = await this.socialService.listGeneralDiscussions({
      page: req.query.page,
      limit: req.query.limit,
      search
    });

    sendSuccess(res, "Discussions", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  createGeneralDiscussion = async (req: Request, res: Response): Promise<void> => {
    const authorId = req.user!.id;
    const discussion = await this.socialService.createGeneralDiscussion(authorId, req.body);
    sendSuccess(res, "Discussion created", discussion, undefined, 201);
  };

  getDiscussion = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const discussion = await this.socialService.getDiscussion(id);
    sendSuccess(res, "Discussion", discussion);
  };

  addComment = async (req: Request, res: Response): Promise<void> => {
    const discussionId = req.params.id;
    const authorId = req.user!.id;
    const content = (req.body as { content: string }).content;

    const comment = await this.socialService.addComment(discussionId, authorId, content);
    sendSuccess(res, "Comment created", comment, undefined, 201);
  };

  updateDiscussion = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const authorId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const discussion = await this.socialService.updateDiscussion(id, authorId, isAdmin, req.body);
    sendSuccess(res, "Discussion updated", discussion);
  };

  deleteDiscussion = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const authorId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    await this.socialService.deleteDiscussion(id, authorId, isAdmin);
    sendSuccess(res, "Discussion deleted", {});
  };

  updateComment = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const authorId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const content = (req.body as { content: string }).content;

    const comment = await this.socialService.updateComment(id, authorId, isAdmin, content);
    sendSuccess(res, "Comment updated", comment);
  };

  deleteComment = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const authorId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    await this.socialService.deleteComment(id, authorId, isAdmin);
    sendSuccess(res, "Comment deleted", {});
  };

  voteDiscussion = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const userId = req.user!.id;
    const value = (req.body as { value: 1 | -1 }).value;

    const vote = await this.socialService.voteDiscussion(id, userId, value);
    sendSuccess(res, "Discussion vote recorded", vote);
  };

  bookmarks = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const list = await this.socialService.bookmarks(userId);
    sendSuccess(res, "Bookmarks", list);
  };

  addBookmark = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const slug = req.params.slug;
    const bookmark = await this.socialService.addBookmark(userId, slug);
    sendSuccess(res, "Bookmarked", bookmark, undefined, 201);
  };

  removeBookmark = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const slug = req.params.slug;
    await this.socialService.removeBookmark(userId, slug);
    sendSuccess(res, "Bookmark removed", {});
  };

  getNote = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const slug = req.params.slug;
    const note = await this.socialService.getNote(userId, slug);
    sendSuccess(res, "Note", note);
  };

  upsertNote = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const slug = req.params.slug;
    const content = (req.body as { content: string }).content;

    const note = await this.socialService.upsertNote(userId, slug, content);
    sendSuccess(res, "Note saved", note);
  };

  updateNote = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const userId = req.user!.id;
    const content = (req.body as { content: string }).content;

    const note = await this.socialService.updateNote(id, userId, content);
    sendSuccess(res, "Note updated", note);
  };

  deleteNote = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const userId = req.user!.id;
    await this.socialService.deleteNote(id, userId);
    sendSuccess(res, "Note deleted", {});
  };
}
