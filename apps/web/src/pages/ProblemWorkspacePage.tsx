import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Bookmark,
  FileText,
  Flag,
  Maximize2,
  MessageSquare,
  Play,
  RefreshCcw,
  Save,
  Send,
  Settings,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import { contestsApi, executorApi, problemsApi, reportsApi, socialApi, solutionsApi, submissionsApi } from "../services/api";
import type {
  CustomRunResult,
  Editorial,
  Problem,
  ProblemLanguageOption,
  RunResult,
  Solution,
  StarterCode,
  Submission
} from "../types/api";
import { Button } from "../components/Button";
import { CodeEditor } from "../components/CodeEditor";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
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

type LeftTab = "description" | "editorial" | "submissions" | "solutions" | "discussion" | "notes";
const leftTabs = new Set<LeftTab>(["description", "editorial", "submissions", "solutions", "discussion", "notes"]);

export function ProblemWorkspacePage() {
  const { slug = "", id: contestId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const solutions = useQuery({
    queryKey: ["problem-solutions", slug],
    queryFn: () => solutionsApi.listProblem(slug, { limit: "50" }),
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
  const [fontSize, setFontSize] = useState(() => readNumberSetting("codearena:editor:font-size", 14));
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "light" | "hc-black">(() =>
    readThemeSetting("codearena:editor:theme", "vs-dark")
  );
  const [tabSize, setTabSize] = useState(() => readNumberSetting("codearena:editor:tab-size", 2));
  const [wordWrap, setWordWrap] = useState(() => readBooleanSetting("codearena:editor:word-wrap", true));
  const [minimap, setMinimap] = useState(() => readBooleanSetting("codearena:editor:minimap", false));
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(42);
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
  const [attemptedViaRun, setAttemptedViaRun] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (isLeftTab(tab)) {
      setLeftTab(tab);
    }
  }, [searchParams]);

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
    queryFn: () => submissionsApi.list({ problemSlug: slug }),
    enabled: Boolean(user && slug)
  });

  const contest = useQuery({
    queryKey: ["workspace-contest", contestId],
    queryFn: () => contestsApi.get(contestId!),
    enabled: Boolean(contestId)
  });

  const primaryTag = problem.data?.tags[0]?.slug;
  const similarProblems = useQuery({
    queryKey: ["similar-problems", slug, primaryTag],
    queryFn: () => problemsApi.list({ tag: primaryTag!, limit: "8" }),
    enabled: Boolean(primaryTag)
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
      setLastAutosavedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      );
    }
  }, [code, draftKey]);

  useEffect(() => {
    window.localStorage.setItem("codearena:editor:font-size", String(fontSize));
    window.localStorage.setItem("codearena:editor:theme", editorTheme);
    window.localStorage.setItem("codearena:editor:tab-size", String(tabSize));
    window.localStorage.setItem("codearena:editor:word-wrap", String(wordWrap));
    window.localStorage.setItem("codearena:editor:minimap", String(minimap));
  }, [editorTheme, fontSize, minimap, tabSize, wordWrap]);

  useEffect(() => {
    setRunResult(null);
    setCustomRunResult(null);
    setLastRunMeta(null);
    setLastCustomRunMeta(null);
    setLastSubmissionMeta(null);
    setSubmissionId(null);
    setAttemptedViaRun(false);
    setQueuePosition(null);
  }, [selectedLanguageKey, slug]);

  useEffect(() => {
    setNoteContent(note.data?.content ?? "");
  }, [note.data?.content]);

  const runMutation = useMutation({
    mutationFn: (input: { option: ProblemLanguageOption; codeSnapshot: string; languageKeySnapshot: string }) => {
      const payload = languagePayload(input.option, {
        problemSlug: slug,
        code: input.codeSnapshot,
        testCaseId: sampleCases[activeCase]?.id
      });
      return submissionsApi.run(payload);
    },
    onMutate: () => {
      setRunResult(null);
      setLastRunMeta(null);
    },
    onSuccess: (result, input) => {
      setAttemptedViaRun(true);
      queryClient.invalidateQueries({ queryKey: ["problem", slug] });
      queryClient.invalidateQueries({ queryKey: ["editorial", slug] });
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
        code: input.codeSnapshot,
        ...(contestId && contest.data?.status === "LIVE" ? { contestId } : {})
      });
      return submissionsApi.submit(payload);
    },
    onMutate: () => {
      setSubmissionId(null);
      setQueuePosition(null);
      setLastSubmissionMeta(null);
    },
    onSuccess: (data, input) => {
      setSubmissionId(data.submissionId);
      setQueuePosition(data.queuePosition ?? null);
      queryClient.invalidateQueries({ queryKey: ["problem", slug] });
      queryClient.invalidateQueries({ queryKey: ["editorial", slug] });
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

  function handlePanelResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    function handleMove(pointerEvent: PointerEvent) {
      const rawPercent = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
      const next = Math.min(58, Math.max(32, rawPercent));
      setLeftPanelWidth(next);
    }

    function handleUp() {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
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
    "rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col dark:border-white/10 dark:bg-[#111113] xl:min-w-0 xl:flex-1";
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
  const submitBlockedByContest = Boolean(contestId && (!contest.data || contest.data.status === "UPCOMING"));
  const canSubmit = Boolean(capabilityByVersion.get(selectedLanguage.version.id)?.canSubmit) && !submitBlockedByContest;
  const showMockWarning = shouldShowMockJudgeWarning(problemCapabilities.data?.executorMode);
  const hasAttemptedProblem = Boolean(
    attemptedViaRun ||
      submissionId ||
      recentSubmissions.data?.length ||
      (problem.data?.status && problem.data.status !== "NOT_ATTEMPTED")
  );
  const editorialLocked = !user || (!recentSubmissions.isLoading && !hasAttemptedProblem);

  const leftTabItems: Array<[LeftTab, string]> = [
    ["description", "Description"],
    ["editorial", "Editorial"],
    ["submissions", "Submissions"],
    ["solutions", "Solutions"],
    ["discussion", "Discuss"],
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

  let gridClass = "flex min-h-[calc(100vh-6rem)] flex-col gap-4 xl:flex-row";
  let gridStyle: CSSProperties | undefined = {
    "--left-panel-width": `${leftPanelWidth}%`
  } as CSSProperties;
  if (fullscreen) {
    gridClass = "grid min-h-[calc(100vh-6rem)] gap-4 xl:grid-cols-1";
    gridStyle = undefined;
  }

  return (
    <div className={gridClass} style={gridStyle}>
      {!fullscreen ? (
        <section className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#111113] xl:w-[var(--left-panel-width)] xl:min-w-[22rem] xl:max-w-[60rem] xl:shrink-0">
          <div className="flex overflow-x-auto border-b border-slate-200/80 bg-slate-50/50 px-2 dark:border-white/10 dark:bg-white/5">
            {leftTabItems.map(([key, label]) => {
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
            {leftTab === "editorial" ? (
              <EditorialPanel
                editorial={editorial.data}
                locked={editorialLocked}
                checkingAccess={Boolean(user && recentSubmissions.isLoading)}
                similarProblems={(similarProblems.data ?? []).filter((item) => item.slug !== slug).slice(0, 5)}
              />
            ) : null}
            {leftTab === "submissions" ? (
              <SubmissionsPanel submissions={recentSubmissions.data ?? []} slug={slug} />
            ) : null}
            {leftTab === "solutions" ? (
              <SolutionsPanel
                slug={slug}
                submissions={recentSubmissions.data ?? []}
                solutions={solutions.data ?? []}
                loading={solutions.isLoading}
                error={solutions.error}
              />
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

      {!fullscreen ? (
        <button
          type="button"
          aria-label="Resize panels"
          className="hidden w-1 cursor-col-resize rounded-full bg-slate-200 transition-colors hover:bg-emerald-400 dark:bg-slate-800 dark:hover:bg-emerald-500 xl:block"
          onPointerDown={handlePanelResizeStart}
        />
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
            <label className="flex items-center gap-2 text-sm text-slate-500">
              <Settings className="h-4 w-4" />
              <select
                className="ca-input w-32"
                value={editorTheme}
                onChange={(event) => setEditorTheme(event.target.value as "vs-dark" | "light" | "hc-black")}
              >
                <option value="vs-dark">Dark</option>
                <option value="light">Light</option>
                <option value="hc-black">Contrast</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Tab
              <input
                className="ca-input w-16"
                type="number"
                min={2}
                max={8}
                value={tabSize}
                onChange={(event) => setTabSize(Number(event.target.value))}
              />
            </label>
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
              <input type="checkbox" checked={wordWrap} onChange={(event) => setWordWrap(event.target.checked)} />
              Wrap
            </label>
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
              <input type="checkbox" checked={minimap} onChange={(event) => setMinimap(event.target.checked)} />
              Minimap
            </label>
            <span className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-500 dark:bg-white/10">
              <Save className="h-3.5 w-3.5" />
              {lastAutosavedAt ? `Saved ${lastAutosavedAt}` : "Autosave"}
            </span>
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
              <Play className="h-4 w-4" /> {isRunning ? "Running..." : isCustomInputActive ? "Run Custom" : "Run Case"}
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

        {contestId ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {contest.data?.status === "LIVE"
              ? "Contest mode. Official submits count toward this contest."
              : contest.data?.status === "ENDED"
                ? "Upsolve mode. Submissions are saved as normal practice attempts."
                : "Contest has not started. You can run samples, but official submit is locked."}
          </div>
        ) : null}

        <div className={editorHeightClass}>
          <CodeEditor
            language={selectedLanguage.language.monacoId}
            code={code}
            fontSize={fontSize}
            theme={editorTheme}
            tabSize={tabSize}
            wordWrap={wordWrap}
            minimap={minimap}
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
            {queuePosition !== null ? (
              <p className="mb-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Queue position approximately {queuePosition}.
              </p>
            ) : null}
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

function readNumberSetting(key: string, fallback: number): number {
  const value = Number(window.localStorage.getItem(key));
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function readBooleanSetting(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readThemeSetting(key: string, fallback: "vs-dark" | "light" | "hc-black") {
  const value = window.localStorage.getItem(key);
  if (value === "vs-dark" || value === "light" || value === "hc-black") {
    return value;
  }
  return fallback;
}

function isLeftTab(value: string | null): value is LeftTab {
  return Boolean(value && leftTabs.has(value as LeftTab));
}

function EditorialPanel({
  editorial,
  locked,
  checkingAccess,
  similarProblems
}: {
  editorial?: Editorial | null;
  locked: boolean;
  checkingAccess: boolean;
  similarProblems: Problem[];
}) {
  if (checkingAccess) {
    return <LoadingState label="Checking editorial access" />;
  }
  if (locked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">Editorial locked</p>
        <p className="mt-1">Submit an attempt on this problem to unlock the official explanation.</p>
      </div>
    );
  }
  if (!editorial?.content && !editorial?.sections?.length && !editorial?.officialSolutions?.length) {
    return <EmptyState title="No editorial published yet" />;
  }
  const sections = [...(editorial.sections ?? [])].sort((left, right) => left.order - right.order);
  const officialSolutions = [...(editorial.officialSolutions ?? [])].sort((left, right) => left.order - right.order);
  return (
    <div className="space-y-5">
      {editorial.content ? <MarkdownRenderer content={editorial.content} /> : null}
      {sections.length ? (
        <div className="space-y-3">
          {sections.map((section) => (
            <EditorialSectionBlock key={section.id} section={section} />
          ))}
        </div>
      ) : null}
      {officialSolutions.length ? (
        <div className="border-t border-slate-100 pt-4 dark:border-white/10">
          <h3 className="font-semibold">Official Solutions</h3>
          <div className="mt-3 space-y-3">
            {officialSolutions.map((solution) => (
              <div key={solution.id} className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{solution.language}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {solution.timeComplexity ? <span>Time {solution.timeComplexity}</span> : null}
                    {solution.spaceComplexity ? <span>Space {solution.spaceComplexity}</span> : null}
                  </div>
                </div>
                {solution.explanation ? (
                  <div className="mt-3 text-sm">
                    <MarkdownRenderer content={solution.explanation} />
                  </div>
                ) : null}
                <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                  <code>{solution.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {similarProblems.length ? (
        <div className="border-t border-slate-100 pt-4 dark:border-white/10">
          <h3 className="font-semibold">Similar Problems</h3>
          <div className="mt-3 grid gap-2">
            {similarProblems.map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-white/10"
              >
                <span>{problem.title}</span>
                <span className="text-xs font-medium text-slate-500">{problem.difficulty}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditorialSectionBlock({ section }: { section: NonNullable<Editorial["sections"]>[number] }) {
  if (section.type === "HINT") {
    return (
      <details className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
        <summary className="cursor-pointer font-semibold text-amber-800 dark:text-amber-200">{section.title}</summary>
        <div className="mt-3 text-slate-700 dark:text-slate-300">
          <MarkdownRenderer content={section.content} />
        </div>
      </details>
    );
  }

  if (section.type === "COMPLEXITY") {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/20">
        <p className="font-semibold text-blue-800 dark:text-blue-200">{section.title}</p>
        <div className="mt-2 text-slate-700 dark:text-slate-300">
          <MarkdownRenderer content={section.content} />
        </div>
      </div>
    );
  }

  if (section.type === "DIAGRAM") {
    return (
      <figure className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
        <figcaption className="font-semibold">{section.title}</figcaption>
        <div className="mt-3 text-sm">
          <MarkdownRenderer content={section.content} />
        </div>
      </figure>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{section.title}</h3>
      <MarkdownRenderer content={section.content} />
    </section>
  );
}

function SolutionsPanel({
  slug,
  submissions,
  solutions,
  loading,
  error
}: {
  slug: string;
  submissions: Submission[];
  solutions: Solution[];
  loading: boolean;
  error: Error | null;
}) {
  const queryClient = useQueryClient();
  const voteSolution = useMutation({
    mutationFn: (input: { id: string; value: 1 | -1 }) => solutionsApi.vote(input.id, input.value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problem-solutions", slug] });
    }
  });
  const reportSolution = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      reportsApi.create({ targetType: "SOLUTION", targetId: input.id, reason: input.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problem-solutions", slug] });
    }
  });
  const accepted = submissions.filter((submission) => submission.status === "ACCEPTED").slice(0, 8);
  const communitySolutions = solutions.slice(0, 12);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Your Accepted Submissions</h3>
        <div className="mt-3 space-y-3">
          {accepted.map((submission) => (
            <Link
              key={submission.id}
              to={`/submissions/${submission.id}`}
              className="block rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 transition-colors hover:bg-slate-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs text-slate-500">{submission.id.slice(0, 8)}</p>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Accepted</span>
              </div>
              <p className="mt-2 text-sm font-medium">{submissionLanguageLabel(submission)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {submission.runtimeMs ?? "-"} ms / {submission.memoryKb ?? "-"} KB
              </p>
            </Link>
          ))}
          {!accepted.length ? <EmptyState title="No accepted submissions yet" /> : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Community Solutions</h3>
        {loading ? <LoadingState label="Loading solutions" /> : null}
        {error ? <ErrorState title="Could not load solutions" error={error} /> : null}
        <div className="mt-3 space-y-3">
          {communitySolutions.map((solution) => (
            <div
              key={solution.id}
              className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{solution.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {solution.author?.displayName ?? "Community"} - {solution.language}
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 dark:bg-white/10">
                  {solution.visibility.toLowerCase()}
                </span>
              </div>
              <div className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                <MarkdownRenderer content={solution.content} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Button
                  variant="ghost"
                  disabled={voteSolution.isPending}
                  onClick={() => voteSolution.mutate({ id: solution.id, value: 1 })}
                >
                  <ThumbsUp className="h-4 w-4" /> {solution.upvotes}
                </Button>
                <Button
                  variant="ghost"
                  disabled={voteSolution.isPending}
                  onClick={() => voteSolution.mutate({ id: solution.id, value: -1 })}
                >
                  <ThumbsDown className="h-4 w-4" /> {solution.downvotes}
                </Button>
                {solution.timeComplexity ? <span>Time {solution.timeComplexity}</span> : null}
                {solution.spaceComplexity ? <span>Space {solution.spaceComplexity}</span> : null}
                <Button
                  variant="ghost"
                  disabled={reportSolution.isPending}
                  onClick={() => {
                    const reason = window.prompt("Report reason");
                    if (reason?.trim()) {
                      reportSolution.mutate({ id: solution.id, reason: reason.trim() });
                    }
                  }}
                >
                  <Flag className="h-4 w-4" /> Report
                </Button>
              </div>
            </div>
          ))}
          {reportSolution.isError ? <p className="text-sm font-medium text-rose-600">{reportSolution.error.message}</p> : null}
          {!loading && !communitySolutions.length ? (
            <EmptyState
              title="No shared solutions yet"
              body="Accepted submissions can be shared from the submission detail page."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
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
