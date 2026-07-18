import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { submissionsApi } from "../services/api";
import type { SubmissionStatus } from "../types/api";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { FilterBar, SelectFilter } from "../components/FilterBar";
import { SearchInput } from "../components/SearchInput";
import { SubmissionTable } from "../components/SubmissionTable";
import { submissionLanguageLabel } from "../lib/languages";

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
  const [status, setStatus] = useState("");
  const [language, setLanguage] = useState("");
  const [problem, setProblem] = useState("");

  const submissions = useQuery({
    queryKey: ["submissions"],
    queryFn: submissionsApi.list
  });

  // client-side filter for now
  const filtered = useMemo(() => {
    const list = submissions.data ?? [];
    const result = [];

    for (let i = 0; i < list.length; i++) {
      const submission = list[i];
      const languageLabel = submissionLanguageLabel(submission);

      // status filter
      let matchesStatus = true;
      if (status) {
        matchesStatus = submission.status === status;
      }

      // language filter (match label or legacy enum)
      let matchesLanguage = true;
      if (language) {
        matchesLanguage = languageLabel === language || submission.language === language;
      }

      // problem text search
      let matchesProblem = true;
      if (problem) {
        const title = submission.problem?.title ?? "";
        const haystack = `${title} ${submission.problemId}`.toLowerCase();
        matchesProblem = haystack.includes(problem.toLowerCase());
      }

      if (matchesStatus && matchesLanguage && matchesProblem) {
        result.push(submission);
      }
    }

    return result;
  }, [language, problem, status, submissions.data]);

  // unique language labels for the dropdown
  const languageOptions = useMemo(() => {
    const list = submissions.data ?? [];
    const set = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      set.add(submissionLanguageLabel(list[i]));
    }
    return Array.from(set).sort();
  }, [submissions.data]);

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

  const languageSelectOptions = [
    { value: "", label: "All languages" },
    ...languageOptions.map((item) => ({ value: item, label: item }))
  ];

  return (
    <section className="ca-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Submission History</h1>
          <p className="mt-1 text-sm text-slate-500">Filter verdicts, languages, problems, and submitted runs.</p>
        </div>
        <FilterBar>
          <SearchInput value={problem} onChange={setProblem} placeholder="Problem" />
          <SelectFilter label="Status" value={status} onChange={setStatus} options={statusOptions} />
          <SelectFilter label="Language" value={language} onChange={setLanguage} options={languageSelectOptions} />
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
