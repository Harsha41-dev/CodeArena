import type { ReactNode } from "react";
import type { Problem } from "../types/api";
import { DifficultyBadge } from "./DifficultyBadge";
import { TagBadge } from "./TagBadge";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function ProblemStatement({ problem }: { problem: Problem }) {
  const samples = problem.sampleTestCases ?? [];

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{problem.title}</h1>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {problem.tags.map((tag) => (
            <TagBadge key={tag.id} label={tag.name} />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Info label="Time Limit" value={`${problem.timeLimitMs} ms`} />
          <Info label="Memory Limit" value={`${problem.memoryLimitMb} MB`} />
        </div>
      </div>

      <Section title="Statement">
        <MarkdownRenderer content={problem.description} />
      </Section>

      <Section title="Input Format">
        <p>{problem.inputFormat}</p>
      </Section>

      <Section title="Output Format">
        <p>{problem.outputFormat}</p>
      </Section>

      <Section title="Constraints">
        <p>{problem.constraints}</p>
      </Section>

      <Section title="Examples">
        <div className="space-y-3">
          {samples.map((testCase, index) => (
            <div key={testCase.id} className="ca-muted-panel p-3">
              <p className="font-medium">Example {index + 1}</p>
              <pre className="mt-2 rounded bg-white p-2 text-xs dark:bg-slate-900">{testCase.input}</pre>
              <pre className="mt-2 rounded bg-white p-2 text-xs dark:bg-slate-900">{testCase.expectedOutput}</pre>
              {testCase.explanation ? <p className="mt-2 text-slate-500">{testCase.explanation}</p> : null}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-slate-950 dark:text-white">{title}</h2>
      <div className="text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="ca-muted-panel px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
