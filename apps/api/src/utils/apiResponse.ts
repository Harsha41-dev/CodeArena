import type { Response } from "express";

// helper so every success response looks the same
export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T,
  meta?: Record<string, unknown>,
  statusCode = 200
): void {
  const body: {
    success: boolean;
    message: string;
    data: T;
    meta: Record<string, unknown>;
  } = {
    success: true,
    message,
    data,
    meta: {}
  };

  if (meta) {
    body.meta = meta;
  }

  res.status(statusCode).json(body);
}
