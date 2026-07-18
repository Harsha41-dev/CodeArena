import { createHash } from "node:crypto";

// normalize line endings / trailing spaces so WA isn't too picky
export function normalizeOutput(output: string): string {
  let text = output;

  // windows newlines -> unix
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "\n");

  const lines = text.split("\n");
  const cleaned: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    cleaned.push(lines[i].trimEnd());
  }

  text = cleaned.join("\n");
  // drop trailing blank lines
  text = text.replace(/\n+$/g, "");
  text = text.trimEnd();
  return text;
}

export function compareOutput(actual: string, expected: string, strict: boolean): boolean {
  const a = normalizeOutput(actual);
  const e = normalizeOutput(expected);

  if (strict) {
    return a === e;
  }

  // non-strict: collapse any whitespace runs to single space
  const aLoose = a.replace(/\s+/g, " ");
  const eLoose = e.replace(/\s+/g, " ");
  return aLoose === eLoose;
}

export function hashJudgeOutput(output: string): string {
  return createHash("sha256").update(output).digest("hex");
}
