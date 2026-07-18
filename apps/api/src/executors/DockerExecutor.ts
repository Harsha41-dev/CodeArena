import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Executor, ExecutionRequest, ExecutionResult } from "./Executor";
import { env } from "../config/env";
import { logger } from "../config/logger";

const execFileAsync = promisify(execFile);

export class DockerExecutor implements Executor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // need docker image + at least one command
    const hasImage = Boolean(request.profile?.dockerImage);
    const hasCompile = Boolean(request.profile?.compileCommand);
    const hasRun = Boolean(request.profile?.runCommand);

    if (!hasImage || !(hasCompile || hasRun)) {
      logger.warn({ language: request.language }, "Docker execution profile is missing");
      return {
        status: "INTERNAL_ERROR",
        stdout: "",
        stderr: `${request.language} does not have a Docker execution profile configured`,
        runtimeMs: 0,
        memoryKb: 0
      };
    }

    // temp folder for source + input
    const workDir = await mkdtemp(join(tmpdir(), "codearena-"));

    try {
      const sourceFile = safeFileName(request.profile!.sourceFileName);
      let executableName = "main";
      if (request.profile!.executableFileName) {
        executableName = request.profile!.executableFileName;
      }
      const executableFile = safeFileName(executableName);

      // write source and stdin
      await writeFile(join(workDir, sourceFile), request.sourceCode, "utf8");
      await writeFile(join(workDir, "input.txt"), request.stdin, "utf8");

      const args = request.args ?? [];
      const command = this.containerCommand(
        request.profile!.compileCommand,
        request.profile!.runCommand,
        sourceFile,
        executableFile,
        args
      );

      const startedAt = Date.now();

      // run inside locked-down container
      const dockerArgs = [
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        env.DOCKER_MEMORY_LIMIT,
        "--cpus",
        "1",
        "--pids-limit",
        "128",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,noexec,size=64m",
        "-v",
        `${workDir}:/workspace:rw`,
        "-w",
        "/workspace",
        request.profile!.dockerImage!,
        "sh",
        "-lc",
        command
      ];

      const timeoutMs = request.timeLimitMs + env.DOCKER_TIME_LIMIT * 1000;

      const { stdout, stderr } = await execFileAsync("docker", dockerArgs, {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024
      });

      const runtimeMs = Date.now() - startedAt;

      return {
        status: "ACCEPTED",
        stdout,
        stderr,
        runtimeMs,
        memoryKb: 0
      };
    } catch (error) {
      const executionError = error as Error & {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
        code?: number | string;
      };

      let message = "Docker execution failed";
      if (error instanceof Error) {
        message = error.message;
      }

      let stderr = message;
      if (executionError.stderr) {
        stderr = executionError.stderr;
      }

      // figure out what kind of failure
      let timedOut = false;
      if (executionError.killed) {
        timedOut = true;
      } else if (executionError.signal === "SIGTERM") {
        timedOut = true;
      } else if (/timed out/i.test(message)) {
        timedOut = true;
      }

      const compileFailed = /compilation|compile|g\+\+|javac|syntaxerror|tsc/i.test(stderr);

      if (timedOut) {
        logger.warn({ language: request.language, timeLimitMs: request.timeLimitMs }, "Docker execution timed out");
      } else {
        logger.warn({ language: request.language, code: executionError.code }, "Docker execution failed");
      }

      let status: ExecutionResult["status"];
      if (timedOut) {
        status = "TIME_LIMIT_EXCEEDED";
      } else if (compileFailed) {
        status = "COMPILATION_ERROR";
      } else {
        status = "RUNTIME_ERROR";
      }

      let compileOutput: string | undefined;
      if (compileFailed) {
        compileOutput = stderr;
      }

      return {
        status,
        stdout: executionError.stdout ?? "",
        stderr,
        compileOutput,
        runtimeMs: request.timeLimitMs,
        memoryKb: 0
      };
    } finally {
      // always clean up temp dir
      await rm(workDir, { recursive: true, force: true });
    }
  }

  // build the shell command that runs inside the container
  private containerCommand(
    compileCommand: string | null | undefined,
    runCommand: string | null | undefined,
    sourceFile: string,
    executableFile: string,
    args: string[]
  ): string {
    // placeholders we support
    const replacements: Record<string, string> = {
      "{source}": sourceFile,
      "{executable}": executableFile,
      "{args}": args.map(shellQuote).join(" ")
    };

    const render = (command: string): string => {
      let current = command;
      const tokens = Object.keys(replacements);
      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        const value = replacements[token];
        current = current.replaceAll(token, value);
      }
      return current;
    };

    // if run command already has {args}, don't append them again
    let hasArgsPlaceholder = false;
    if (runCommand && runCommand.includes("{args}")) {
      hasArgsPlaceholder = true;
    }

    let renderedRunCommand = "";
    if (runCommand) {
      renderedRunCommand = render(runCommand);
    }

    let run = "";
    if (renderedRunCommand) {
      let runPart = renderedRunCommand;
      if (!hasArgsPlaceholder) {
        // append args manually
        const quotedArgs: string[] = [];
        for (let i = 0; i < args.length; i += 1) {
          quotedArgs.push(shellQuote(args[i]));
        }
        const argsStr = quotedArgs.join(" ");
        runPart = `${renderedRunCommand} ${argsStr}`.trim();
      }
      // feed input.txt as stdin
      run = `${runPart} < input.txt`;
    }

    // compile && run (or just one of them)
    const parts: string[] = [];
    if (compileCommand) {
      parts.push(render(compileCommand));
    }
    if (run) {
      parts.push(run);
    }

    return parts.join(" && ");
  }
}

// only keep the basename and strip weird chars
function safeFileName(value: string): string {
  // handle windows-style paths too
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/");
  let fileName = parts[parts.length - 1];
  if (!fileName) {
    fileName = "main";
  }

  // strip anything that isn't safe for a filename
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!cleaned) {
    return "main";
  }
  return cleaned;
}

// single-quote for shell safety
function shellQuote(value: string): string {
  // escape any single quotes inside
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}
