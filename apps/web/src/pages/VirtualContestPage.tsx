import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Play, RotateCcw, Trophy } from "lucide-react";
import { practiceApi, problemsApi } from "../services/api";
import { Button } from "../components/Button";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { TagBadge } from "../components/TagBadge";
import { useAuthStore } from "../stores/authStore";
import type { Difficulty, PracticeOutcome, PracticeSession, Problem } from "../types/api";

interface LocalVirtualSession {
  id: string;
  local: true;
  startedAt: number;
  durationSeconds: number;
  problems: Problem[];
  solved: string[];
  skipped: string[];
  finishedAt?: number;
}

type VirtualSession = PracticeSession | LocalVirtualSession;

export function VirtualContestPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [topic, setTopic] = useState("");
  const [company, setCompany] = useState("");
  const [problemCount, setProblemCount] = useState(4);
  const [minutes, setMinutes] = useState(90);
  const [session, setSession] = useState<VirtualSession | null>(null);
  const [localHistory, setLocalHistory] = useState<LocalVirtualSession[]>(() => readVirtualHistory());
  const [now, setNow] = useState(Date.now());

  const problems = useQuery({
    queryKey: ["virtual-contest-problems", difficulty, topic, company],
    queryFn: () =>
      problemsApi.list({
        limit: "100",
        sort: "frequency",
        ...(difficulty ? { difficulty } : {}),
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        ...(company.trim() ? { company: company.trim() } : {})
      })
  });

  const remoteHistory = useQuery({
    queryKey: ["practice-sessions", "virtual-contest"],
    queryFn: () => practiceApi.list({ type: "VIRTUAL_CONTEST", limit: "8" }),
    enabled: Boolean(user)
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!session || isFinished(session)) {
      return 0;
    }
    const elapsed = Math.floor((now - startedMs(session)) / 1000);
    return Math.max(0, session.durationSeconds - elapsed);
  }, [now, session]);

  const startRemote = useMutation({
    mutationFn: async () => {
      const picked = shuffleProblems(problems.data ?? []).slice(0, problemCount);
      return practiceApi.start({
        type: "VIRTUAL_CONTEST",
        title: "Virtual Contest",
        durationSeconds: minutes * 60,
        problemIds: picked.map((problem) => problem.id),
        difficulty: difficulty || undefined,
        topic: topic.trim() || undefined,
        company: company.trim() || undefined,
        count: problemCount,
        settings: {
          minutes,
          difficulty: difficulty || null,
          topic: topic.trim() || null,
          company: company.trim() || null
        }
      });
    },
    onSuccess: (created) => {
      setSession(created);
      void queryClient.invalidateQueries({ queryKey: ["practice-sessions", "virtual-contest"] });
    }
  });

  const updateRemoteProblem = useMutation({
    mutationFn: async ({ problemId, outcome }: { problemId: string; outcome: PracticeOutcome | null }) => {
      if (!session || isLocalSession(session)) {
        throw new Error("No persisted session is active.");
      }
      const item = session.problems.find((entry) => entry.problemId === problemId);
      if (!item) {
        throw new Error("Problem is not part of this virtual contest.");
      }
      await practiceApi.updateProblem(session.id, item.id, {
        outcome,
        secondsSpent: Math.max(0, Math.floor((Date.now() - startedMs(session)) / 1000))
      });
      return practiceApi.get(session.id);
    },
    onSuccess: (updated) => {
      setSession(updated);
      void queryClient.invalidateQueries({ queryKey: ["practice-sessions", "virtual-contest"] });
    }
  });

  const finishRemote = useMutation({
    mutationFn: (sessionId: string) => practiceApi.finish(sessionId),
    onSuccess: (finished) => {
      setSession(finished);
      void queryClient.invalidateQueries({ queryKey: ["practice-sessions", "virtual-contest"] });
    }
  });

  if (problems.isLoading) {
    return <LoadingState label="Loading virtual contest" />;
  }

  if (problems.isError) {
    return <ErrorState title="Could not load problems" error={problems.error} />;
  }

  const available = problems.data ?? [];
  const active = session && !isFinished(session) ? session : null;
  const history = user ? (remoteHistory.data ?? []) : localHistory;

  function startContest() {
    if (!available.length) {
      return;
    }

    if (user) {
      startRemote.mutate();
      return;
    }

    const picked = shuffleProblems(available).slice(0, problemCount);
    setSession({
      id: `${Date.now()}`,
      local: true,
      startedAt: Date.now(),
      durationSeconds: minutes * 60,
      problems: picked,
      solved: [],
      skipped: []
    });
  }

  function setOutcome(problemId: string, outcome: PracticeOutcome | null) {
    if (!session || isFinished(session)) return;

    if (!isLocalSession(session)) {
      updateRemoteProblem.mutate({ problemId, outcome });
      return;
    }

    setSession({
      ...session,
      solved:
        outcome === "SOLVED" ? toggleId(session.solved, problemId) : session.solved.filter((id) => id !== problemId),
      skipped:
        outcome === "SKIPPED" ? toggleId(session.skipped, problemId) : session.skipped.filter((id) => id !== problemId)
    });
  }

  function finishContest() {
    if (!session) return;

    if (!isLocalSession(session)) {
      finishRemote.mutate(session.id);
      return;
    }

    const finished = { ...session, finishedAt: Date.now() };
    const nextHistory = [finished, ...localHistory].slice(0, 8);
    setSession(finished);
    setLocalHistory(nextHistory);
    window.localStorage.setItem("codearena:virtual-contest-history", JSON.stringify(nextHistory));
  }

  return (
    <div className="space-y-5">
      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Virtual Contest</h1>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Start a timed problem set from the live catalog. Signed-in sessions are persisted with a virtual
              leaderboard.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-right dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Remaining</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{formatSeconds(remainingSeconds)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <select
            className="ca-input"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty | "")}
          >
            <option value="">Mixed difficulty</option>
            <option value="EASY">Easy only</option>
            <option value="MEDIUM">Medium only</option>
            <option value="HARD">Hard only</option>
          </select>
          <input
            className="ca-input"
            value={topic}
            placeholder="Topic tag"
            onChange={(event) => setTopic(event.target.value)}
          />
          <input
            className="ca-input"
            value={company}
            placeholder="Company"
            onChange={(event) => setCompany(event.target.value)}
          />
          <input
            className="ca-input"
            type="number"
            min={2}
            max={12}
            value={problemCount}
            onChange={(event) => setProblemCount(Number(event.target.value))}
          />
          <input
            className="ca-input"
            type="number"
            min={30}
            max={240}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
          <Button disabled={!available.length || startRemote.isPending} onClick={startContest}>
            <Play className="h-4 w-4" />
            Start
          </Button>
        </div>
        {startRemote.isError ? <p className="mt-3 text-sm text-rose-600">{startRemote.error.message}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="ca-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <h2 className="font-semibold">Problems</h2>
            {active ? (
              <Button variant="secondary" disabled={finishRemote.isPending} onClick={finishContest}>
                Finish Contest
              </Button>
            ) : null}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {(active ? sessionRows(active) : []).map((row, index) => {
              const solved = row.outcome === "SOLVED";
              const skipped = row.outcome === "SKIPPED";
              return (
                <div key={row.problem.id} className="grid gap-3 px-5 py-4 md:grid-cols-[3rem_1fr_auto]">
                  <span className="font-semibold text-slate-500">{String.fromCharCode(65 + index)}</span>
                  <div>
                    <Link
                      className="font-semibold text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                      to={`/problems/${row.problem.slug}`}
                    >
                      {row.problem.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {row.problem.tags.slice(0, 3).map((tag) => (
                        <TagBadge key={tag.id} label={tag.name} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DifficultyBadge difficulty={row.problem.difficulty} />
                    <Button
                      className="h-8 px-2 text-xs"
                      variant={solved ? "primary" : "secondary"}
                      disabled={updateRemoteProblem.isPending}
                      onClick={() => setOutcome(row.problem.id, solved ? null : "SOLVED")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Solved
                    </Button>
                    <Button
                      className="h-8 px-2 text-xs"
                      variant={skipped ? "danger" : "ghost"}
                      disabled={updateRemoteProblem.isPending}
                      onClick={() => setOutcome(row.problem.id, skipped ? null : "SKIPPED")}
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              );
            })}
            {!active ? (
              <EmptyState title="No active virtual contest" body={`${available.length} problems are available.`} />
            ) : null}
          </div>
          {updateRemoteProblem.isError ? (
            <p className="px-5 py-3 text-sm text-rose-600">{updateRemoteProblem.error.message}</p>
          ) : null}
          {finishRemote.isError ? (
            <p className="px-5 py-3 text-sm text-rose-600">{finishRemote.error.message}</p>
          ) : null}
        </div>

        <aside className="ca-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Recent Sessions</h2>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {solvedCount(item)}/{problemTotal(item)}
                  </p>
                  <span className="text-xs text-slate-500">{formatSeconds(item.durationSeconds)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(startedMs(item)).toLocaleDateString()} contest practice
                </p>
                {virtualRank(item) ? (
                  <p className="mt-1 text-xs text-emerald-600">Virtual rank #{virtualRank(item)}</p>
                ) : null}
              </div>
            ))}
            {remoteHistory.isLoading && user ? (
              <p className="text-sm text-slate-500">Loading saved sessions...</p>
            ) : null}
            {!history.length ? <EmptyState title="No virtual contests yet" /> : null}
          </div>
          {!user && localHistory.length ? (
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                setLocalHistory([]);
                window.localStorage.removeItem("codearena:virtual-contest-history");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function shuffleProblems(problems: Problem[]): Problem[] {
  return [...problems].sort(() => Math.random() - 0.5);
}

function sessionRows(session: VirtualSession): Array<{ problem: Problem; outcome: PracticeOutcome | null }> {
  if (isLocalSession(session)) {
    return session.problems.map((problem) => ({
      problem,
      outcome: session.solved.includes(problem.id) ? "SOLVED" : session.skipped.includes(problem.id) ? "SKIPPED" : null
    }));
  }

  return session.problems
    .map((item) => (item.problem ? { problem: item.problem, outcome: item.outcome ?? null } : null))
    .filter((item): item is { problem: Problem; outcome: PracticeOutcome | null } => Boolean(item));
}

function solvedCount(session: VirtualSession): number {
  if (isLocalSession(session)) {
    return session.solved.length;
  }
  return session.problems.filter((item) => item.outcome === "SOLVED").length;
}

function problemTotal(session: VirtualSession): number {
  return session.problems.length;
}

function virtualRank(session: VirtualSession): number | null {
  if (isLocalSession(session) || !session.leaderboard?.length) {
    return null;
  }
  return session.leaderboard.find((row) => row.userId === session.userId)?.rank ?? null;
}

function startedMs(session: VirtualSession): number {
  return typeof session.startedAt === "number" ? session.startedAt : new Date(session.startedAt).getTime();
}

function isFinished(session: VirtualSession): boolean {
  return Boolean(session.finishedAt);
}

function isLocalSession(session: VirtualSession): session is LocalVirtualSession {
  return "local" in session;
}

function toggleId(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readVirtualHistory(): LocalVirtualSession[] {
  try {
    const raw = window.localStorage.getItem("codearena:virtual-contest-history");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalVirtualSession[];
    return parsed.map((item) => ({ ...item, local: true }));
  } catch {
    return [];
  }
}
