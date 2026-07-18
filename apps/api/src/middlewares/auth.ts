import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../errors/ApiError";

interface AccessTokenPayload {
  sub: string;
  role: "USER" | "ADMIN";
  email: string;
  username: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header) {
    next(ApiError.unauthorized());
    return;
  }

  // expect "Bearer <token>"
  let token: string | undefined;
  if (header.startsWith("Bearer ")) {
    token = header.slice(7);
  }

  if (!token) {
    next(ApiError.unauthorized());
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (!isAccessTokenPayload(decoded)) {
      next(ApiError.unauthorized("Invalid access token payload"));
      return;
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
      username: decoded.username
    };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}

// for routes that work with or without login (e.g. problem list + solved badges)
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice(7);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (isAccessTokenPayload(decoded)) {
      req.user = {
        id: decoded.sub,
        role: decoded.role,
        email: decoded.email,
        username: decoded.username
      };
    }
  } catch {
    // bad/expired token — just treat as guest
    req.user = undefined;
  }

  next();
}

function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Partial<AccessTokenPayload>;

  if (typeof p.sub !== "string") return false;
  if (typeof p.email !== "string") return false;
  if (typeof p.username !== "string") return false;
  if (p.role !== "USER" && p.role !== "ADMIN") return false;

  return true;
}
