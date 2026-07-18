import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Play, RefreshCw, Save } from "lucide-react";
import { adminApi, problemsApi } from "../services/api";
import type {
  CodeLanguage,
  CodeLanguageVersion,
  ExecutorCapabilityEntry,
  ExecutorCapabilityResponse,
  LanguageCategory,
  ProblemLanguageOption
} from "../types/api";
import { Button } from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { useAuthStore } from "../stores/authStore";

// kept for possible future create-language form
const categories: LanguageCategory[] = [
  "GENERAL_PURPOSE",
  "SYSTEMS",
  "SCRIPTING",
  "FUNCTIONAL",
  "JVM",
  "DOTNET",
  "DATABASE",
  "SHELL",
  "EDUCATIONAL",
  "OTHER"
];
void categories;

export function AdminLanguagesPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const languages = useQuery({
    queryKey: ["admin-languages"],
    queryFn: adminApi.languages,
    enabled: user?.role === "ADMIN"
  });

  const executorCapabilities = useQuery({
    queryKey: ["admin-executor-capabilities"],
    queryFn: () => adminApi.executorCapabilities(),
    enabled: user?.role === "ADMIN"
  });

  const problems = useQuery({
    queryKey: ["admin-problems", "languages"],
    queryFn: () => problemsApi.list({ limit: "100" }),
    enabled: user?.role === "ADMIN"
  });

  const [selectedLanguageId, setSelectedLanguageId] = useState("");

  const selectedLanguage = useMemo(() => {
    if (!languages.data) {
      return undefined;
    }
    const found = languages.data.find((language) => language.id === selectedLanguageId);
    if (found) {
      return found;
    }
    return languages.data[0];
  }, [languages.data, selectedLanguageId]);

  const sync = useMutation({
    mutationFn: adminApi.syncJudge0Languages,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] });
    }
  });

  if (user?.role !== "ADMIN") {
    return (
      <ErrorState title="Admin access required" error={new Error("Login with an ADMIN account to manage languages.")} />
    );
  }

  if (languages.isLoading) {
    return <LoadingState label="Loading languages" />;
  }

  if (languages.isError) {
    return <ErrorState title="Could not load languages" error={languages.error} />;
  }

  return (
    <div className="space-y-5">
      <section className="ca-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Language Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage global languages, versions, executor profiles, problem availability, and starter code.
            </p>
          </div>
          <Button variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw className="h-4 w-4" /> Sync Judge0
          </Button>
        </div>

        {executorCapabilities.data ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
              Executor: {executorCapabilities.data.executorType}
            </span>
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {executorCapabilities.data.summary.activeSupportedLanguageVersions} executable versions
            </span>
            {executorCapabilities.data.summary.unsupportedLanguageVersions ? (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {executorCapabilities.data.summary.unsupportedLanguageVersions} unavailable
              </span>
            ) : null}
          </div>
        ) : null}

        {sync.data ? (
          <p className="mt-3 text-sm text-slate-500">
            Judge0 sync: {sync.data.created} created, {sync.data.updated} updated, {sync.data.skipped} skipped.
          </p>
        ) : null}
        {sync.isError ? (
          <div className="mt-3">
            <ErrorState title="Judge0 sync failed" error={sync.error} />
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <LanguageTable
          languages={languages.data ?? []}
          selectedId={selectedLanguage?.id ?? ""}
          onSelect={setSelectedLanguageId}
        />
        {selectedLanguage ? (
          <LanguageVersionTable language={selectedLanguage} capabilities={executorCapabilities.data} />
        ) : (
          <EmptyState title="No language selected" />
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ExecutionProfileForm language={selectedLanguage} />
        <ProblemLanguageManager languages={languages.data ?? []} problems={problems.data ?? []} />
      </section>

      <StarterCodeManager languages={languages.data ?? []} problems={problems.data ?? []} />
    </div>
  );
}

export function LanguageTable({
  languages,
  selectedId,
  onSelect
}: {
  languages: CodeLanguage[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (language: CodeLanguage) => adminApi.updateLanguage(language.id, { isActive: !language.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] });
    }
  });

  return (
    <section className="ca-panel overflow-hidden">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="font-semibold">Languages</h2>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        {languages.map((language) => {
          const isSelected = selectedId === language.id;
          let rowClass =
            "grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm dark:border-slate-800";
          if (isSelected) {
            rowClass = rowClass + " bg-slate-100 dark:bg-slate-900";
          }

          return (
            <button key={language.id} type="button" className={rowClass} onClick={() => onSelect(language.id)}>
              <span>
                <span className="font-medium">{language.displayName}</span>
                <span className="ml-2 text-xs text-slate-500">{language.key}</span>
              </span>
              <LanguageStatusBadge active={language.isActive} />
              <Button
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle.mutate(language);
                }}
              >
                {language.isActive ? "Disable" : "Enable"}
              </Button>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LanguageVersionTable({
  language,
  capabilities
}: {
  language: CodeLanguage;
  capabilities?: ExecutorCapabilityResponse;
}) {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState("");
  const [label, setLabel] = useState("");

  const create = useMutation({
    mutationFn: () =>
      adminApi.createVersion(language.id, {
        version,
        label,
        sourceFileName: `main.${language.fileExtension}`,
        isActive: true,
        isDefault: false
      }),
    onSuccess: () => {
      setVersion("");
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] });
    }
  });

  const toggle = useMutation({
    mutationFn: (item: CodeLanguageVersion) => adminApi.updateVersion(item.id, { isActive: !item.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] });
    }
  });

  const markDefault = useMutation({
    mutationFn: (item: CodeLanguageVersion) => adminApi.updateVersion(item.id, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] });
    }
  });

  return (
    <section className="ca-panel p-5">
      <h2 className="font-semibold">{language.displayName} Versions</h2>
      <div className="mt-4 space-y-2">
        {language.versions.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center"
          >
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-slate-500">{item.version}</p>
            </div>
            <ExecutorSupportBadge version={item} />
            <CapabilityBadge capability={capabilityForVersion(capabilities, item.id)} />
            <Button variant="secondary" onClick={() => markDefault.mutate(item)}>
              {item.isDefault ? "Default" : "Make default"}
            </Button>
            <Button variant="secondary" onClick={() => toggle.mutate(item)}>
              {item.isActive ? "Disable" : "Enable"}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="ca-input"
          placeholder="Version key"
          value={version}
          onChange={(event) => setVersion(event.target.value)}
        />
        <input
          className="ca-input"
          placeholder="Display label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Button disabled={!version || !label || create.isPending} onClick={() => create.mutate()}>
          <Save className="h-4 w-4" /> Add
        </Button>
      </div>
      {create.isError ? (
        <div className="mt-3">
          <ErrorState title="Could not create version" error={create.error} />
        </div>
      ) : null}
    </section>
  );
}

