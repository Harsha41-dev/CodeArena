import type { Request, RequestHandler } from "express";
import type { AppContext } from "../appContext";
import { env } from "../config/env";
import { logger } from "../config/logger";

const ADMIN_MUTATION_METHODS = new Set(["POST", "PATCH", "DELETE"]);
const RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export function opsTelemetry(context: AppContext): RequestHandler {
  let lastRetentionSweepAt = 0;

  return (req, res, next) => {
    const startedAt = Date.now();

    res.on("finish", () => {
      if (!req.originalUrl.startsWith("/api/v1")) {
        return;
      }

      const requestPath = req.originalUrl.split("?")[0];
      const durationMs = Date.now() - startedAt;

      void context.repository
        .recordApiUsageEvent({
          userId: req.user?.id ?? null,
          method: req.method,
          path: requestPath,
          route: routeName(req),
          statusCode: res.statusCode,
          durationMs,
          ip: clientIp(req),
          userAgent: req.get("user-agent") ?? null,
          rateLimited: res.statusCode === 429
        })
        .catch((error) => {
          logger.debug({ error }, "Failed to record API usage event");
        });

      if (shouldSweepTelemetryRetention(lastRetentionSweepAt)) {
        lastRetentionSweepAt = Date.now();
        const cutoff = new Date(Date.now() - env.OPS_TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        void context.repository.deleteApiUsageEventsBefore(cutoff).catch((error) => {
          logger.debug({ error }, "Failed to prune API usage telemetry");
        });
      }

      if (req.user?.role === "ADMIN" && ADMIN_MUTATION_METHODS.has(req.method)) {
        void context.repository
          .createAuditLog({
            actorId: req.user.id,
            action: `${req.method} ${requestPath}`,
            entityType: inferEntityType(requestPath),
            entityId: inferEntityId(requestPath),
            requestMethod: req.method,
            path: requestPath,
            statusCode: res.statusCode,
            outcome: res.statusCode >= 400 ? "FAILURE" : "SUCCESS",
            ip: clientIp(req),
            userAgent: req.get("user-agent") ?? null
          })
          .catch((error) => {
            logger.debug({ error }, "Failed to record admin audit log");
          });
      }
    });

    next();
  };
}

function shouldSweepTelemetryRetention(lastRetentionSweepAt: number): boolean {
  if (env.OPS_TELEMETRY_RETENTION_DAYS <= 0) {
    return false;
  }
  return Date.now() - lastRetentionSweepAt >= RETENTION_SWEEP_INTERVAL_MS;
}

function routeName(req: Request): string | null {
  if (!req.route?.path) {
    return null;
  }
  return `${req.baseUrl}${String(req.route.path)}`;
}

function clientIp(req: Request): string | null {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip ?? null;
}

function inferEntityType(pathname: string): string {
  if (pathname.includes("/problems")) return "PROBLEM";
  if (pathname.includes("/submissions")) return "SUBMISSION";
  if (pathname.includes("/contests")) return "CONTEST";
  if (pathname.includes("/solutions")) return "SOLUTION";
  if (pathname.includes("/reports")) return "REPORT";
  if (pathname.includes("/users")) return "USER";
  if (pathname.includes("/backups")) return "BACKUP";
  if (pathname.includes("/monitoring")) return "MONITORING";
  if (pathname.includes("/languages")) return "LANGUAGE";
  return "SYSTEM";
}

function inferEntityId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const ignored = new Set([
    "api",
    "v1",
    "admin",
    "problems",
    "submissions",
    "contests",
    "solutions",
    "reports",
    "users",
    "backups",
    "monitoring",
    "snapshots",
    "languages",
    "rate",
    "vote",
    "follow",
    "read",
    "read-all"
  ]);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!ignored.has(part)) {
      return part;
    }
  }
  return null;
}
