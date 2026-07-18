import type { ExecutorType, SubmissionStatus } from "../types/domain";

// language settings the executor needs to actually run code
export interface ExecutionLanguageProfile {
  languageId: string;
  languageVersionId: string;
  languageKey: string;
  displayName: string;
  monacoId: string;
  fileExtension: string;
  version: string;
  label: string;
  sourceFileName: string;
  executableFileName?: string | null;
  isCompiled: boolean;
  timeLimitMultiplier: number;
  memoryLimitMultiplier: number;
  executorType: ExecutorType;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  environment?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
}

// what we send to the executor
export interface ExecutionRequest {
  problemSlug: string;
  language: string;
  profile?: ExecutionLanguageProfile;
  sourceCode: string;
  stdin: string;
  args?: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
}

// what we get back
export interface ExecutionResult {
  status: SubmissionStatus;
  stdout: string;
  stderr?: string;
  compileOutput?: string;
  runtimeMs: number;
  memoryKb: number;
}

// all executors implement this
export interface Executor {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
