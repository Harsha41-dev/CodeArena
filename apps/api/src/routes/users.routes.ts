import { Router } from "express";
import type { AppContext } from "../appContext";
import { UserController } from "../controllers/UserController";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  adminListUsersSchema,
  adminUpdateUserRoleSchema,
  adminUpdateUserSchema,
  adminUpdateUserStatusSchema,
  adminUserIdSchema,
  updateMeSchema,
  usernameParamSchema
} from "../validators/userValidators";

export function createUsersRoutes(context: AppContext): Router {
  const router = Router();
  const users = new UserController(context.services.users);

  router.get("/users/me", authenticate, asyncHandler(users.me));
  router.patch("/users/me", authenticate, validate(updateMeSchema), asyncHandler(users.updateMe));
  router.get("/users/:username", validate(usernameParamSchema), asyncHandler(users.byUsername));
  router.get("/users/:username/stats", validate(usernameParamSchema), asyncHandler(users.stats));

  router.get(
    "/admin/users",
    authenticate,
    requireRole("ADMIN"),
    validate(adminListUsersSchema),
    asyncHandler(users.adminList)
  );
  router.get(
    "/admin/users/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(adminUserIdSchema),
    asyncHandler(users.adminGet)
  );
  router.patch(
    "/admin/users/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(adminUpdateUserSchema),
    asyncHandler(users.adminUpdate)
  );
  router.delete(
    "/admin/users/:id",
    authenticate,
    requireRole("ADMIN"),
    validate(adminUserIdSchema),
    asyncHandler(users.adminDelete)
  );
  router.patch(
    "/admin/users/:id/role",
    authenticate,
    requireRole("ADMIN"),
    validate(adminUpdateUserRoleSchema),
    asyncHandler(users.adminUpdateRole)
  );
  router.patch(
    "/admin/users/:id/status",
    authenticate,
    requireRole("ADMIN"),
    validate(adminUpdateUserStatusSchema),
    asyncHandler(users.adminUpdateStatus)
  );

  return router;
}
