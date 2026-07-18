import type { Submission } from "../types/api";

// prefer the snapshot name from the backend, fall back to legacy language enum
export function submissionLanguageLabel(
  submission: Pick<Submission, "language" | "languageNameSnapshot" | "languageVersionSnapshot">
): string {
  const parts: string[] = [];

  if (submission.languageNameSnapshot) {
    parts.push(submission.languageNameSnapshot);
  }
  if (submission.languageVersionSnapshot) {
    parts.push(submission.languageVersionSnapshot);
  }

  if (parts.length > 0) {
    return parts.join(" ");
  }

  // older submissions only have the enum language field
  return submission.language;
}
