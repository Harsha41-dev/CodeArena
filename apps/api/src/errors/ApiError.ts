// custom error class so errorHandler can map status codes cleanly
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message?: string): ApiError {
    if (message) {
      return new ApiError(401, "UNAUTHORIZED", message);
    }
    return new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  static forbidden(message?: string): ApiError {
    if (message) {
      return new ApiError(403, "FORBIDDEN", message);
    }
    return new ApiError(403, "FORBIDDEN", "Forbidden");
  }

  static notFound(message?: string): ApiError {
    if (message) {
      return new ApiError(404, "NOT_FOUND", message);
    }
    return new ApiError(404, "NOT_FOUND", "Not found");
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }

  static tooManyRequests(message?: string): ApiError {
    if (message) {
      return new ApiError(429, "TOO_MANY_REQUESTS", message);
    }
    return new ApiError(429, "TOO_MANY_REQUESTS", "Too many requests");
  }
}
