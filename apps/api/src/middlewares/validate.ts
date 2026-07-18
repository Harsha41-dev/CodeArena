import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";
import { ApiError } from "../errors/ApiError";

// zod validation middleware — parses body/query/params together
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => {
        return {
          path: issue.path.join("."),
          message: issue.message
        };
      });

      next(
        ApiError.badRequest("Validation failed", {
          issues
        })
      );
      return;
    }

    // write back the parsed values (zod may coerce types)
    if (parsed.data.body !== undefined) {
      req.body = parsed.data.body;
    }
    if (parsed.data.query !== undefined) {
      req.query = parsed.data.query;
    }
    if (parsed.data.params !== undefined) {
      req.params = parsed.data.params;
    }

    next();
  };
}
