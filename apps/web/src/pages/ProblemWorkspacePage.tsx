import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bookmark, FileText, Maximize2, MessageSquare, Play, RefreshCcw, Save, Send } from "lucide-react";
import { executorApi, problemsApi, socialApi, submissionsApi } from "../services/api";
import type { CustomRunResult, ProblemLanguageOption, RunResult, StarterCode, Submission } from "../types/api";
import { Button } from "../components/Button";
import { CodeEditor } from "../components/CodeEditor";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { ProblemStatement } from "../components/ProblemStatement";
import { ResultPanel } from "../components/ResultPanel";
import { SubmissionLiveStatusBanner } from "../components/SubmissionLiveStatusBanner";
import { TestCasePanel } from "../components/TestCasePanel";
import { VerdictBadge } from "../components/VerdictBadge";
import { useSubmissionEvents } from "../hooks/useSubmissionEvents";
import { useAuthStore } from "../stores/authStore";
import { submissionLanguageLabel } from "../lib/languages";
import { isTerminalSubmissionStatus } from "../lib/status";
import { shouldShowMockJudgeWarning } from "../lib/executorUi";

type LeftTab = "description" | "editorial" | "submissions" | "discussion" | "notes";

export function ProblemWorkspacePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const problem = useQuery({
    queryKey: ["problem", slug],
    queryFn: () => problemsApi.get(slug),
    enabled: Boolean(slug)
  });

  const problemLanguages = useQuery({
    queryKey: ["problem-languages", slug],
    queryFn: () => problemsApi.languages(slug),
    enabled: Boolean(slug)
  });

  const problemCapabilities = useQuery({
    queryKey: ["executor-capabilities", slug],
    queryFn: () => executorApi.capabilities({ problemSlug: slug }),
    enabled: Boolean(slug)
  });

  const executorHealth = useQuery({
    queryKey: ["executor-health"],
    queryFn: executorApi.health,
    enabled: Boolean(slug),
    retry: false
  });

  const editorial = useQuery({
    queryKey: ["editorial", slug],
    queryFn: () => problemsApi.editorial(slug),
    enabled: Boolean(slug)
  });

  const discussions = useQuery({
    queryKey: ["problem-discussions", slug],
    queryFn: () => problemsApi.discussions(slug),
    enabled: Boolean(slug)
  });

  const note = useQuery({
    queryKey: ["note", slug],
    queryFn: () => socialApi.getNote(slug),
    enabled: Boolean(user && slug),
    retry: false
  });

  const [leftTab, setLeftTab] = useState<LeftTab>("description");
  const [selectedLanguageKey, setSelectedLanguageKey] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [customRunResult, setCustomRunResult] = useState<CustomRunResult | null>(null);
  const [lastRunMeta, setLastRunMeta] = useState<{
    code: string;
    languageKey: string;
    problemSlug: string;
  } | null>(null);
  const [lastCustomRunMeta, setLastCustomRunMeta] = useState<{
    code: string;
    languageKey: string;
    problemSlug: string;
  } | null>(null);
  const [lastSubmissionMeta, setLastSubmissionMeta] = useState<{
    code: string;
    languageKey: string;
    problemSlug: string;
  } | null>(null);
  const [activeCase, setActiveCase] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const languageOptions = useMemo(() => {
    return problemLanguages.data ?? [];
  }, [problemLanguages.data]);

  const capabilityByVersion = useMemo(() => {
    const map = new Map();
    const list = problemCapabilities.data?.languages ?? [];
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      map.set(entry.version.id, entry);
    }
    return map;
  }, [problemCapabilities.data?.languages]);

  const executableLanguageOptions = useMemo(() => {
    const result: ProblemLanguageOption[] = [];
    for (let i = 0; i < languageOptions.length; i++) {
      const option = languageOptions[i];
      const cap = capabilityByVersion.get(option.version.id);
      if (cap && cap.canRun) {
        result.push(option);
      }
    }
    return result;
  }, [capabilityByVersion, languageOptions]);

  const selectedLanguage = useMemo(() => {
    for (let i = 0; i < languageOptions.length; i++) {
      const option = languageOptions[i];
      const key = `${option.language.id}:${option.version.id}`;
      if (key === selectedLanguageKey) {
        return option;
      }
    }
    if (executableLanguageOptions[0]) {
      return executableLanguageOptions[0];
    }
    return languageOptions[0];
  }, [executableLanguageOptions, languageOptions, selectedLanguageKey]);

  let draftKey = `codearena:draft:${slug}:none`;
  if (selectedLanguage) {
    draftKey = `codearena:draft:${slug}:${selectedLanguage.language.id}:${selectedLanguage.version.id}`;
  }

  const liveUpdates = useSubmissionEvents(submissionId, Boolean(submissionId));

  const submission = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => submissionsApi.get(submissionId!),
    enabled: Boolean(submissionId),
    refetchInterval: (query) => {
      const liveStatus = liveUpdates.event?.status;
      const dataStatus = query.state.data?.status;
      const status = liveStatus ?? dataStatus;
      if (!liveUpdates.isPollingFallback) {
        return false;
      }
      if (status === "PENDING" || status === "RUNNING") {
        return 1000;
      }
      return false;
    }
  });

  const recentSubmissions = useQuery({
    queryKey: ["submissions", slug],
    queryFn: submissionsApi.list,
    enabled: Boolean(user && slug)
  });

  useEffect(() => {
    const event = liveUpdates.event;
    if (!event) {
      return;
    }
    if (!submissionId) {
      return;
    }
    if (event.submissionId !== submissionId) {
      return;
    }

    queryClient.setQueryData<Submission>(["submission", submissionId], (current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        status: event.status,
        runtimeMs: event.runtime,
        memoryKb: event.memory
      };
    });

    if (isTerminalSubmissionStatus(event.status)) {
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", slug] });
    }
  }, [liveUpdates.event, queryClient, slug, submissionId]);

  useEffect(() => {
    if (!languageOptions.length) {
      return;
    }
    if (problemCapabilities.isLoading) {
      return;
    }

    const selected = languageOptions.find((option) => {
      const key = `${option.language.id}:${option.version.id}`;
      return key === selectedLanguageKey;
    });

    if (selected) {
      const cap = capabilityByVersion.get(selected.version.id);
      if (cap && cap.canRun) {
        return;
      }
    }

    let defaultOption = executableLanguageOptions.find((option) => option.version.isDefault);
    if (!defaultOption) {
      defaultOption = executableLanguageOptions[0];
    }
    if (!defaultOption) {
      return;
    }

    setSelectedLanguageKey(`${defaultOption.language.id}:${defaultOption.version.id}`);
  }, [
    capabilityByVersion,
    executableLanguageOptions,
    languageOptions,
    problemCapabilities.isLoading,
    selectedLanguageKey
  ]);

  useEffect(() => {
    if (!problem.data || !selectedLanguage) {
      return;
    }
    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      setCode(saved);
      return;
    }
    const starter =
      selectedLanguage.starterCode ?? selectedLanguage.version.starterTemplate ?? fallbackLegacyStarter(problem.data);
    setCode(starter);
  }, [draftKey, problem.data, selectedLanguage]);

  useEffect(() => {
    if (code) {
      window.localStorage.setItem(draftKey, code);
    }
  }, [code, draftKey]);

  useEffect(() => {
    setRunResult(null);
    setCustomRunResult(null);
    setLastRunMeta(null);
    setLastCustomRunMeta(null);
    setLastSubmissionMeta(null);
    setSubmissionId(null);
  }, [selectedLanguageKey, slug]);

  useEffect(() => {
    setNoteContent(note.data?.content ?? "");
  }, [note.data?.content]);

  const runMutation = useMutation({
    mutationFn: (input: { option: ProblemLanguageOption; codeSnapshot: string; languageKeySnapshot: string }) => {
      const payload = languagePayload(input.option, {
        problemSlug: slug,
        code: input.codeSnapshot
      });
      return submissionsApi.run(payload);
    },
    onMutate: () => {
      setRunResult(null);
      setLastRunMeta(null);
    },
    onSuccess: (result, input) => {
      setRunResult(result);
      setLastRunMeta({
        code: input.codeSnapshot,
        languageKey: input.languageKeySnapshot,
        problemSlug: slug
      });
    }
  });

  const customRunMutation = useMutation({
    mutationFn: (input: {
      option: ProblemLanguageOption;
      codeSnapshot: string;
      languageKeySnapshot: string;
      customInputSnapshot: string;
    }) => {
      const payload = languagePayload(input.option, {
        problemId: problem.data!.id,
        code: input.codeSnapshot,
        input: input.customInputSnapshot
      });
      return submissionsApi.runCustom(payload);
    },
    onMutate: () => {
      setCustomRunResult(null);
      setLastCustomRunMeta(null);
    },
    onSuccess: (result, input) => {
      setCustomRunResult(result);
      setLastCustomRunMeta({
        code: input.codeSnapshot,
        languageKey: input.languageKeySnapshot,
        problemSlug: slug
      });
    }
  });

  const submitMutation = useMutation({
    mutationFn: (input: { option: ProblemLanguageOption; codeSnapshot: string; languageKeySnapshot: string }) => {
      const payload = languagePayload(input.option, {
        problemSlug: slug,
        problemId: problem.data?.id,
        code: input.codeSnapshot
      });
      return submissionsApi.submit(payload);
    },
    onMutate: () => {
      setSubmissionId(null);
      setLastSubmissionMeta(null);
    },
    onSuccess: (data, input) => {
      setSubmissionId(data.submissionId);
      setLastSubmissionMeta({
        code: input.codeSnapshot,
        languageKey: input.languageKeySnapshot,
        problemSlug: slug
      });
    }
  });

  const bookmarkMutation = useMutation({
    mutationFn: () => socialApi.addBookmark(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    }
  });

  const saveNoteMutation = useMutation({
    mutationFn: () => socialApi.saveNote(slug, noteContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", slug] });
    }
  });

  const sampleCases = useMemo(() => {
    return problem.data?.sampleTestCases ?? [];
  }, [problem.data?.sampleTestCases]);

  const isCustomInputActive = activeCase === sampleCases.length;

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod || event.key !== "Enter") {
        return;
      }

      event.preventDefault();

      if (event.shiftKey) {
        if (user && selectedLanguage) {
          submitMutation.mutate({
            option: selectedLanguage,
            codeSnapshot: code,
            languageKeySnapshot: selectedLanguageKey
          });
        }
        return;
      }

      if (user) {
        runCurrent();
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCase,
    code,
    customInput,
    customRunMutation,
    runMutation,
    sampleCases.length,
    selectedLanguage,
    selectedLanguageKey,
    submitMutation,
    user
  ]);

  function runCurrent() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!selectedLanguage) {
      return;
    }

    if (isCustomInputActive) {
      customRunMutation.mutate({
        option: selectedLanguage,
        codeSnapshot: code,
        languageKeySnapshot: selectedLanguageKey,
        customInputSnapshot: customInput
      });
    } else {
      runMutation.mutate({
        option: selectedLanguage,
        codeSnapshot: code,
        languageKeySnapshot: selectedLanguageKey
      });
    }
  }

  function handleSubmitClick() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!selectedLanguage) {
      return;
    }
    submitMutation.mutate({
      option: selectedLanguage,
      codeSnapshot: code,
      languageKeySnapshot: selectedLanguageKey
    });
  }

  function handleSaveNote() {
    if (!user) {
      navigate("/login");
      return;
    }
    saveNoteMutation.mutate();
  }

  function handleResetCode() {
    if (!selectedLanguage || !problem.data) {
      return;
    }
    const starter =
      selectedLanguage.starterCode ?? selectedLanguage.version.starterTemplate ?? fallbackLegacyStarter(problem.data);
    setCode(starter);
  }

  if (problem.isLoading) {
    return <LoadingState label="Loading problem" />;
  }
  if (problem.isError) {
    return <ErrorState title="Could not load problem" error={problem.error} />;
  }
  if (!problem.data) {
    return <EmptyState title="Problem not found" />;
  }
  if (problemLanguages.isLoading) {
    return <LoadingState label="Loading languages" />;
  }
  if (problemLanguages.isError) {
    return <ErrorState title="Could not load languages" error={problemLanguages.error} />;
  }
  if (problemCapabilities.isLoading) {
    return <LoadingState label="Checking judge availability" />;
  }
  if (problemCapabilities.isError) {
    return <ErrorState title="Could not load judge availability" error={problemCapabilities.error} />;
  }
  if (executorHealth.isLoading) {
    return <LoadingState label="Checking judge health" />;
  }
  if (executorHealth.isError) {
    return <ErrorState title="Judge unavailable" error={executorHealth.error} />;
  }
  if (!selectedLanguage) {
    return <EmptyState title="No languages enabled" />;
  }
  if (!executableLanguageOptions.length) {
    return <EmptyState title="No executable languages are configured for this problem." />;
  }

  let panelClass =
    "rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col dark:border-white/10 dark:bg-[#111113]";
  if (fullscreen) {
    panelClass = "fixed inset-0 z-50 bg-white dark:bg-[#09090b]";
  }

  const filteredLanguageOptions = languageOptions.filter((option) => {
    const haystack = `${option.language.displayName} ${option.version.label} ${option.language.category}`.toLowerCase();
    return haystack.includes(languageSearch.toLowerCase());
  });

  let runResultStale = false;
  if (runResult && lastRunMeta) {
    if (
      lastRunMeta.code !== code ||
      lastRunMeta.languageKey !== selectedLanguageKey ||
      lastRunMeta.problemSlug !== slug
    ) {
      runResultStale = true;
    }
  }

  let customRunResultStale = false;
  if (customRunResult && lastCustomRunMeta) {
    if (
      lastCustomRunMeta.code !== code ||
      lastCustomRunMeta.languageKey !== selectedLanguageKey ||
      lastCustomRunMeta.problemSlug !== slug
    ) {
      customRunResultStale = true;
    }
  }

  const activeResultStale = isCustomInputActive ? customRunResultStale : runResultStale;
  const hasFreshRunResult = isCustomInputActive ? Boolean(customRunResult) : Boolean(runResult);
  const isRunning = runMutation.isPending || customRunMutation.isPending;

  let submissionResultStale = false;
  if (submission.data && lastSubmissionMeta) {
    if (
      lastSubmissionMeta.code !== code ||
      lastSubmissionMeta.languageKey !== selectedLanguageKey ||
      lastSubmissionMeta.problemSlug !== slug
    ) {
      submissionResultStale = true;
    }
  }

  const canRun = Boolean(capabilityByVersion.get(selectedLanguage.version.id)?.canRun);
  const canSubmit = Boolean(capabilityByVersion.get(selectedLanguage.version.id)?.canSubmit);
  const showMockWarning = shouldShowMockJudgeWarning(problemCapabilities.data?.executorMode);

  const leftTabs: Array<[LeftTab, string]> = [
    ["description", "Description"],
    ["editorial", "Editorial"],
    ["submissions", "Submissions"],
    ["discussion", "Discussion"],
    ["notes", "Notes"]
  ];

  let editorHeightClass = "h-[52vh] min-h-80";
  if (fullscreen) {
    editorHeightClass = "h-[calc(100vh-17rem)]";
  }

  let runBannerText = "Last run result";
  if (isRunning) {
    runBannerText = "Running fresh result...";
  } else if (activeResultStale) {
    runBannerText = "Code changed since last run";
  }

  let gridClass = "grid min-h-[calc(100vh-6rem)] gap-4 xl:grid-cols-[0.88fr_1.12fr]";
  if (fullscreen) {
    gridClass = "grid min-h-[calc(100vh-6rem)] gap-4 xl:grid-cols-1";
  }

  return (
    <div className={gridClass}>
      {!fullscreen ? (
        <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col dark:border-white/10 dark:bg-[#111113]">
          <div className="flex overflow-x-auto border-b border-slate-200/80 bg-slate-50/50 px-2 dark:border-white/10 dark:bg-white/5">
            {leftTabs.map(([key, label]) => {
              const isActive = leftTab === key;
              let tabClass = "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300";
              if (isActive) {
                tabClass = "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400";
              }
              return (
                <button
                  key={key}
                  className={`h-11 px-4 text-sm font-medium transition-colors ${tabClass}`}
                  onClick={() => setLeftTab(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-5">
            {leftTab === "description" ? <ProblemStatement problem={problem.data} /> : null}
            {leftTab === "editorial" ? <EditorialPanel content={editorial.data?.content} /> : null}
            {leftTab === "submissions" ? (
              <SubmissionsPanel submissions={recentSubmissions.data ?? []} slug={slug} />
            ) : null}
            {leftTab === "discussion" ? <DiscussionPanel discussions={discussions.data ?? []} slug={slug} /> : null}
            {leftTab === "notes" ? (
              <div className="space-y-3">
                <textarea
                  className="ca-textarea min-h-64 w-full"
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                />
                <Button disabled={!user || saveNoteMutation.isPending} onClick={handleSaveNote}>
                  <Save className="h-4 w-4" /> Save Note
                </Button>
                {saveNoteMutation.isError ? (
                  <ErrorState title="Could not save note" error={saveNoteMutation.error} />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="ca-input w-40"
              placeholder="Search language"
              value={languageSearch}
              onChange={(event) => setLanguageSearch(event.target.value)}
            />
            <select
              className="ca-input min-w-56"
              value={selectedLanguageKey}
              onChange={(event) => setSelectedLanguageKey(event.target.value)}
            >
              {Object.entries(groupLanguageOptions(filteredLanguageOptions)).map(([category, options]) => (
                <optgroup key={category} label={category.replace(/_/g, " ")}>
                  {options.map((option) => {
                    const optionKey = `${option.language.id}:${option.version.id}`;
                    const cap = capabilityByVersion.get(option.version.id);
                    const canRunOption = Boolean(cap?.canRun);
                    let optionLabel = `${option.language.displayName} - ${option.version.label}`;
                    if (!canRunOption) {
                      optionLabel = optionLabel + " - Not available in current judge environment";
                    }
                    return (
                      <option
                        key={optionKey}
                        value={optionKey}
                        disabled={!canRunOption}
                        title={cap?.reason ?? undefined}
                      >
                        {optionLabel}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Font
              <input
                className="ca-input w-20"
                type="number"
                min={12}
                max={22}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </label>
            <Button variant="ghost" onClick={handleResetCode}>
              <RefreshCcw className="h-4 w-4" /> Reset
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setFullscreen((value) => !value)}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              disabled={!user || !canRun || runMutation.isPending || customRunMutation.isPending}
              onClick={runCurrent}
            >
              <Play className="h-4 w-4" /> {isRunning ? "Running..." : "Run"}
            </Button>
            <Button disabled={!user || !canSubmit || submitMutation.isPending} onClick={handleSubmitClick}>
              <Send className="h-4 w-4" /> {submitMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
            <Button variant="secondary" onClick={() => bookmarkMutation.mutate()}>
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showMockWarning ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Mock judge mode. Results are deterministic demo/test simulations, not production sandbox execution.
          </div>
        ) : null}

        <div className={editorHeightClass}>
          <CodeEditor
            language={selectedLanguage.language.monacoId}
            code={code}
            fontSize={fontSize}
            onChange={setCode}
          />
        </div>

        {runMutation.isError ? (
          <div className="px-4 pt-4">
            <ErrorState title="Run failed" error={runMutation.error} />
          </div>
        ) : null}
        {customRunMutation.isError ? (
          <div className="px-4 pt-4">
            <ErrorState title="Custom run failed" error={customRunMutation.error} />
          </div>
        ) : null}
        {submitMutation.isError ? (
          <div className="px-4 pt-4">
            <ErrorState title="Submit failed" error={submitMutation.error} />
          </div>
        ) : null}

        {submissionId ? (
          <div className="px-4 pt-4">
            <SubmissionLiveStatusBanner
              event={liveUpdates.event}
              status={submission.data?.status}
              connectionState={liveUpdates.connectionState}
            />
          </div>
        ) : null}

        {submission.isError ? (
          <div className="px-4 pt-4">
            <ErrorState title="Submission refresh failed" error={submission.error} />
          </div>
        ) : null}

        {submission.data ? (
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center gap-2">
              <VerdictBadge status={submission.data.status} />
              <Link className="text-sm text-accent-600" to={`/submissions/${submission.data.id}`}>
                View full result
              </Link>
            </div>
            {submissionResultStale ? (
              <p className="mb-3 text-xs font-medium text-amber-600">Code changed since this submission</p>
            ) : null}
            <ResultPanel submission={submission.data} />
          </div>
        ) : null}

        {isRunning || hasFreshRunResult ? (
          <div className="border-t border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 dark:border-slate-800">
            {runBannerText}
          </div>
        ) : null}

        <TestCasePanel
          testCases={sampleCases}
          activeCase={activeCase}
          onActiveCaseChange={setActiveCase}
          result={runResult}
          customInput={customInput}
          onCustomInputChange={setCustomInput}
          customResult={customRunResult}
        />
      </section>
    </div>
  );
}

function languagePayload<T extends { code: string }>(option: ProblemLanguageOption, payload: T) {
  return {
    ...payload,
    languageId: option.language.id,
    languageVersionId: option.version.id,
    languageKey: option.language.key,
    version: option.version.version
  };
}

function groupLanguageOptions(options: ProblemLanguageOption[]): Record<string, ProblemLanguageOption[]> {
  const groups: Record<string, ProblemLanguageOption[]> = {};
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const category = option.language.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(option);
  }
  return groups;
}

function fallbackLegacyStarter(problem: { starterCode?: StarterCode }): string {
  if (problem.starterCode?.PYTHON) {
    return problem.starterCode.PYTHON;
  }
  const values = Object.values(problem.starterCode ?? {});
  if (values.length > 0) {
    return values[0];
  }
  return "";
}

function EditorialPanel({ content }: { content?: string }) {
  if (!content) {
    return <EmptyState title="No editorial published yet" />;
  }
  return <div className="text-sm leading-6 text-slate-700 dark:text-slate-300">{content}</div>;
}

function SubmissionsPanel({
  submissions,
  slug
}: {
  submissions: Array<{
    id: string;
    status: string;
    language: "CPP" | "JAVA" | "PYTHON" | "JAVASCRIPT";
    languageNameSnapshot?: string | null;
    languageVersionSnapshot?: string | null;
    problem?: { slug: string; title: string };
    createdAt: string;
  }>;
  slug: string;
}) {
  const filtered = [];
  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];
    if (!submission.problem || submission.problem.slug === slug) {
      filtered.push(submission);
    }
  }

  const visible = filtered.slice(0, 8);

  return (
    <div className="space-y-2">
      {visible.map((submission) => (
        <Link
          key={submission.id}
          to={`/submissions/${submission.id}`}
          className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
        >
          <span className="font-mono text-xs">{submission.id.slice(0, 8)}</span>
          <span>{submissionLanguageLabel(submission)}</span>
          <span>{submission.status.replace(/_/g, " ")}</span>
        </Link>
      ))}
      {!filtered.length ? <EmptyState title="No submissions for this problem yet" /> : null}
    </div>
  );
}

function DiscussionPanel({
  discussions,
  slug
}: {
  discussions: Array<{ id: string; title: string; content: string; comments: unknown[] }>;
  slug: string;
}) {
  const visible = discussions.slice(0, 6);

  return (
    <div className="space-y-3">
      <Link to={`/problems/${slug}/discussions`} className="inline-flex items-center gap-2 text-sm text-accent-600">
        <MessageSquare className="h-4 w-4" /> Open discussion page
      </Link>
      {visible.map((discussion) => (
        <div key={discussion.id} className="ca-muted-panel p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent-600" />
            <p className="font-medium">{discussion.title}</p>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{discussion.content}</p>
          <p className="mt-2 text-xs text-slate-500">{discussion.comments.length} comments</p>
        </div>
      ))}
      {!discussions.length ? <EmptyState title="No discussions yet" /> : null}
    </div>
  );
}