export function ExecutionProfileForm({ language }: { language?: CodeLanguage }) {
  const queryClient = useQueryClient();

  // edit the default version (or first one)
  let version: CodeLanguageVersion | undefined;
  if (language) {
    version = language.versions.find((item) => item.isDefault);
    if (!version) {
      version = language.versions[0];
    }
  }

  const [judge0Id, setJudge0Id] = useState("");
  const [dockerImage, setDockerImage] = useState("");
  const [compileCommand, setCompileCommand] = useState("");
  const [runCommand, setRunCommand] = useState("");

  const save = useMutation({
    mutationFn: () => {
      if (!version) {
        return Promise.resolve(undefined);
      }
      return adminApi.updateVersion(version.id, {
        judge0Id: judge0Id ? Number(judge0Id) : null,
        dockerImage: dockerImage || null,
        compileCommand: compileCommand || null,
        runCommand: runCommand || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] });
    }
  });

  if (!language || !version) {
    return (
      <section className="ca-panel p-5">
        <EmptyState title="Select a language to edit profiles" />
      </section>
    );
  }

  return (
    <section className="ca-panel p-5">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-accent-600" />
        <h2 className="font-semibold">Execution Profile</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">Editing default version: {version.label}</p>
      <div className="mt-4 grid gap-3">
        <input
          className="ca-input"
          placeholder={`Judge0 ID (${version.judge0Id ?? "unset"})`}
          value={judge0Id}
          onChange={(event) => setJudge0Id(event.target.value)}
        />
        <input
          className="ca-input"
          placeholder={`Docker image (${version.dockerImage ?? "unset"})`}
          value={dockerImage}
          onChange={(event) => setDockerImage(event.target.value)}
        />
        <input
          className="ca-input"
          placeholder={`Compile command (${version.compileCommand ?? "none"})`}
          value={compileCommand}
          onChange={(event) => setCompileCommand(event.target.value)}
        />
        <input
          className="ca-input"
          placeholder={`Run command (${version.runCommand ?? "none"})`}
          value={runCommand}
          onChange={(event) => setRunCommand(event.target.value)}
        />
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Save Profile
        </Button>
      </div>
    </section>
  );
}

