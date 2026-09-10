import type { Difficulty, SubmissionStatus } from "../types/api";

export function difficultyClass(difficulty: Difficulty): string {
  if (difficulty === "EASY") {
    return "bg-[#6fbf9a]/12 text-[#6fbf9a] border-transparent";
  }
  if (difficulty === "MEDIUM") {
    return "bg-[#c4a574]/12 text-[#c4a574] border-transparent";
  }
  return "bg-[#c97a72]/12 text-[#c97a72] border-transparent";
}

export function verdictClass(status: SubmissionStatus | string): string {
  if (status === "ACCEPTED") {
    return "bg-[#6fbf9a]/12 text-[#6fbf9a] border-transparent";
  }
  if (status === "PENDING" || status === "RUNNING") {
    return "bg-[#14332c] text-[#7dcfb6] border-transparent";
  }
  return "bg-[#c97a72]/12 text-[#c97a72] border-transparent";
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
