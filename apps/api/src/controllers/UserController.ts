import type { Request, Response } from "express";
import type { UserService } from "../services/UserService";
import { sendSuccess } from "../utils/apiResponse";
import { getPagination } from "../utils/pagination";

export class UserController {
  constructor(private readonly userService: UserService) {}

  me = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const profile = await this.userService.getMe(userId);
    sendSuccess(res, "Profile", profile);
  };

  updateMe = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const updated = await this.userService.updateMe(userId, req.body);
    sendSuccess(res, "Profile updated", updated);
  };

  byUsername = async (req: Request, res: Response): Promise<void> => {
    const username = req.params.username;
    const profile = await this.userService.getByUsername(username);
    sendSuccess(res, "User profile", profile);
  };

  stats = async (req: Request, res: Response): Promise<void> => {
    const username = req.params.username;
    const stats = await this.userService.getStats(username);
    sendSuccess(res, "User stats", stats);
  };

  adminList = async (req: Request, res: Response): Promise<void> => {
    const pagination = getPagination(req.query);

    let search: string | undefined;
    if (typeof req.query.search === "string") {
      search = req.query.search;
    }

    const page = await this.userService.adminList({
      ...pagination,
      search,
      role: req.query.role as "USER" | "ADMIN" | undefined,
      status: req.query.status as "ACTIVE" | "INACTIVE" | "DELETED" | undefined
    });

    sendSuccess(res, "Admin users", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  adminGet = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const user = await this.userService.adminGet(id);
    sendSuccess(res, "Admin user", user);
  };

  adminUpdate = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const updated = await this.userService.adminUpdate(id, req.body);
    sendSuccess(res, "User updated", updated);
  };

  adminUpdateRole = async (req: Request, res: Response): Promise<void> => {
    const actorId = req.user!.id;
    const targetId = req.params.id;
    const role = req.body.role;
    const updated = await this.userService.adminUpdateRole(actorId, targetId, role);
    sendSuccess(res, "User role updated", updated);
  };

  adminUpdateStatus = async (req: Request, res: Response): Promise<void> => {
    const actorId = req.user!.id;
    const targetId = req.params.id;
    const status = req.body.status;
    const updated = await this.userService.adminUpdateStatus(actorId, targetId, status);
    sendSuccess(res, "User status updated", updated);
  };

  adminDelete = async (req: Request, res: Response): Promise<void> => {
    const actorId = req.user!.id;
    const targetId = req.params.id;
    await this.userService.adminDelete(actorId, targetId);
    sendSuccess(res, "User deleted", {});
  };
}
