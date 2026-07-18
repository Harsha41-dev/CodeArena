import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ClipboardList, Database, FileCode2, Save, Send } from "lucide-react";
import { adminApi, problemsApi, type CreateProblemPayload } from "../../services/api";
import type { CodeLanguage, Difficulty, StarterCode } from "../../types/api";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/State";
import { NumberInput, PanelTitle, TextArea, TextInput } from "./formFields";
import {
  defaultStarterCode,
  defaultVersion,
  getStarterCode,
  legacyKeyForLanguage,
  starterStateKey
} from "./starterCode";

type Visibility = NonNullable<CreateProblemPayload["visibility"]>;

interface CreateProblemSectionProps {
  languages: CodeLanguage[];
  languagesLoading: boolean;
  languagesError: Error | null;
  onCreated: (title: string) => void;
}

export function CreateProblemSection({
  languages,
  languagesLoading,
  languagesError,
  onCreated
}: CreateProblemSectionProps) {
  const [activeLanguageId, setActiveLanguageId] = useState("");
  const [form, setForm] = useState({
    slug: "",
    title: "",
    difficulty: "EASY" as Difficulty,
    description: "",
    constraints: "",
    inputFormat: "",
    outputFormat: "",
    tags: "Array, Implementation",
    timeLimitMs: 2000,
    memoryLimitMb: 256
  });
  const [starterCode, setStarterCode] = useState<StarterCode>(defaultStarterCode);
  const [dynamicStarterCode, setDynamicStarterCode] = useState<Record<string, string>>({});
  const [sampleCase, setSampleCase] = useState({ input: "", expectedOutput: "", explanation: "" });
  const [hiddenCase, setHiddenCase] = useState({ input: "", expectedOutput: "" });
  const [editorial, setEditorial] = useState("");

  const activeStarterLanguage = languages.find((language) => language.id === activeLanguageId) ?? languages[0];
  const activeStarterCodeValue = activeStarterLanguage
    ? getStarterCode(activeStarterLanguage, starterCode, dynamicStarterCode)
    : "";

  const create = useMutation({
    mutationFn: async (visibility: Visibility) => {
      const tagList = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const problem = await problemsApi.create({
        ...form,
        starterCode,
        tags: tagList,
        visibility
      });

      if (sampleCase.input.trim() || sampleCase.expectedOutput.trim()) {
        await problemsApi.addTestCase(problem.id, {
          ...sampleCase,
          isSample: true,
          isStrict: true,
          order: 1
        });
      }

      if (hiddenCase.input.trim() || hiddenCase.expectedOutput.trim()) {
        await problemsApi.addTestCase(problem.id, {
          ...hiddenCase,
          isSample: false,
          isStrict: true,
          order: 2
        });
      }

      if (editorial.trim()) {
        await adminApi.upsertEditorial(problem.id, {
          title: `${problem.title} Editorial`,
          content: editorial,
          isPublished: visibility === "PUBLIC"
        });
      }

      for (const language of languages) {
        const version = defaultVersion(language);
        if (!version) {
          continue;
        }
        const legacyKey = legacyKeyForLanguage(language.key);
        const dynamicKey = starterStateKey(language);
        const hasDynamic = Object.prototype.hasOwnProperty.call(dynamicStarterCode, dynamicKey);
        if (!legacyKey && !hasDynamic) {
          continue;
        }
        await adminApi.upsertProblemStarterCode(problem.id, {
          languageId: language.id,
          languageVersionId: version.id,
          code: getStarterCode(language, starterCode, dynamicStarterCode)
        });
      }

      return problem;
    },
    onSuccess: (problem) => {
      onCreated(problem.title);
    }
  });

  return (
    <div className="ca-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Create Problem</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Build the statement, starter code, and the first sample plus hidden judge cases.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">
          editorial draft/publish enabled
        </span>
      </div>

      {create.isError ? <ErrorState title="Problem creation failed" error={create.error} /> : null}
      {create.isSuccess ? (
        <span className="mt-3 inline-block rounded-md bg-emerald-100 px-3 py-1 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Created {create.data.title}
        </span>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Title"
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
            />
            <TextInput
              label="Slug"
              value={form.slug}
              onChange={(value) => setForm((current) => ({ ...current, slug: value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium">Difficulty</span>
              <select
                className="ca-input mt-1 w-full"
                value={form.difficulty}
                onChange={(event) =>
                  setForm((current) => ({ ...current, difficulty: event.target.value as Difficulty }))
                }
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </label>
            <NumberInput
              label="Time ms"
              value={form.timeLimitMs}
              onChange={(value) => setForm((current) => ({ ...current, timeLimitMs: value }))}
            />
            <NumberInput
              label="Memory MB"
              value={form.memoryLimitMb}
              onChange={(value) => setForm((current) => ({ ...current, memoryLimitMb: value }))}
            />
          </div>
          <TextInput
            label="Tags"
            value={form.tags}
            onChange={(value) => setForm((current) => ({ ...current, tags: value }))}
          />
          <TextArea
            label="Statement Markdown"
            value={form.description}
            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
            rows={7}
          />
          <TextArea
            label="Input Format"
            value={form.inputFormat}
            onChange={(value) => setForm((current) => ({ ...current, inputFormat: value }))}
          />
          <TextArea
            label="Output Format"
            value={form.outputFormat}
            onChange={(value) => setForm((current) => ({ ...current, outputFormat: value }))}
          />
          <TextArea
            label="Constraints"
            value={form.constraints}
            onChange={(value) => setForm((current) => ({ ...current, constraints: value }))}
          />
          <TextArea label="Editorial Draft" value={editorial} onChange={setEditorial} rows={4} />
        </div>

        <div className="grid content-start gap-4">
          <PanelTitle icon={FileCode2} title="Starter Code" />
          <div className="ca-muted-panel p-4">
            {languagesLoading ? <p className="text-sm text-slate-500">Loading language catalog...</p> : null}
            {languagesError ? <ErrorState title="Could not load languages" error={languagesError} /> : null}
            {languages.length ? (
              <>
                <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
                  {languages.map((language) => (
                    <button
                      key={language.id}
                      type="button"
                      className={`rounded-md px-3 py-1 text-sm ${
                        activeStarterLanguage?.id === language.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                          : "bg-white dark:bg-slate-900"
                      }`}
                      onClick={() => setActiveLanguageId(language.id)}
                    >
                      {language.displayName}
                    </button>
                  ))}
                </div>
                <TextArea
                  label={`${activeStarterLanguage?.displayName ?? "Language"} ${defaultVersion(activeStarterLanguage)?.label ?? ""} template`}
                  value={activeStarterCodeValue}
                  onChange={(value) => {
                    if (!activeStarterLanguage) return;
                    const legacyKey = legacyKeyForLanguage(activeStarterLanguage.key);
                    if (legacyKey) {
                      setStarterCode((current) => ({ ...current, [legacyKey]: value }));
                    } else {
                      setDynamicStarterCode((current) => ({
                        ...current,
                        [starterStateKey(activeStarterLanguage)]: value
                      }));
                    }
                  }}
                  rows={12}
                  mono
                />
              </>
            ) : languagesLoading ? null : (
              <p className="text-sm text-slate-500">No active languages are configured.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="ca-muted-panel p-4">
              <PanelTitle icon={ClipboardList} title="Sample Case" />
              <TextArea
                label="Input"
                value={sampleCase.input}
                onChange={(value) => setSampleCase((current) => ({ ...current, input: value }))}
                mono
              />
              <TextArea
                label="Expected Output"
                value={sampleCase.expectedOutput}
                onChange={(value) => setSampleCase((current) => ({ ...current, expectedOutput: value }))}
                mono
              />
              <TextArea
                label="Explanation"
                value={sampleCase.explanation}
                onChange={(value) => setSampleCase((current) => ({ ...current, explanation: value }))}
              />
            </div>
            <div className="ca-muted-panel p-4">
              <PanelTitle icon={Database} title="Hidden Case" />
              <TextArea
                label="Input"
                value={hiddenCase.input}
                onChange={(value) => setHiddenCase((current) => ({ ...current, input: value }))}
                mono
              />
              <TextArea
                label="Expected Output"
                value={hiddenCase.expectedOutput}
                onChange={(value) => setHiddenCase((current) => ({ ...current, expectedOutput: value }))}
                mono
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={create.isPending} onClick={() => create.mutate("PRIVATE")}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button disabled={create.isPending} onClick={() => create.mutate("PUBLIC")}>
              <Send className="h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
