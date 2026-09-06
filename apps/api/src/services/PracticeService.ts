import { ApiError } from "../errors/ApiError";
import type { AppRepository, PracticeSessionWithProblems } from "../repositories/AppRepository";
import type { Difficulty, PracticeOutcome, PracticeSessionType } from "../types/domain";
import { getPagination } from "../utils/pagination";

const DEFAULT_MOCK_INTERVIEW_PROBLEM_COUNT = 2;
const DEFAULT_VIRTUAL_CONTEST_PROBLEM_COUNT = 4;
const DEFAULT_MOCK_INTERVIEW_SECONDS = 2700;
const DEFAULT_VIRTUAL_CONTEST_SECONDS = 5400;

export class PracticeService {
  constructor(private readonly repository: AppRepository) {}

  async start(
    userId: string,
    input: {
      type: PracticeSessionType;
      title?: string;
      durationSeconds?: number;
      problemIds?: string[];
      difficulty?: Difficulty;
      topic?: string;
      company?: string;
      count?: number;
      settings?: Record<string, unknown> | null;
    }
  ) {
    const defaultProblemCount =
      input.type === "MOCK_INTERVIEW" ? DEFAULT_MOCK_INTERVIEW_PROBLEM_COUNT : DEFAULT_VIRTUAL_CONTEST_PROBLEM_COUNT;
    const problemIds = input.problemIds?.length
      ? input.problemIds
      : await this.pickProblemIds({
          difficulty: input.difficulty,
          topic: input.topic,
          company: input.company,
          count: input.count ?? defaultProblemCount
        });
    if (problemIds.length === 0) {
      throw ApiError.badRequest("No matching problems are available for this practice session");
    }

    const defaultTitle = input.type === "MOCK_INTERVIEW" ? "Mock Interview" : "Virtual Contest";
    const defaultDurationSeconds =
      input.type === "MOCK_INTERVIEW" ? DEFAULT_MOCK_INTERVIEW_SECONDS : DEFAULT_VIRTUAL_CONTEST_SECONDS;

    return this.repository.createPracticeSession({
      userId,
      type: input.type,
      title: input.title ?? defaultTitle,
      durationSeconds: input.durationSeconds ?? defaultDurationSeconds,
      problemIds,
      settings: {
        difficulty: input.difficulty ?? null,
        topic: input.topic ?? null,
        company: input.company ?? null,
        ...(input.settings ?? {})
      }
    });
  }

  async list(userId: string, input: { type?: PracticeSessionType; page?: unknown; limit?: unknown }) {
    const pagination = getPagination(input);
    return this.repository.listPracticeSessions({
      userId,
      type: input.type,
      page: pagination.page,
      limit: pagination.limit
    });
  }

  async get(userId: string, sessionId: string, isAdmin = false) {
    const session = await this.repository.findPracticeSessionById(sessionId);
    if (!session) {
      throw ApiError.notFound("Practice session not found");
    }
    if (!isAdmin && session.userId !== userId) {
      throw ApiError.forbidden("You cannot view this practice session");
    }
    return {
      ...session,
      leaderboard: this.virtualLeaderboard(session)
    };
  }

  async updateProblem(
    userId: string,
    sessionId: string,
    sessionProblemId: string,
    input: { outcome?: PracticeOutcome | null; secondsSpent?: number | null; submissionId?: string | null },
    isAdmin = false
  ) {
    const session = await this.get(userId, sessionId, isAdmin);
    const sessionProblem = session.problems.find((item) => item.id === sessionProblemId);
    if (!sessionProblem) {
      throw ApiError.notFound("Practice session problem not found");
    }
    if (input.submissionId) {
      const submission = await this.repository.findSubmissionById(input.submissionId);
      if (!submission || submission.userId !== session.userId || submission.problemId !== sessionProblem.problemId) {
        throw ApiError.badRequest("Submission does not belong to this session problem");
      }
    }
    return this.repository.updatePracticeSessionProblem(sessionProblemId, input);
  }

  async finish(
    userId: string,
    sessionId: string,
    input: { summary?: Record<string, unknown> | null } = {},
    isAdmin = false
  ) {
    const session = await this.get(userId, sessionId, isAdmin);
    const summary = input.summary ?? this.buildSummary(session);
    const updated = await this.repository.updatePracticeSession(sessionId, {
      status: "COMPLETED",
      finishedAt: new Date(),
      summary
    });
    if (updated.type === "MOCK_INTERVIEW") {
      await this.repository.awardBadge({
        userId: updated.userId,
        badgeKey: "mock-interview-complete",
        sourceType: "MOCK_INTERVIEW",
        sourceId: updated.id
      });
    }
    return {
      ...updated,
      leaderboard: this.virtualLeaderboard(updated)
    };
  }

  async cancel(userId: string, sessionId: string, isAdmin = false) {
    await this.get(userId, sessionId, isAdmin);
    return this.repository.updatePracticeSession(sessionId, {
      status: "CANCELLED",
      finishedAt: new Date()
    });
  }

  private async pickProblemIds(input: {
    difficulty?: Difficulty;
    topic?: string;
    company?: string;
    count: number;
  }): Promise<string[]> {
    const page = await this.repository.listProblems({
      page: 1,
      limit: 200,
      difficulty: input.difficulty,
      topic: input.topic,
      company: input.company,
      sort: "frequency"
    });
    return page.items
      .slice()
      .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0) || a.title.localeCompare(b.title))
      .slice(0, input.count)
      .map((problem) => problem.id);
  }

  private buildSummary(session: PracticeSessionWithProblems) {
    let solved = 0;
    let review = 0;
    let skipped = 0;
    let secondsSpent = 0;
    for (const item of session.problems) {
      if (item.outcome === "SOLVED") solved += 1;
      if (item.outcome === "REVIEW") review += 1;
      if (item.outcome === "SKIPPED") skipped += 1;
      secondsSpent += item.secondsSpent ?? 0;
    }
    const totalProblems = session.problems.length;
    const scorePercent = totalProblems ? Math.round((solved / totalProblems) * 100) : 0;
    const pacingPercent = session.durationSeconds
      ? Math.max(0, Math.min(100, Math.round((secondsSpent / session.durationSeconds) * 100)))
      : 0;

    return {
      solved,
      review,
      skipped,
      totalProblems,
      secondsSpent,
      scorePercent,
      rubric: {
        correctness: scorePercent,
        pacing: pacingPercent,
        reviewLoad: review + skipped
      },
      virtualRatingImpact: session.type === "VIRTUAL_CONTEST" ? solved * 25 - review * 5 - skipped * 10 : 0
    };
  }

  private virtualLeaderboard(session: PracticeSessionWithProblems) {
    const solvedCount = session.problems.filter((item) => item.outcome === "SOLVED").length;
    const solvedSeconds = session.problems.reduce(
      (total, item) => total + (item.outcome === "SOLVED" ? (item.secondsSpent ?? 0) : 0),
      0
    );
    const penaltyMinutes = Math.round(solvedSeconds / 60);

    return [
      {
        userId: session.userId,
        solvedCount,
        penaltyMinutes,
        rank: 1
      }
    ];
  }
}
