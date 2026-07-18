import type { Problem } from "../types/api";

// problem number like 001, 002 for table display
export function problemNumber(problem: Problem, index: number): string {
  // problem is unused for now but kept so callers stay consistent
  void problem;
  const num = index + 1;
  const padded = String(num).padStart(3, "0");
  return padded;
}

// format a date string for UI display
export function formatDateTime(value: string | Date): string {
  const date = new Date(value);
  const formatted = date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
  return formatted;
}
