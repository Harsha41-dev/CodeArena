import { Router } from "express";
import type { AppContext } from "../appContext";
import { SocialController } from "../controllers/SocialController";
import { authenticate, optionalAuthenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { problemSlugSchema } from "../validators/problemValidators";
import {
  createCommentSchema,
  createDiscussionSchema,
  createGeneralDiscussionSchema,
  discussionIdSchema,
  editorialBySlugSchema,
  editorialIdSchema,
  listGeneralDiscussionsSchema,
  noteBySlugSchema,
  updateCommentSchema,
  updateDiscussionSchema,
  updateEditorialSchema,
  updateNoteSchema,
  upsertEditorialSchema,
  upsertNoteSchema,
  voteDiscussionSchema
} from "../validators/socialValidators";

export function createSocialRoutes(context: AppContext): Router {
  const router = Router();
  const social = new SocialController(context.services.social);

  router.get(
    "/problems/:slug/editorial",
    optionalAuthenticate,
    validate(editorialBySlugSchema),
    asyncHandler(social.editorial)
  );
  router.get("/problems/:slug/discussions", validate(problemSlugSchema), asyncHandler(social.discussions));
  router.post(
    "/problems/:slug/discussions",
    authenticate,
    validate(createDiscussionSchema),
    asyncHandler(social.createDiscussion)
  );

  router.get("/discussions", validate(listGeneralDiscussionsSchema), asyncHandler(social.listGeneralDiscussions));
  router.post(
    "/discussions",
    authenticate,
    validate(createGeneralDiscussionSchema),
    asyncHandler(social.createGeneralDiscussion)
  );
  router.get("/discussions/:id", validate(discussionIdSchema), asyncHandler(social.getDiscussion));
  router.post(
    "/discussions/:id/comments",
    authenticate,
    validate(createCommentSchema),
    asyncHandler(social.addComment)
  );
  router.patch(
    "/discussions/:id",
    authenticate,
    validate(updateDiscussionSchema),
    asyncHandler(social.updateDiscussion)
  );
  router.delete("/discussions/:id", authenticate, validate(discussionIdSchema), asyncHandler(social.deleteDiscussion));
  router.patch(
    "/discussion-comments/:id",
    authenticate,
    validate(updateCommentSchema),
    asyncHandler(social.updateComment)
  );
  router.delete(
    "/discussion-comments/:id",
    authenticate,
    validate(discussionIdSchema),
    asyncHandler(social.deleteComment)
  );
  router.post(
    "/discussions/:id/vote",
    authenticate,
    validate(voteDiscussionSchema),
    asyncHandler(social.voteDiscussion)
  );

  router.post(
    "/admin/problems/:problemId/editorial",
    authenticate,
    requireRole("ADMIN"),
    validate(upsertEditorialSchema),
    asyncHandler(social.upsertEditorial)
  );
  router.patch(
    "/admin/editorials/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(updateEditorialSchema),
    asyncHandler(social.updateEditorial)
  );
  router.delete(
    "/admin/editorials/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(editorialIdSchema),
    asyncHandler(social.deleteEditorial)
  );
  router.patch(
    "/admin/editorials/:id/publish",
    authenticate,
    requireRole("ADMIN"),
    validate(editorialIdSchema),
    asyncHandler(social.publishEditorial)
  );
  router.patch(
    "/admin/editorials/:id/unpublish",
    authenticate,
    requireRole("ADMIN"),
    validate(editorialIdSchema),
    asyncHandler(social.unpublishEditorial)
  );

  router.post("/problems/:slug/bookmark", authenticate, validate(problemSlugSchema), asyncHandler(social.addBookmark));
  router.delete(
    "/problems/:slug/bookmark",
    authenticate,
    validate(problemSlugSchema),
    asyncHandler(social.removeBookmark)
  );
  router.get("/bookmarks", authenticate, asyncHandler(social.bookmarks));

  router.get("/problems/:slug/notes", authenticate, validate(noteBySlugSchema), asyncHandler(social.getNote));
  router.post("/problems/:slug/notes", authenticate, validate(upsertNoteSchema), asyncHandler(social.upsertNote));
  router.patch("/notes/:id", authenticate, validate(updateNoteSchema), asyncHandler(social.updateNote));
  router.delete("/notes/:id", authenticate, validate(discussionIdSchema), asyncHandler(social.deleteNote));

  return router;
}
