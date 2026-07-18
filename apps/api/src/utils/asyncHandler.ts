import type { NextFunction, Request, Response } from "express";

// wraps async route handlers so rejected promises go to errorHandler
export type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(route: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(route(req, res, next)).catch((err) => {
      next(err);
    });
  };
}
