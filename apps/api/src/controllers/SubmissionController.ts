import type { Request, Response } from "express";
import {
  isTerminalSubmissionStatus,
  type SubmissionEventSubscriber,
  type SubmissionStatusEvent
} from "../events/SubmissionEventBus";
import type { SubmissionService } from "../services/SubmissionService";
import { sendSuccess } from "../utils/apiResponse";

export class SubmissionController {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly submissionEvents: SubmissionEventSubscriber
  ) {}

  run = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const result = await this.submissionService.runSamples(userId, req.body);
    sendSuccess(res, "Run completed", result);
  };

  runCustom = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const result = await this.submissionService.runCustom(userId, req.body);
    sendSuccess(res, "Code executed successfully", result);
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const submission = await this.submissionService.submit(userId, req.body);

    // only return id + status — frontend will poll/SSE for the rest
    sendSuccess(
      res,
      "Submission queued",
      {
        submissionId: submission.id,
        status: submission.status
      },
      undefined,
      201
    );
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const submissionId = req.params.id;

    const submission = await this.submissionService.getSubmission(userId, submissionId, isAdmin);
    sendSuccess(res, "Submission", submission);
  };

  // SSE stream for live verdict updates
  events = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const submissionId = req.params.id;

    // auth check first (throws if not allowed)
    await this.submissionService.getSubmissionStatusEvent(userId, submissionId, isAdmin);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    let closed = false;
    let unsubscribe: (() => void) | null = null;
    let heartbeat: NodeJS.Timeout | null = null;

    function cleanup(endStream: boolean) {
      if (closed) {
        return;
      }
      closed = true;
      if (unsubscribe) {
        unsubscribe();
      }
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      req.off("close", onClose);
      if (endStream && !res.writableEnded) {
        res.end();
      }
    }

    function writeEvent(event: SubmissionStatusEvent) {
      if (closed || res.writableEnded) {
        return;
      }
      // SSE format: event name + data line + blank line
      res.write("event: submission\n");
      res.write("data: " + JSON.stringify(event) + "\n\n");

      if (isTerminalSubmissionStatus(event.status)) {
        cleanup(true);
      }
    }

    function onClose() {
      cleanup(false);
    }

    req.on("close", onClose);

    // keep connection alive (some proxies kill idle streams)
    heartbeat = setInterval(() => {
      if (!closed && !res.writableEnded) {
        res.write("event: heartbeat\ndata: {}\n\n");
      }
    }, 20000);

    unsubscribe = this.submissionEvents.subscribeToSubmission(submissionId, writeEvent);

    // send current status immediately so UI doesn't wait for next transition
    const snapshot = await this.submissionService.getSubmissionStatusEvent(userId, submissionId, isAdmin);
    writeEvent(snapshot);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const page = await this.submissionService.list(userId, req.query, isAdmin);

    sendSuccess(res, "Submissions", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };

  byProblem = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const slug = req.params.slug;

    const page = await this.submissionService.listByProblem(userId, slug, isAdmin);
    sendSuccess(res, "Problem submissions", page.items, {
      total: page.total,
      page: page.page,
      limit: page.limit
    });
  };
}
