import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { submissionsApi } from "../services/api";
import type { SubmissionStatus } from "../types/api";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { FilterBar, SelectFilter } from "../components/FilterBar";
import { SearchInput } from "../components/SearchInput";
import { SubmissionTable } from "../components/SubmissionTable";

const ALL_STATUSES: SubmissionStatus[] = [
  "PENDING",
  "RUNNING",
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
  "INTERNAL_ERROR"
];

export function SubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const language = searchParams.get("language") ?? "";
  const problem = searchParams.get("problemSlug") ?? "";
  const dateFrom = normalizeDateFilter(searchParams.get("dateFrom"));
  const dateTo = normalizeDateFilter(searchParams.get("dateTo"));

  const queryParams: Record<string, string> = {};
  if (status) queryParams.status = status;
  if (language) queryParams.language = language;
  if (problem) queryParams.problemSlug = problem;
  if (dateFrom) queryParams.dateFrom = `${dateFrom}T00:00:00.000Z`;
  if (dateTo) queryParams.dateTo = `${dateTo}T23:59:59.999Z`;

  const submissions = useQuery({
    queryKey: ["submissions", status, language, problem, dateFrom, dateTo],
    queryFn: () => submissionsApi.list(queryParams)
  });

  function setFilter(key: "status" | "language" | "problemSlug" | "dateFrom" | "dateTo", value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  if (submissions.isLoading) {
    return <LoadingState label="Loading submissions" />;
  }

  if (submissions.isError) {
    return <ErrorState title="Could not load submissions" error={submissions.error} />;
  }

  const statusOptions = [
    { value: "", label: "All verdicts" },
    ...ALL_STATUSES.map((item) => ({
      value: item,
      label: item.replace(/_/g, " ")
    }))
  ];

  const filtered = submissions.data ?? [];

  return (
    <section className="ca-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Submission History</h1>
          <p className="mt-1 text-sm text-slate-500">Filter verdicts, languages, problems, and submitted runs.</p>
        </div>
        <FilterBar>
          <SearchInput value={problem} onChange={(value) => setFilter("problemSlug", value)} placeholder="Problem slug" />
          <SearchInput value={language} onChange={(value) => setFilter("language", value)} placeholder="Language" />
          <SelectFilter
            label="Status"
            value={status}
            onChange={(value) => setFilter("status", value)}
            options={statusOptions}
          />
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">From date</span>
            <input
              className="ca-input"
              type="date"
              value={dateFrom}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">To date</span>
            <input
              className="ca-input"
              type="date"
              value={dateTo}
              onChange={(event) => setFilter("dateTo", event.target.value)}
            />
          </label>
        </FilterBar>
      </div>

      {!filtered.length ? (
        <div className="p-5">
          <EmptyState title="No submissions found" body="Submit a problem or adjust filters." />
        </div>
      ) : (
        <SubmissionTable submissions={filtered} />
      )}
    </section>
  );
}

function normalizeDateFilter(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}