export function ProblemLanguageManager({
  languages,
  problems
}: {
  languages: CodeLanguage[];
  problems: Array<{ id: string; title: string }>;
}) {
  const [problemId, setProblemId] = useState("");
  const [settings, setSettings] = useState<Record<string, { isEnabled: boolean; languageVersionId: string }>>({});

  const current = useQuery({
    queryKey: ["admin-problem-languages", problemId],
    queryFn: () => adminApi.problemLanguages(problemId),
    enabled: Boolean(problemId)
  });

  const capabilities = useQuery({
    queryKey: ["admin-problem-executor-capabilities", problemId],
    queryFn: () => adminApi.executorCapabilities({ problemId }),
    enabled: Boolean(problemId)
  });

  const update = useMutation({
    mutationFn: () => {
      const payload = languages.map((language) => {
        const setting = settings[language.id];
        return {
          languageId: language.id,
          languageVersionId: setting?.languageVersionId || null,
          isEnabled: Boolean(setting?.isEnabled)
        };
      });
      return adminApi.updateProblemLanguages(problemId, payload);
    },
    onSuccess: () => {
      current.refetch();
    }
  });

  // rebuild local settings when problem languages load
  useEffect(() => {
    if (!problemId || !languages.length) {
      setSettings({});
      return;
    }
    const next = buildProblemLanguageSettings(languages, current.data ?? []);
    setSettings(next);
  }, [current.data, languages, problemId]);

  function setLanguageEnabled(languageId: string, isEnabled: boolean) {
    setSettings((value) => {
      const prev = value[languageId];
      return {
        ...value,
        [languageId]: {
          isEnabled,
          languageVersionId: prev?.languageVersionId ?? ""
        }
      };
    });
  }

  function setPinnedVersion(languageId: string, languageVersionId: string) {
    setSettings((value) => {
      const prev = value[languageId];
      return {
        ...value,
        [languageId]: {
          isEnabled: prev?.isEnabled ?? true,
          languageVersionId
        }
      };
    });
  }

  const isLoadingLists = current.isLoading || capabilities.isLoading;

  return (
    <section className="ca-panel p-5">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-accent-600" />
        <h2 className="font-semibold">Problem Language Manager</h2>
      </div>
      <div className="mt-4 grid gap-3">
        <select className="ca-input" value={problemId} onChange={(event) => setProblemId(event.target.value)}>
          <option value="">Select problem</option>
          {problems.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
            </option>
          ))}
        </select>

        {isLoadingLists ? <LoadingState label="Loading problem languages" /> : null}
        {current.isError ? <ErrorState title="Could not load problem languages" error={current.error} /> : null}
        {capabilities.isError ? (
          <ErrorState title="Could not load executor capabilities" error={capabilities.error} />
        ) : null}

        {problemId && !isLoadingLists ? (
          <div className="max-h-80 space-y-2 overflow-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
            {languages.map((language) => {
              const setting = settings[language.id] ?? {
                isEnabled: language.isActive,
                languageVersionId: ""
              };

              const languageCapabilities =
                capabilities.data?.languages.filter((entry) => entry.language.id === language.id) ?? [];

              let selectedCapability: ExecutorCapabilityEntry | undefined;
              if (setting.languageVersionId) {
                selectedCapability = languageCapabilities.find(
                  (entry) => entry.version.id === setting.languageVersionId
                );
              } else {
                selectedCapability = languageCapabilities.find((entry) => entry.canRun);
              }

              const enabledButUnavailable = setting.isEnabled && !selectedCapability?.canRun;

              return (
                <div
                  key={language.id}
                  className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950 md:grid-cols-[1fr_auto_auto_12rem] md:items-center"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={setting.isEnabled}
                      disabled={!language.isActive}
                      onChange={(event) => setLanguageEnabled(language.id, event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{language.displayName}</span>
                      <span className="ml-2 text-xs text-slate-500">{language.key}</span>
                    </span>
                  </label>
                  <LanguageStatusBadge active={language.isActive} />
                  <CapabilityBadge capability={selectedCapability} />
                  <select
                    className="ca-input"
                    value={setting.languageVersionId}
                    disabled={!setting.isEnabled}
                    onChange={(event) => setPinnedVersion(language.id, event.target.value)}
                  >
                    <option value="">Any active/default</option>
                    {language.versions.map((version) => (
                      <option key={version.id} value={version.id} disabled={!version.isActive}>
                        {version.label}
                      </option>
                    ))}
                  </select>
                  {enabledButUnavailable ? (
                    <p className="md:col-span-4 text-xs text-amber-600">
                      Enabled for this problem, but not executable by the current judge environment.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <Button disabled={!problemId || update.isPending || current.isLoading} onClick={() => update.mutate()}>
          <Save className="h-4 w-4" /> Save Language Rules
        </Button>
        {update.isSuccess ? <p className="text-sm text-emerald-600">Problem language availability updated.</p> : null}
        {update.isError ? <ErrorState title="Could not update problem languages" error={update.error} /> : null}
      </div>
    </section>
  );
}

function buildProblemLanguageSettings(languages: CodeLanguage[], options: ProblemLanguageOption[]) {
  // group options by language id
  const byLanguage = new Map<string, ProblemLanguageOption[]>();
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const entries = byLanguage.get(option.language.id) ?? [];
    entries.push(option);
    byLanguage.set(option.language.id, entries);
  }

  const next: Record<string, { isEnabled: boolean; languageVersionId: string }> = {};

  for (let i = 0; i < languages.length; i++) {
    const language = languages[i];
    const entries = byLanguage.get(language.id) ?? [];
    const first = entries[0];

    let pinnedVersion = null;
    if (first?.isPinnedVersion) {
      pinnedVersion = first.version;
    }

    let isEnabled = true;
    if (!language.isActive) {
      isEnabled = false;
    } else if (pinnedVersion && !pinnedVersion.isActive) {
      isEnabled = false;
    } else if (first && first.isEnabled === false) {
      isEnabled = false;
    }

    next[language.id] = {
      isEnabled,
      languageVersionId: pinnedVersion?.id ?? ""
    };
  }

  return next;
}

export function StarterCodeManager({
  languages,
  problems
}: {
  languages: CodeLanguage[];
  problems: Array<{ id: string; title: string }>;
}) {
  const [problemId, setProblemId] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [code, setCode] = useState("");

  const selectedLanguage = languages.find((language) => language.id === languageId);

  const save = useMutation({
    mutationFn: () => {
      // pin to default version if possible
      let languageVersionId: string | undefined;
      if (selectedLanguage) {
        const defaultVersion = selectedLanguage.versions.find((version) => version.isDefault);
        if (defaultVersion) {
          languageVersionId = defaultVersion.id;
        } else if (selectedLanguage.versions[0]) {
          languageVersionId = selectedLanguage.versions[0].id;
        }
      }
      return adminApi.upsertProblemStarterCode(problemId, {
        languageId,
        languageVersionId,
        code
      });
    }
  });

  function handleLanguageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    const next = languages.find((language) => language.id === nextId);
    setLanguageId(nextId);

    // load template when switching language
    let template = "";
    if (next) {
      const defaultVersion = next.versions.find((version) => version.isDefault);
      if (defaultVersion?.starterTemplate) {
        template = defaultVersion.starterTemplate;
      } else if (next.versions[0]?.starterTemplate) {
        template = next.versions[0].starterTemplate;
      }
    }
    setCode(template);
  }

  return (
    <section className="ca-panel p-5">
      <h2 className="font-semibold">Starter Code Manager</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select className="ca-input" value={problemId} onChange={(event) => setProblemId(event.target.value)}>
          <option value="">Select problem</option>
          {problems.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
            </option>
          ))}
        </select>
        <select className="ca-input" value={languageId} onChange={handleLanguageChange}>
          <option value="">Select language</option>
          {languages.map((language) => (
            <option key={language.id} value={language.id}>
              {language.displayName}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="ca-textarea mt-3 min-h-56 w-full font-mono text-xs"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <div className="mt-3">
        <Button disabled={!problemId || !languageId || save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Save Starter
        </Button>
      </div>
      {save.isSuccess ? <p className="mt-2 text-sm text-emerald-600">Starter code saved.</p> : null}
      {save.isError ? (
        <div className="mt-3">
          <ErrorState title="Could not save starter code" error={save.error} />
        </div>
      ) : null}
    </section>
  );
}

export function LanguageStatusBadge({ active }: { active: boolean }) {
  let className = "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  let label = "Disabled";
  if (active) {
    className = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    label = "Active";
  }
  return <span className={`rounded-md px-2 py-1 text-xs ${className}`}>{label}</span>;
}

export function ExecutorSupportBadge({ version }: { version: CodeLanguageVersion }) {
  const support: string[] = [];
  if (version.judge0Id) {
    support.push("Judge0");
  }
  if (version.dockerImage) {
    support.push("Docker");
  }
  support.push("Mock");
  return (
    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {support.join(" / ")}
    </span>
  );
}

function CapabilityBadge({ capability }: { capability?: ExecutorCapabilityEntry }) {
  if (!capability) {
    return <Badge tone="warn">Missing Profile</Badge>;
  }

  const reason = capability.admin?.missingConfigReason ?? capability.reason;

  if (!capability.canRun) {
    if (reason && reason.includes("profile")) {
      return <Badge tone="warn">Missing Profile</Badge>;
    }
    return <Badge tone="danger">Not Executable</Badge>;
  }

  if (capability.admin?.executorType === "MOCK") {
    return <Badge tone="muted">Mock Only</Badge>;
  }
  if (capability.admin?.executorType === "JUDGE0") {
    return <Badge tone="success">Judge0 Ready</Badge>;
  }
  if (capability.admin?.executorType === "DOCKER") {
    return <Badge tone="success">Docker Ready</Badge>;
  }
  return <Badge tone="success">Production Ready</Badge>;
}

function Badge({ tone, children }: { tone: "success" | "warn" | "danger" | "muted"; children: string }) {
  let className = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (tone === "success") {
    className = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  } else if (tone === "warn") {
    className = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  } else if (tone === "danger") {
    className = "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  }
  return <span className={`rounded-md px-2 py-1 text-xs ${className}`}>{children}</span>;
}

function capabilityForVersion(capabilities: ExecutorCapabilityResponse | undefined, versionId: string) {
  if (!capabilities) {
    return undefined;
  }
  return capabilities.languages.find((entry) => entry.version.id === versionId);
}
