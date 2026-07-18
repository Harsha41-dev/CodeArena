import type { NextFunction, Request, Response } from "express";
import type { Role } from "../types/domain";
import { ApiError } from "../errors/ApiError";

// simple role check — only used for admin routes right now
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }

    if (req.user.role !== role) {
      next(ApiError.forbidden(role + " role required"));
      return;
    }

    next();
  };
}
