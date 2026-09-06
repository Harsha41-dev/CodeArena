import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Database, FileCode2, Save, Send, XCircle } from "lucide-react";
import { adminApi, problemsApi, type CreateProblemPayload, type EditorialPayload } from "../../services/api";
import type { CodeLanguage, Difficulty, StarterCode } from "../../types/api";
import { Button } from "../../components/Button";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { ErrorState } from "../../components/State";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { TagBadge } from "../../components/TagBadge";
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
    companies: "",
    timeLimitMs: 2000,
    memoryLimitMb: 256
  });
  const [starterCode, setStarterCode] = useState<StarterCode>(defaultStarterCode);
  const [dynamicStarterCode, setDynamicStarterCode] = useState<Record<string, string>>({});
  const [sampleCase, setSampleCase] = useState({ input: "", expectedOutput: "", explanation: "" });
  const [hiddenCase, setHiddenCase] = useState({ input: "", expectedOutput: "" });
  const [editorial, setEditorial] = useState("");
  const [editorialStructure, setEditorialStructure] = useState({
    hint: "",
    approach: "",
    complexity: "",
    diagram: "",
    solutionLanguage: "Python",
    solutionCode: "",
    solutionExplanation: "",
    timeComplexity: "",
    spaceComplexity: ""
  });

  const activeStarterLanguage = languages.find((language) => language.id === activeLanguageId) ?? languages[0];
  const activeStarterCodeValue = activeStarterLanguage
    ? getStarterCode(activeStarterLanguage, starterCode, dynamicStarterCode)
    : "";
  const previewTags = form.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const draftReady = form.title.trim().length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim());
  const publishChecks = [
    { label: "Title and slug", ok: draftReady },
    { label: "Statement", ok: form.description.trim().length >= 5 },
    { label: "Input and output format", ok: Boolean(form.inputFormat.trim() && form.outputFormat.trim()) },
    { label: "Constraints", ok: form.constraints.trim().length >= 3 },
    { label: "At least one tag", ok: previewTags.length > 0 },
    { label: "Sample testcase", ok: Boolean(sampleCase.input.trim() && sampleCase.expectedOutput.trim()) },
    { label: "Hidden testcase", ok: Boolean(hiddenCase.input.trim() && hiddenCase.expectedOutput.trim()) }
  ];
  const publishReady = publishChecks.every((item) => item.ok);

  const create = useMutation({
    mutationFn: async (visibility: Visibility) => {
      const tagList = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const companies = parseCompanies(form.companies);
      const { companies: _companies, ...problemForm } = form;

      const problem = await problemsApi.create({
        ...problemForm,
        starterCode,
        tags: tagList,
        companies,
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

      const structure = buildEditorialStructure(editorialStructure);
      if (editorial.trim() || structure) {
        await adminApi.upsertEditorial(problem.id, {
          title: `${problem.title} Editorial`,
          content: editorial.trim() || `${problem.title} official editorial.`,
          isPublished: visibility === "PUBLIC",
          structure
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
          <TextInput
            label="Companies"
            value={form.companies}
            onChange={(value) => setForm((current) => ({ ...current, companies: value }))}
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
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 dark:border-white/10 dark:bg-white/5">
            <PanelTitle icon={FileCode2} title="Structured Editorial" />
            <TextArea
              label="Hint"
              value={editorialStructure.hint}
              onChange={(value) => setEditorialStructure((current) => ({ ...current, hint: value }))}
            />
            <TextArea
              label="Approach"
              value={editorialStructure.approach}
              onChange={(value) => setEditorialStructure((current) => ({ ...current, approach: value }))}
            />
            <TextArea
              label="Complexity"
              value={editorialStructure.complexity}
              onChange={(value) => setEditorialStructure((current) => ({ ...current, complexity: value }))}
            />
            <TextArea
              label="Diagram Markdown"
              value={editorialStructure.diagram}
              onChange={(value) => setEditorialStructure((current) => ({ ...current, diagram: value }))}
            />
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <TextInput
                label="Solution Language"
                value={editorialStructure.solutionLanguage}
                onChange={(value) => setEditorialStructure((current) => ({ ...current, solutionLanguage: value }))}
              />
              <TextInput
                label="Time Complexity"
                value={editorialStructure.timeComplexity}
                onChange={(value) => setEditorialStructure((current) => ({ ...current, timeComplexity: value }))}
              />
              <TextInput
                label="Space Complexity"
                value={editorialStructure.spaceComplexity}
                onChange={(value) => setEditorialStructure((current) => ({ ...current, spaceComplexity: value }))}
              />
            </div>
            <TextArea
              label="Solution Explanation"
              value={editorialStructure.solutionExplanation}
              onChange={(value) => setEditorialStructure((current) => ({ ...current, solutionExplanation: value }))}
            />
            <TextArea
              label="Official Solution Code"
              value={editorialStructure.solutionCode}
              onChange={(value) => setEditorialStructure((current) => ({ ...current, solutionCode: value }))}
              rows={6}
              mono
            />
          </div>
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

          <div className="ca-muted-panel p-4">
            <PanelTitle icon={ClipboardList} title="Problem Preview" />
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111113]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {form.title.trim() || "Untitled Problem"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{form.slug.trim() || "problem-slug"}</p>
                </div>
                <DifficultyBadge difficulty={form.difficulty} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {previewTags.map((tag) => (
                  <TagBadge key={tag} label={tag} />
                ))}
              </div>
              {parseCompanies(form.companies).length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {parseCompanies(form.companies).map((company) => (
                    <span
                      key={company.slug ?? company.name}
                      className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      {company.name}
                      {company.frequency ? ` ${company.frequency}` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-4">
                <MarkdownRenderer content={form.description.trim() || "Statement preview will appear here."} />
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <PreviewBlock title="Input" value={form.inputFormat} />
                <PreviewBlock title="Output" value={form.outputFormat} />
                <PreviewBlock title="Constraints" value={form.constraints} />
                <PreviewBlock title="Limits" value={`${form.timeLimitMs} ms / ${form.memoryLimitMb} MB`} />
              </div>
            </div>
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

          <div className="ca-muted-panel p-4">
            <PanelTitle icon={CheckCircle2} title="Testcase Validator" />
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {publishChecks.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 ${
                    item.ok
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "bg-slate-50 text-slate-500 dark:bg-black/20"
                  }`}
                >
                  {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={create.isPending || !draftReady} onClick={() => create.mutate("PRIVATE")}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button disabled={create.isPending || !publishReady} onClick={() => create.mutate("PUBLIC")}>
              <Send className="h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 dark:bg-black/20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{value || "Not set"}</p>
    </div>
  );
}

function parseCompanies(value: string): NonNullable<CreateProblemPayload["companies"]> {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const [namePart, frequencyPart] = item.split(":");
      const name = namePart.trim();
      const frequency = Number(frequencyPart);
      return {
        name,
        slug: slugify(name),
        frequency: Number.isFinite(frequency) && frequency > 0 ? frequency : 1,
        isFeatured: Number.isFinite(frequency) && frequency >= 50
      };
    });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildEditorialStructure(input: {
  hint: string;
  approach: string;
  complexity: string;
  diagram: string;
  solutionLanguage: string;
  solutionCode: string;
  solutionExplanation: string;
  timeComplexity: string;
  spaceComplexity: string;
}): NonNullable<EditorialPayload["structure"]> | undefined {
  const sections: NonNullable<NonNullable<EditorialPayload["structure"]>["sections"]> = [];
  if (input.hint.trim()) {
    sections.push({ type: "HINT", title: "Hint", content: input.hint.trim(), order: 1, isLocked: true });
  }
  if (input.approach.trim()) {
    sections.push({ type: "SOLUTION", title: "Approach", content: input.approach.trim(), order: 2 });
  }
  if (input.complexity.trim()) {
    sections.push({ type: "COMPLEXITY", title: "Complexity", content: input.complexity.trim(), order: 3 });
  }
  if (input.diagram.trim()) {
    sections.push({ type: "DIAGRAM", title: "Diagram", content: input.diagram.trim(), order: 4 });
  }

  const officialSolutions: NonNullable<NonNullable<EditorialPayload["structure"]>["officialSolutions"]> = [];
  if (input.solutionCode.trim()) {
    officialSolutions.push({
      language: input.solutionLanguage.trim() || "Python",
      code: input.solutionCode.trim(),
      explanation: input.solutionExplanation.trim() || null,
      timeComplexity: input.timeComplexity.trim() || null,
      spaceComplexity: input.spaceComplexity.trim() || null,
      order: 1
    });
  }

  if (!sections.length && !officialSolutions.length) {
    return undefined;
  }

  return { sections, officialSolutions };
}
