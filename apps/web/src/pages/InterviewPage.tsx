import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Play, RotateCcw, Target } from "lucide-react";
import { practiceApi, problemsApi } from "../services/api";
import { Button } from "../components/Button";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { TagBadge } from "../components/TagBadge";
import { useAuthStore } from "../stores/authStore";
import type { Difficulty, PracticeOutcome, PracticeSession, Problem } from "../types/api";

interface LocalInterviewSession {
  id: string;
  local: true;
  problem: Problem;
  startedAt: number;
  durationSeconds: number;
  finishedAt?: number;
  outcome?: PracticeOutcome;
}

type InterviewSession = PracticeSession | LocalInterviewSession;

export function InterviewPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [tag, setTag] = useState("");
  const [company, setCompany] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [localHistory, setLocalHistory] = useState<LocalInterviewSession[]>(() => readHistory());

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: problemsApi.tags
  });

  const problems = useQuery({
    queryKey: ["interview-problems", difficulty, tag, company],
    queryFn: () =>
      problemsApi.list({
        limit: "100",
        ...(difficulty ? { difficulty } : {}),
        ...(tag ? { tag } : {}),
        ...(company.trim() ? { company: company.trim() } : {})
      })
  });

  const remoteHistory = useQuery({
    queryKey: ["practice-sessions", "mock-interview"],
    queryFn: () => practiceApi.list({ type: "MOCK_INTERVIEW", limit: "10" }),
    enabled: Boolean(user)
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const history = useMemo(() => (user ? remoteHistory.data ?? [] : localHistory), [localHistory, remoteHistory.data, user]);
  const report = useMemo(() => buildReport(history), [history]);
  const remainingSeconds = useMemo(() => {
    if (!session || isFinished(session)) {
      return 0;
    }
    const elapsed = Math.floor((now - startedMs(session)) / 1000);
    return Math.max(0, session.durationSeconds - elapsed);
  }, [now, session]);

  const startRemote = useMutation({
    mutationFn: async () => {
      const picked = pickProblem(problems.data ?? []);
      if (!picked) {
        throw new Error("No problem is available for this interview.");
      }
      return practiceApi.start({
        type: "MOCK_INTERVIEW",
        title: "Mock Interview",
        durationSeconds: minutes * 60,
        problemIds: [picked.id],
        difficulty: difficulty || undefined,
        topic: tag || undefined,
        company: company.trim() || undefined,
        count: 1,
        settings: { minutes, difficulty: difficulty || null, tag: tag || null, company: company.trim() || null }
      });
    },
    onSuccess: (created) => {
      setSession(created);
      void queryClient.invalidateQueries({ queryKey: ["practice-sessions", "mock-interview"] });
    }
  });

  const finishRemote = useMutation({
    mutationFn: async (outcome: PracticeOutcome) => {
      if (!session || isLocalSession(session)) {
        throw new Error("No persisted interview session is active.");
      }
      const item = session.problems[0];
      if (!item) {
        throw new Error("This interview has no problem attached.");
      }
      await practiceApi.updateProblem(session.id, item.id, {
        outcome,
        secondsSpent: Math.max(0, Math.floor((Date.now() - startedMs(session)) / 1000))
      });
      return practiceApi.finish(session.id);
    },
    onSuccess: (finished) => {
      setSession(finished);
      void queryClient.invalidateQueries({ queryKey: ["practice-sessions", "mock-interview"] });
    }
  });

  if (problems.isLoading || tags.isLoading) {
    return <LoadingState label="Loading interview mode" />;
  }

  if (problems.isError) {
    return <ErrorState title="Could not load interview problems" error={problems.error} />;
  }

  const available = problems.data ?? [];
  const activeProblem = session ? sessionProblem(session) : null;

  function startSession() {
    if (!available.length) {
      return;
    }

    if (user) {
      startRemote.mutate();
      return;
    }

    const problem = pickProblem(available);
    if (!problem) {
      return;
    }
    setSession({
      id: `${Date.now()}`,
      local: true,
      problem,
      startedAt: Date.now(),
      durationSeconds: minutes * 60
    });
  }

  function finish(outcome: PracticeOutcome) {
    if (!session) {
      return;
    }

    if (!isLocalSession(session)) {
      finishRemote.mutate(outcome);
      return;
    }

    const completed = { ...session, finishedAt: Date.now(), outcome };
    const nextHistory = [completed, ...localHistory].slice(0, 10);
    setSession(completed);
    setLocalHistory(nextHistory);
    window.localStorage.setItem("codearena:interview-history", JSON.stringify(nextHistory));
  }

  return (
    <div className="space-y-5">
      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mock Interview</h1>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Pick constraints, run a timed round, and save a report against your account when signed in.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-right dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Timer</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{formatSeconds(remainingSeconds)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <select
            className="ca-input"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty | "")}
          >
            <option value="">Any difficulty</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
          <select className="ca-input" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">Any topic</option>
            {(tags.data ?? []).map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            className="ca-input"
            value={company}
            placeholder="Company"
            onChange={(event) => setCompany(event.target.value)}
          />
          <input
            className="ca-input"
            type="number"
            min={10}
            max={120}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
          <Button disabled={!available.length || startRemote.isPending} onClick={startSession}>
            <Play className="h-4 w-4" />
            Start Round
          </Button>
        </div>
        {startRemote.isError ? <p className="mt-3 text-sm text-rose-600">{startRemote.error.message}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <div className="ca-panel p-5">
          <h2 className="font-semibold">Current Problem</h2>
          {!activeProblem ? (
            <EmptyState title="No active round" body={`${available.length} problems match the current filters.`} />
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">{activeProblem.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {activeProblem.tags.slice(0, 4).map((item) => (
                      <TagBadge key={item.id} label={item.name} />
                    ))}
                  </div>
                </div>
                <DifficultyBadge difficulty={activeProblem.difficulty} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={finishRemote.isPending || isFinished(session!)} onClick={() => finish("SOLVED")}>
                  Mark Solved
                </Button>
                <Button variant="secondary" disabled={finishRemote.isPending || isFinished(session!)} onClick={() => finish("REVIEW")}>
                  Needs Review
                </Button>
                <Button variant="ghost" disabled={finishRemote.isPending || isFinished(session!)} onClick={() => finish("SKIPPED")}>
                  Skip
                </Button>
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  to={`/problems/${activeProblem.slug}`}
                >
                  Open Workspace
                </Link>
              </div>
              {finishRemote.isError ? <p className="text-sm text-rose-600">{finishRemote.error.message}</p> : null}
            </div>
          )}
        </div>

        <div className="ca-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Session Report</h2>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <ReportMetric label="Solved" value={report.solved} />
            <ReportMetric label="Review" value={report.review} />
            <ReportMetric label="Skipped" value={report.skipped} />
            <ReportMetric label="Avg Time" value={formatSeconds(report.averageSeconds)} />
          </div>
          <div className="mt-4 space-y-3">
            {history.map((item) => {
              const problem = sessionProblem(item);
              return (
                <div key={item.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{problem?.title ?? sessionTitle(item)}</p>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-500 dark:bg-white/10">
                      {outcomeLabel(outcomeOf(item))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {isFinished(item) ? formatSeconds(elapsedSeconds(item)) : "In progress"}
                  </p>
                  {summaryLine(item) ? <p className="mt-1 text-xs text-emerald-600">{summaryLine(item)}</p> : null}
                </div>
              );
            })}
            {remoteHistory.isLoading && user ? <p className="text-sm text-slate-500">Loading saved sessions...</p> : null}
            {!history.length ? <EmptyState title="No completed rounds yet" /> : null}
          </div>
          {!user && localHistory.length ? (
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                setLocalHistory([]);
                window.localStorage.removeItem("codearena:interview-history");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset Report
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      </div>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function buildReport(history: InterviewSession[]) {
  const solved = history.filter((item) => outcomeOf(item) === "SOLVED").length;
  const review = history.filter((item) => outcomeOf(item) === "REVIEW").length;
  const skipped = history.filter((item) => outcomeOf(item) === "SKIPPED").length;
  const finished = history.filter(isFinished);
  const totalSeconds = finished.reduce((sum, item) => sum + elapsedSeconds(item), 0);
  return {
    solved,
    review,
    skipped,
    averageSeconds: finished.length ? Math.round(totalSeconds / finished.length) : 0
  };
}

function pickProblem(problems: Problem[]): Problem | null {
  if (!problems.length) {
    return null;
  }
  return problems[Math.floor(Math.random() * problems.length)];
}

function sessionProblem(session: InterviewSession): Problem | null {
  if (isLocalSession(session)) {
    return session.problem;
  }
  return session.problems[0]?.problem ?? null;
}

function sessionTitle(session: InterviewSession): string {
  return isLocalSession(session) ? "Mock Interview" : session.title;
}

function outcomeOf(session: InterviewSession): PracticeOutcome | null {
  if (isLocalSession(session)) {
    return session.outcome ?? null;
  }
  return session.problems[0]?.outcome ?? null;
}

function outcomeLabel(outcome: PracticeOutcome | null): string {
  if (outcome === "SOLVED") return "solved";
  if (outcome === "REVIEW") return "review";
  if (outcome === "SKIPPED") return "skipped";
  return "running";
}

function summaryLine(session: InterviewSession): string | null {
  if (isLocalSession(session) || !session.summary) {
    return null;
  }
  const score = typeof session.summary.score === "number" ? session.summary.score : null;
  const focus = typeof session.summary.focus === "string" ? session.summary.focus : null;
  if (score === null && !focus) {
    return null;
  }
  return [score === null ? null : `Score ${score}`, focus].filter(Boolean).join(" - ");
}

function startedMs(session: InterviewSession): number {
  return typeof session.startedAt === "number" ? session.startedAt : new Date(session.startedAt).getTime();
}

function finishedMs(session: InterviewSession): number | null {
  if (!session.finishedAt) {
    return null;
  }
  return typeof session.finishedAt === "number" ? session.finishedAt : new Date(session.finishedAt).getTime();
}

function elapsedSeconds(session: InterviewSession): number {
  const finished = finishedMs(session) ?? Date.now();
  return Math.max(0, Math.floor((finished - startedMs(session)) / 1000));
}

function isFinished(session: InterviewSession): boolean {
  return Boolean(session.finishedAt);
}

function isLocalSession(session: InterviewSession): session is LocalInterviewSession {
  return "local" in session;
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readHistory(): LocalInterviewSession[] {
  try {
    const raw = window.localStorage.getItem("codearena:interview-history");
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as LocalInterviewSession[];
    return parsed.map((item) => ({ ...item, local: true }));
  } catch {
    return [];
  }
}
