import { Copy } from "lucide-react";
import type { CustomRunResult, RunResult, TestCase } from "../types/api";
import { Button } from "./Button";
import { VerdictBadge } from "./VerdictBadge";

export function TestCasePanel({
  testCases,
  activeCase,
  onActiveCaseChange,
  result,
  customInput,
  onCustomInputChange,
  customResult
}: {
  testCases: TestCase[];
  activeCase: number;
  onActiveCaseChange: (index: number) => void;
  result?: RunResult | null;
  customInput?: string;
  onCustomInputChange?: (value: string) => void;
  customResult?: CustomRunResult | null;
}) {
  // custom input is treated as the last "tab"
  const customIndex = testCases.length;
  const isCustom = activeCase === customIndex;
  const selected = testCases[activeCase];
  const selectedResult = result?.results[activeCase];

  function handleCustomInputChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (onCustomInputChange) {
      onCustomInputChange(event.target.value);
    }
  }

  return (
    <div className="border-t border-slate-200/80 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {testCases.map((testCase, index) => {
          const isActive = activeCase === index;
          let buttonClass =
            "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10";
          if (isActive) {
            buttonClass = "bg-slate-900 text-white dark:bg-white dark:text-slate-950";
          }

          return (
            <button
              key={testCase.id}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${buttonClass}`}
              onClick={() => onActiveCaseChange(index)}
            >
              Case {index + 1}
            </button>
          );
        })}

        <button
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            isCustom
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
          onClick={() => onActiveCaseChange(customIndex)}
        >
          Custom Input
        </button>

        {selectedResult ? <VerdictBadge status={selectedResult.status} /> : null}
        {customResult && isCustom ? <VerdictBadge status={customResult.status} /> : null}
      </div>

      {isCustom ? (
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
          <div className="min-h-24 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Custom Input
            </p>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-200 bg-white p-2 font-mono text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-200"
              value={customInput ?? ""}
              onChange={handleCustomInputChange}
            />
          </div>
          <ConsoleBlock
            title="Actual Output"
            content={customResult?.stdout ?? ""}
            emptyLabel={customResult ? "No output" : "No run yet"}
          />
          <ConsoleBlock
            title="Error"
            content={customResult?.stderr ?? ""}
            emptyLabel={customResult ? "No error" : "No run yet"}
          />
          <ConsoleBlock
            title="Compile Output"
            content={customResult?.compileOutput ?? ""}
            emptyLabel={customResult ? "No compile output" : "No run yet"}
          />
        </div>
      ) : (
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
          <ConsoleBlock title="Input" content={selected?.input ?? ""} copyable />
          <ConsoleBlock title="Expected" content={selected?.expectedOutput ?? ""} />
          <ConsoleBlock
            title="Actual Output"
            content={selectedResult?.actualOutput ?? ""}
            emptyLabel={selectedResult ? "No output" : "No run yet"}
          />
          <ConsoleBlock
            title="Error"
            content={selectedResult?.stderr ?? ""}
            emptyLabel={selectedResult ? "No error" : "No run yet"}
          />
        </div>
      )}
    </div>
  );
}

function ConsoleBlock({
  title,
  content,
  copyable = false,
  emptyLabel = "No data"
}: {
  title: string;
  content: string;
  copyable?: boolean;
  emptyLabel?: string;
}) {
  function handleCopy() {
    // ignore errors if clipboard is blocked
    navigator.clipboard.writeText(content).catch(() => {
      // noop
    });
  }

  const display = content || emptyLabel;

  return (
    <div className="min-h-24 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">{title}</p>
        {copyable ? (
          <Button variant="ghost" className="h-6 px-2 text-xs" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[13px] text-slate-800 dark:text-slate-200">
        {display}
      </pre>
    </div>
  );
}
