import type { Difficulty, SubmissionStatus } from "../types/api";

export function difficultyClass(difficulty: Difficulty): string {
  if (difficulty === "EASY") {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400";
  }
  if (difficulty === "MEDIUM") {
    return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400";
  }
  return "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400";
}

export function verdictClass(status: SubmissionStatus | string): string {
  if (status === "ACCEPTED") {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400";
  }
  if (status === "PENDING" || status === "RUNNING") {
    return "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400";
  }
  return "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400";
}

// WRONG_ANSWER -> Wrong Answer
export function formatStatus(status: string): string {
  const withSpaces = status.replace(/_/g, " ").toLowerCase();
  const parts = withSpaces.split(" ");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) {
      parts[i] = parts[i][0].toUpperCase() + parts[i].slice(1);
    }
  }
  return parts.join(" ");
}

const TERMINAL_STATUSES: SubmissionStatus[] = [
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
  "INTERNAL_ERROR"
];

export function isTerminalSubmissionStatus(status?: SubmissionStatus | null): boolean {
  if (!status) {
    return false;
  }
  return TERMINAL_STATUSES.includes(status);
}
