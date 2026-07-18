import { env } from "../config/env";
import type { Executor } from "./Executor";
import { DockerExecutor } from "./DockerExecutor";
import { Judge0Executor } from "./Judge0Executor";
import { MockExecutor } from "./MockExecutor";

// pick which executor to use based on env
export function createExecutor(): Executor {
  if (env.EXECUTOR_MODE === "docker") {
    return new DockerExecutor();
  }

  if (env.EXECUTOR_MODE === "judge0") {
    return new Judge0Executor();
  }

  // default for local dev / tests
  return new MockExecutor();
}
