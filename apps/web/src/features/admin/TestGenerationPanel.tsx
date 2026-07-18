import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Beaker, Database, ListChecks, Play, Save, Send, ShieldCheck, Trash2 } from "lucide-react";
import { adminApi } from "../../services/api";
import type {
  CheckerMode,
  CheckerPreviewResult,
  CodeLanguage,
  GenerationPreview,
  Problem,
  ProblemAssetType
} from "../../types/api";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/State";
import { assetLabel, assetTypes, defaultAssetFilename, defaultAssetSource } from "./assetDefaults";
import { Checkbox, NumberInput, PanelTitle, TextArea, TextInput } from "./formFields";
import { defaultVersion } from "./starterCode";

interface TestGenerationPanelProps {
  problems: Problem[];
  languages: CodeLanguage[];
  onRefreshProblems: () => void;
  onToast: (message: string) => void;
}

export function TestGenerationPanel({ problems, languages, onRefreshProblems, onToast }: TestGenerationPanelProps) {
  const [problemId, setProblemId] = useState("");
  const selectedProblemId = problemId || problems[0]?.id || "";
  const selectedProblem = problems.find((problem) => problem.id === selectedProblemId);
  const [assetType, setAssetType] = useState<ProblemAssetType>("GENERATOR");
  const [languageId, setLanguageId] = useState("");
  const activeLanguage = languages.find((language) => language.id === languageId) ?? languages[0];
  const [languageVersionId, setLanguageVersionId] = useState("");
  const activeVersion =
    activeLanguage?.versions.find((version) => version.id === languageVersionId && version.isActive) ??
    defaultVersion(activeLanguage);
  const [filename, setFilename] = useState("generator.py");
  const [sourceCode, setSourceCode] = useState(defaultAssetSource("GENERATOR"));
  const [checkerMode, setCheckerMode] = useState<CheckerMode>("STANDARD");
  const [checkerPreviewInput, setCheckerPreviewInput] = useState({
    input: "1 2 3\n",
    expectedOutput: "1 2 3\n",
    actualOutput: "3 2 1\n"
  });
  const [checkerPreviewResult, setCheckerPreviewResult] = useState<CheckerPreviewResult | null>(null);
  const [previewSeed, setPreviewSeed] = useState(1);
  const [previewResult, setPreviewResult] = useState<GenerationPreview | null>(null);
  const [jobForm, setJobForm] = useState({
    batchName: "Generated hidden tests",
    visibility: "HIDDEN" as "SAMPLE" | "HIDDEN",
    seedStart: 1,
    count: 10,
    runValidator: false,
    replaceExistingGenerated: false,
    skipDuplicates: true
  });

  const assets = useQuery({
    queryKey: ["admin-problem-assets", selectedProblemId],
    queryFn: () => adminApi.problemAssets(selectedProblemId),
    enabled: Boolean(selectedProblemId)
  });
  const jobs = useQuery({
    queryKey: ["admin-test-generation-jobs", selectedProblemId],
    queryFn: () => adminApi.testGenerationJobs(selectedProblemId),
    enabled: Boolean(selectedProblemId),
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === "PENDING" || job.status === "RUNNING") ? 2500 : false
  });
  const batches = useQuery({
    queryKey: ["admin-testcase-batches", selectedProblemId],
    queryFn: () => adminApi.testcaseBatches(selectedProblemId),
    enabled: Boolean(selectedProblemId)
  });

  const activeAsset = assets.data?.find((asset) => asset.type === assetType && asset.isActive);

  useEffect(() => {
    setCheckerMode(selectedProblem?.checkerMode ?? "STANDARD");
    setCheckerPreviewResult(null);
  }, [selectedProblem?.checkerMode, selectedProblemId]);

  useEffect(() => {
    if (!selectedProblemId) return;
    const existing = assets.data?.find((asset) => asset.type === assetType && asset.isActive);
    if (existing) {
      setLanguageId(existing.languageId ?? "");
      setLanguageVersionId(existing.languageVersionId ?? "");
      setFilename(existing.filename);
      setSourceCode(existing.sourceCode);
      return;
    }
    const language = languages[0];
    const version = defaultVersion(language);
    setLanguageId(language?.id ?? "");
    setLanguageVersionId(version?.id ?? "");
    setFilename(defaultAssetFilename(assetType, language));
    setSourceCode(defaultAssetSource(assetType));
  }, [assetType, assets.data, languages, selectedProblemId]);

  useEffect(() => {
    if (!activeLanguage) return;
    const version = defaultVersion(activeLanguage);
    if (!activeLanguage.versions.some((item) => item.id === languageVersionId && item.isActive)) {
      setLanguageVersionId(version?.id ?? "");
    }
  }, [activeLanguage, languageVersionId]);

  const saveAsset = useMutation({
    mutationFn: async () => {
      if (!selectedProblemId) throw new Error("Choose a problem first");
      if (!activeLanguage || !activeVersion) throw new Error("Choose an executable language version first");
      const payload = {
        type: assetType,
        languageId: activeLanguage.id,
        languageVersionId: activeVersion.id,
        filename,
        sourceCode
      };
      return activeAsset
        ? adminApi.updateProblemAsset(activeAsset.id, payload)
        : adminApi.createProblemAsset(selectedProblemId, payload);
    },
    onSuccess: () => {
      onToast(`${assetLabel(assetType)} saved`);
      void assets.refetch();
    }
  });

  const updateCheckerMode = useMutation({
    mutationFn: () => adminApi.updateCheckerMode(selectedProblemId, checkerMode),
    onSuccess: () => {
      onToast("Checker mode updated");
      onRefreshProblems();
    }
  });

  const previewChecker = useMutation({
    mutationFn: () => adminApi.previewChecker(selectedProblemId, checkerPreviewInput),
    onSuccess: (result) => {
      setCheckerPreviewResult(result);
      onToast("Checker preview ready");
    }
  });

  const preview = useMutation({
    mutationFn: () =>
      adminApi.previewTestGeneration(selectedProblemId, {
        seed: previewSeed,
        runValidator: jobForm.runValidator
      }),
    onSuccess: (result) => {
      setPreviewResult(result);
      onToast("Generated preview ready");
    }
  });

  const createGenerationJob = useMutation({
    mutationFn: () =>
      adminApi.createTestGenerationJob(selectedProblemId, {
        ...jobForm,
        seedEnd: jobForm.seedStart + jobForm.count - 1,
        inputMode: "STDIN"
      }),
    onSuccess: () => {
      onToast("Test generation job queued");
      void jobs.refetch();
      void batches.refetch();
    }
  });

  const cancelJob = useMutation({
    mutationFn: (jobId: string) => adminApi.cancelTestGenerationJob(jobId),
    onSuccess: () => {
      onToast("Generation job cancelled");
      void jobs.refetch();
    }
  });

  const deleteBatch = useMutation({
    mutationFn: (batchId: string) => adminApi.deleteTestcaseBatch(batchId),
    onSuccess: () => {
      onToast("Generated batch deleted");
      void batches.refetch();
      void jobs.refetch();
    }
  });

  return (
    <section className="ca-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PanelTitle icon={Beaker} title="Generated Test Cases" />
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage generator, reference, validator, and checker assets, then queue reproducible hidden or sample tests.
          </p>
        </div>
        <select
          className="ca-input min-w-64"
          value={selectedProblemId}
          onChange={(event) => setProblemId(event.target.value)}
        >
          {problems.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
            </option>
          ))}
        </select>
      </div>

      {!problems.length ? (
        <p className="mt-4 text-sm text-slate-500">Create or load a problem before generating test cases.</p>
      ) : null}
      {assets.isError ? <ErrorState title="Could not load problem assets" error={assets.error} /> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {assetTypes.map((type) => {
              const hasActive = assets.data?.some((asset) => asset.type === type && asset.isActive);
              return (
                <button
                  key={type}
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm ${
                    assetType === type
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                  onClick={() => setAssetType(type)}
                >
                  {assetLabel(type)} {hasActive ? "ready" : "missing"}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Language</span>
              <select
                className="ca-input mt-1 w-full"
                value={activeLanguage?.id ?? ""}
                onChange={(event) => setLanguageId(event.target.value)}
              >
                {languages.map((language) => (
                  <option key={language.id} value={language.id}>
                    {language.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Version</span>
              <select
                className="ca-input mt-1 w-full"
                value={activeVersion?.id ?? ""}
                onChange={(event) => setLanguageVersionId(event.target.value)}
              >
                {(activeLanguage?.versions ?? [])
                  .filter((version) => version.isActive)
                  .map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <TextInput label="Asset file name" value={filename} onChange={setFilename} />
          <TextArea
            label={`${assetLabel(assetType)} source`}
            value={sourceCode}
            onChange={setSourceCode}
            rows={12}
            mono
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={saveAsset.isPending || !selectedProblemId} onClick={() => saveAsset.mutate()}>
              <Save className="h-4 w-4" /> Save Asset
            </Button>
            <NumberInput label="Preview seed" value={previewSeed} onChange={setPreviewSeed} />
            <Button
              variant="secondary"
              disabled={preview.isPending || !selectedProblemId}
              onClick={() => preview.mutate()}
            >
              <Play className="h-4 w-4" /> Preview
            </Button>
          </div>
          {saveAsset.isError ? <ErrorState title="Could not save asset" error={saveAsset.error} /> : null}
          {preview.isError ? <ErrorState title="Preview failed" error={preview.error} /> : null}
          {previewResult ? (
            <div className="grid gap-3 md:grid-cols-2">
              <pre className="min-h-24 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                {previewResult.generatedInput}
              </pre>
              <pre className="min-h-24 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                {previewResult.expectedOutput}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="ca-muted-panel p-4">
            <PanelTitle icon={ShieldCheck} title="Checker Mode" />
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="block text-sm">
                <span className="font-medium">Official judging</span>
                <select
                  className="ca-input mt-1 w-full"
                  value={checkerMode}
                  onChange={(event) => setCheckerMode(event.target.value as CheckerMode)}
                >
                  <option value="STANDARD">Standard output comparison</option>
                  <option value="CUSTOM_CHECKER">Custom checker</option>
                </select>
              </label>
              <Button
                className="self-end"
                disabled={updateCheckerMode.isPending || !selectedProblemId}
                onClick={() => updateCheckerMode.mutate()}
              >
                <Save className="h-4 w-4" /> Save Mode
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Custom checkers run in the judge sandbox. Enable them only after previewing the checker against accepted
              and rejected outputs.
            </p>
            {updateCheckerMode.isError ? (
              <ErrorState title="Could not update checker mode" error={updateCheckerMode.error} />
            ) : null}

            <div className="mt-4">
              <PanelTitle icon={Play} title="Checker Preview" />
              <TextArea
                label="Input"
                value={checkerPreviewInput.input}
                onChange={(value) => setCheckerPreviewInput((current) => ({ ...current, input: value }))}
                rows={3}
                mono
              />
              <TextArea
                label="Expected output"
                value={checkerPreviewInput.expectedOutput}
                onChange={(value) => setCheckerPreviewInput((current) => ({ ...current, expectedOutput: value }))}
                rows={3}
                mono
              />
              <TextArea
                label="Actual output"
                value={checkerPreviewInput.actualOutput}
                onChange={(value) => setCheckerPreviewInput((current) => ({ ...current, actualOutput: value }))}
                rows={3}
                mono
              />
              <Button
                variant="secondary"
                className="mt-3"
                disabled={previewChecker.isPending || !selectedProblemId}
                onClick={() => previewChecker.mutate()}
              >
                <Play className="h-4 w-4" /> Run Checker
              </Button>
              {previewChecker.isError ? (
                <ErrorState title="Checker preview failed" error={previewChecker.error} />
              ) : null}
              {checkerPreviewResult ? (
                <div className="mt-3 rounded-md bg-white p-3 text-sm dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{checkerPreviewResult.verdict}</span>
                    <span className="text-xs text-slate-500">
                      {checkerPreviewResult.runtimeMs} ms / {checkerPreviewResult.memoryKb} KB
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{checkerPreviewResult.message}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ca-muted-panel p-4">
            <PanelTitle icon={Database} title="Queue Batch" />
            <TextInput
              label="Batch name"
              value={jobForm.batchName}
              onChange={(value) => setJobForm((current) => ({ ...current, batchName: value }))}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <NumberInput
                label="Seed start"
                value={jobForm.seedStart}
                onChange={(value) => setJobForm((current) => ({ ...current, seedStart: value }))}
              />
              <NumberInput
                label="Case count"
                value={jobForm.count}
                onChange={(value) => setJobForm((current) => ({ ...current, count: value }))}
              />
              <label className="block text-sm">
                <span className="font-medium">Visibility</span>
                <select
                  className="ca-input mt-1 w-full"
                  value={jobForm.visibility}
                  onChange={(event) =>
                    setJobForm((current) => ({
                      ...current,
                      visibility: event.target.value as "SAMPLE" | "HIDDEN"
                    }))
                  }
                >
                  <option value="HIDDEN">Hidden</option>
                  <option value="SAMPLE">Sample</option>
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <Checkbox
                label="Run validator"
                checked={jobForm.runValidator}
                onChange={(value) => setJobForm((current) => ({ ...current, runValidator: value }))}
              />
              <Checkbox
                label="Replace generated"
                checked={jobForm.replaceExistingGenerated}
                onChange={(value) => setJobForm((current) => ({ ...current, replaceExistingGenerated: value }))}
              />
              <Checkbox
                label="Skip duplicates"
                checked={jobForm.skipDuplicates}
                onChange={(value) => setJobForm((current) => ({ ...current, skipDuplicates: value }))}
              />
            </div>
            <Button
              className="mt-4"
              disabled={createGenerationJob.isPending || !selectedProblemId}
              onClick={() => createGenerationJob.mutate()}
            >
              <Send className="h-4 w-4" /> Queue Generation
            </Button>
            {createGenerationJob.isError ? (
              <ErrorState title="Could not queue generation" error={createGenerationJob.error} />
            ) : null}
          </div>

          <div className="ca-muted-panel p-4">
            <PanelTitle icon={ListChecks} title="Generation Jobs" />
            <div className="mt-3 space-y-2">
              {(jobs.data ?? []).slice(0, 6).map((job) => (
                <div key={job.id} className="rounded-md bg-white p-3 text-sm dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{job.config.batchName}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-900">{job.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {job.generatedCases}/{job.totalCases} cases - seeds {job.config.seedStart} to {job.config.seedEnd}
                  </p>
                  {job.errorMessage ? <p className="mt-1 text-xs text-rose-600">{job.errorMessage}</p> : null}
                  {job.status === "PENDING" || job.status === "RUNNING" ? (
                    <Button
                      className="mt-2"
                      variant="secondary"
                      disabled={cancelJob.isPending}
                      onClick={() => cancelJob.mutate(job.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ))}
              {!jobs.data?.length ? (
                <p className="text-sm text-slate-500">No generation jobs for this problem.</p>
              ) : null}
            </div>
          </div>

          <div className="ca-muted-panel p-4">
            <PanelTitle icon={Database} title="Generated Batches" />
            <div className="mt-3 space-y-2">
              {(batches.data ?? []).map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-white p-3 text-sm dark:bg-slate-950"
                >
                  <div>
                    <p className="font-medium">{batch.name}</p>
                    <p className="text-xs text-slate-500">{batch.generatedCases} cases</p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={deleteBatch.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete generated batch ${batch.name}?`)) {
                        deleteBatch.mutate(batch.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              ))}
              {!batches.data?.length ? <p className="text-sm text-slate-500">No generated batches yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
