import { Writable } from "node:stream";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pino from "pino";
import request from "supertest";
import { createApp, getAppContext } from "../app";
import { InMemorySubmissionEventBus, type SubmissionStatusEvent } from "../events/SubmissionEventBus";
import { InMemorySubmissionQueue } from "../queue/SubmissionQueue";
import { MemoryLanguageRepository } from "../repositories/LanguageRepository";
import { MemoryRepository } from "../repositories/MemoryRepository";
import { MockExecutor } from "../executors/MockExecutor";
import { DockerExecutor } from "../executors/DockerExecutor";
import { Judge0Executor } from "../executors/Judge0Executor";
import { createExecutor } from "../executors";
import type { ExecutionRequest, ExecutionResult, Executor } from "../executors/Executor";
import { SubmissionWorker } from "../services/SubmissionWorker";
import { TestCaseGenerationService } from "../services/TestCaseGenerationService";
import { env } from "../config/env";
import { loggerOptions } from "../config/logger";

const cNoOutput = "#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n";
const cWrongOutput = '#include <stdio.h>\n\nint main(void) {\n  printf("1 2\\n");\n  return 0;\n}\n';
const cCorrectSampleOutput = '#include <stdio.h>\n\nint main(void) {\n  printf("0 1\\n");\n  return 0;\n}\n';

class LruGetDoesNotRefreshExecutor extends MockExecutor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (request.sourceCode.includes("MOCK_LRU_GET_DOES_NOT_REFRESH")) {
      return {
        status: "ACCEPTED",
        stdout: runLruWithoutGetRefresh(request.stdin),
        runtimeMs: 12,
        memoryKb: 4096
      };
    }
    return super.execute(request);
  }
}

function runLruWithoutGetRefresh(stdin: string): string {
  const lines = stdin.trim().split(/\n/);
  const [capacity = 0, operations = 0] = (lines[0] ?? "").trim().split(/\s+/).map(Number);
  const cache = new Map<number, number>();
  const output: number[] = [];

  for (let index = 1; index <= operations; index += 1) {
    const [command, rawKey, rawValue] = (lines[index] ?? "").trim().split(/\s+/);
    const key = Number(rawKey);
    if (command === "get") {
      output.push(cache.has(key) ? cache.get(key)! : -1);
      continue;
    }
    if (command === "put") {
      if (!cache.has(key) && cache.size >= capacity) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) cache.delete(oldestKey);
      }
      cache.set(key, Number(rawValue));
    }
  }

  return output.join(" ");
}

function makeTestApp(executor: Executor = new MockExecutor()) {
  env.EXECUTOR_MODE = "mock";
  const repository = new MemoryRepository(true);
  const languageRepository = new MemoryLanguageRepository(true);
  const submissionEvents = new InMemorySubmissionEventBus();
  const testGenerationQueue = {
    addGenerationJob: async () => {},
    getMetrics: async () => ({
      driver: "memory" as const,
      waiting: 0,
      pending: 0,
      active: 0,
      failed: 0,
      completed: 0,
      workerStatus: "external" as const
    })
  };
  const testCaseGeneration = new TestCaseGenerationService(
    repository,
    languageRepository,
    executor,
    testGenerationQueue
  );
  const worker = new SubmissionWorker(repository, executor, undefined, submissionEvents, testCaseGeneration);
  const queue = new InMemorySubmissionQueue(worker, false);
  const app = createApp({
    repository,
    languageRepository,
    executor,
    queue,
    submissionEvents,
    autoProcessSubmissions: false
  });
  return { app, repository, queue, submissionEvents };
}

function makeJudge0TestApp() {
  const repository = new MemoryRepository(true);
  const languageRepository = new MemoryLanguageRepository(true);
  const executor = new Judge0Executor();
  const app = createApp({ repository, languageRepository, executor, autoProcessSubmissions: false });
  return { app, repository, queue: getAppContext(app).queue };
}

async function loginDemo(app: ReturnType<typeof createApp>) {
  const response = await request(app).post("/api/v1/auth/login").send({
    email: "demo@codearena.dev",
    password: "Password123!"
  });
  return response.body.data.tokens.accessToken as string;
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const response = await request(app).post("/api/v1/auth/login").send({
    email: "admin@codearena.dev",
    password: "Password123!"
  });
  return response.body.data.tokens.accessToken as string;
}

async function firstProblem(app: ReturnType<typeof createApp>) {
  const response = await request(app).get("/api/v1/problems?limit=1");
  return response.body.data[0] as { id: string; slug: string; title: string };
}

async function createGenerationAsset(
  app: ReturnType<typeof createApp>,
  adminToken: string,
  problemId: string,
  type: "GENERATOR" | "REFERENCE_SOLUTION" | "VALIDATOR" | "CHECKER",
  sourceCode: string
) {
  return request(app)
    .post(`/api/v1/admin/problems/${problemId}/assets`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      type,
      languageKey: "python",
      filename: `${type.toLowerCase()}.py`,
      sourceCode
    });
}

async function createCheckerProblem(
  app: ReturnType<typeof createApp>,
  adminToken: string,
  slug: string,
  expectedOutput = "1 2 3\n"
) {
  const created = await request(app)
    .post("/api/v1/problems")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      slug,
      title: slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      difficulty: "EASY",
      description: "Return a valid output for custom checker tests.",
      constraints: "Small input",
      inputFormat: "Whitespace separated integers",
      outputFormat: "Whitespace separated integers",
      starterCode: { CPP: "", JAVA: "", PYTHON: "", JAVASCRIPT: "" },
      tags: ["Checker"]
    });
  expect(created.status).toBe(201);
  const problem = created.body.data as { id: string; slug: string };
  const hidden = await request(app)
    .post(`/api/v1/problems/${problem.id}/testcases`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      input: "1 2 3\n",
      expectedOutput,
      isSample: false,
      isStrict: true,
      order: 1
    });
  expect(hidden.status).toBe(201);
  return problem;
}

async function readSse(
  app: ReturnType<typeof createApp>,
  path: string,
  token: string,
  mode: "firstEvent" | "end" = "firstEvent"
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (
      request: http.ClientRequest,
      result: { statusCode: number; headers: http.IncomingHttpHeaders; body: string }
    ) => {
      if (settled) return;
      settled = true;
      request.destroy();
      server.close(() => resolve(result));
    };

    const clientRequest = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`
        }
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
          if (mode === "firstEvent" && body.includes("\n\n")) {
            finish(clientRequest, { statusCode: response.statusCode ?? 0, headers: response.headers, body });
          }
        });
        response.on("end", () =>
          finish(clientRequest, { statusCode: response.statusCode ?? 0, headers: response.headers, body })
        );
      }
    );
    clientRequest.on("error", (error) => {
      if (settled) return;
      settled = true;
      server.close(() => reject(error));
    });
    clientRequest.end();
  });
}

function parseFirstSubmissionEvent(body: string): SubmissionStatusEvent {
  const dataLine = body.split(/\r?\n/).find((line) => line.startsWith("data: "));
  if (!dataLine) throw new Error(`No SSE data line found in ${body}`);
  return JSON.parse(dataLine.slice("data: ".length)) as SubmissionStatusEvent;
}

describe("CodeArena API", () => {
  it("redacts secrets and user code from structured logs", async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      }
    });
    const testLogger = pino({ ...loggerOptions, transport: undefined }, stream);
    testLogger.info(
      {
        req: {
          headers: {
            authorization: "Bearer production-secret-token",
            cookie: "refreshToken=super-secret-refresh",
            "x-api-key": "internal-api-key"
          },
          body: {
            password: "plain-password",
            refreshToken: "refresh-token",
            code: "print('source code')"
          }
        },
        sourceCode: "console.log('do not log me')"
      },
      "redaction test"
    );

    await new Promise((resolve) => setImmediate(resolve));
    const output = chunks.join("");
    expect(output).toContain("[Redacted]");
    expect(output).not.toContain("production-secret-token");
    expect(output).not.toContain("super-secret-refresh");
    expect(output).not.toContain("internal-api-key");
    expect(output).not.toContain("plain-password");
    expect(output).not.toContain("refresh-token");
    expect(output).not.toContain("source code");
    expect(output).not.toContain("do not log me");
  });

  it("reports health with queue metadata", async () => {
    const { app } = makeTestApp();
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.data.queue.driver).toBe("memory");
    expect(response.body.data.queue.pending).toBe(0);
  });

  it("registers and logs in a user", async () => {
    const { app } = makeTestApp();
    const register = await request(app).post("/api/v1/auth/register").send({
      email: "new@codearena.dev",
      username: "newuser",
      displayName: "New User",
      password: "Password123!"
    });
    expect(register.status).toBe(201);
    expect(register.body.data.user.passwordHash).toBeUndefined();

    const login = await request(app).post("/api/v1/auth/login").send({
      email: "new@codearena.dev",
      password: "Password123!"
    });
    expect(login.status).toBe(200);
    expect(login.body.data.tokens.accessToken).toEqual(expect.any(String));
  });

  it("lists and filters problems with pagination", async () => {
    const { app } = makeTestApp();
    const response = await request(app).get("/api/v1/problems?difficulty=EASY&limit=5");
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeLessThanOrEqual(5);
    expect(response.body.meta.total).toBeGreaterThan(0);
  });

  it("enforces admin-only problem creation", async () => {
    const { app } = makeTestApp();
    const userToken = await loginDemo(app);
    const denied = await request(app)
      .post("/api/v1/problems")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        slug: "sample-problem",
        title: "Sample Problem",
        difficulty: "EASY",
        description: "A problem used for RBAC testing.",
        constraints: "n <= 10",
        inputFormat: "n",
        outputFormat: "n",
        starterCode: { CPP: "", JAVA: "", PYTHON: "", JAVASCRIPT: "" },
        tags: ["Array"]
      });
    expect(denied.status).toBe(403);

    const adminToken = await loginAdmin(app);
    const created = await request(app)
      .post("/api/v1/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: "sample-problem",
        title: "Sample Problem",
        difficulty: "EASY",
        description: "A problem used for RBAC testing.",
        constraints: "n <= 10",
        inputFormat: "n",
        outputFormat: "n",
        starterCode: { CPP: "", JAVA: "", PYTHON: "", JAVASCRIPT: "" },
        tags: ["Array"]
      });
    expect(created.status).toBe(201);
  });

  it("hides private problems and contests from public APIs", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);

    const privateProblem = await request(app)
      .post("/api/v1/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: "private-problem",
        title: "Private Problem",
        difficulty: "EASY",
        description: "A private problem used for visibility testing.",
        constraints: "n <= 10",
        inputFormat: "n",
        outputFormat: "n",
        starterCode: { CPP: "", JAVA: "", PYTHON: "", JAVASCRIPT: "" },
        tags: ["Array"],
        visibility: "PRIVATE"
      });
    expect(privateProblem.status).toBe(201);

    const publicProblemDetail = await request(app).get("/api/v1/problems/private-problem");
    expect(publicProblemDetail.status).toBe(404);

    const customRun = await request(app)
      .post("/api/v1/run/custom")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemId: privateProblem.body.data.id, language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT", input: "1" });
    expect(customRun.status).toBe(404);

    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const privateContest = await request(app)
      .post("/api/v1/admin/contests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Private Round",
        slug: "private-round",
        description: "Private contest",
        startTime,
        endTime,
        problemIds: [privateProblem.body.data.id],
        visibility: "PRIVATE"
      });
    expect(privateContest.status).toBe(201);

    const publicContestDetail = await request(app).get(`/api/v1/contests/${privateContest.body.data.id}`);
    expect(publicContestDetail.status).toBe(404);

    const adminContestDetail = await request(app)
      .get(`/api/v1/admin/contests/${privateContest.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminContestDetail.status).toBe(200);
  });

  it("returns field-level validation errors", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const response = await request(app)
      .post("/api/v1/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: "Bad Slug",
        title: "Bad",
        difficulty: "EASY",
        description: "Too short",
        constraints: "n <= 10",
        inputFormat: "n",
        outputFormat: "n",
        starterCode: { CPP: "", JAVA: "", PYTHON: "", JAVASCRIPT: "" },
        tags: ["Array"]
      });
    expect(response.status).toBe(400);
    expect(response.body.error.details.issues[0]).toEqual(
      expect.objectContaining({ path: expect.any(String), message: expect.any(String) })
    );
  });

  it("runs code through MockExecutor", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const response = await request(app)
      .post("/api/v1/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACCEPTED");
    expect(response.body.data.results[0].actualOutput).toBe("0 1");
  });

  it("returns wrong answer when C code prints nothing for the Two Sum sample", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const response = await request(app)
      .post("/api/v1/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", languageKey: "c", code: cNoOutput });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("WRONG_ANSWER");
    expect(response.body.data.results[0]).toEqual(
      expect.objectContaining({
        actualOutput: "",
        expectedOutput: "0 1",
        status: "WRONG_ANSWER"
      })
    );
  });

  it("returns wrong answer when code prints the wrong sample output", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const response = await request(app)
      .post("/api/v1/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", languageKey: "c", code: cWrongOutput });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("WRONG_ANSWER");
    expect(response.body.data.results[0].actualOutput).toBe("1 2\n");
  });

  it("accepts sample runs only when stdout matches expected output", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const response = await request(app)
      .post("/api/v1/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", languageKey: "c", code: cCorrectSampleOutput });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACCEPTED");
    expect(response.body.data.results[0].actualOutput).toBe("0 1\n");
  });

  it("does not let starter code with no output pass sample runs", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const response = await request(app)
      .post("/api/v1/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", languageKey: "c", code: cNoOutput });

    expect(response.status).toBe(200);
    expect(response.body.data.status).not.toBe("ACCEPTED");
    expect(response.body.data.results[0].actualOutput).toBe("");
  });

  it("does not let MockExecutor auto-accept without an explicit deterministic fixture", async () => {
    const executor = new MockExecutor();
    const empty = await executor.execute({
      problemSlug: "two-sum",
      language: "C 11",
      sourceCode: cNoOutput,
      stdin: "4\n2 7 11 15\n9",
      timeLimitMs: 2000,
      memoryLimitMb: 256
    });
    expect(empty.stdout).toBe("");

    const explicit = await executor.execute({
      problemSlug: "two-sum",
      language: "C 11",
      sourceCode: "# MOCK_FIXTURE_OUTPUT",
      stdin: "4\n2 7 11 15\n9",
      timeLimitMs: 2000,
      memoryLimitMb: 256
    });
    expect(explicit.stdout).toBe("0 1");
  });

  it("marks official submissions with empty output as wrong answer", async () => {
    const { app, repository, queue } = makeTestApp();
    const token = await loginDemo(app);
    const problem = await repository.findProblemBySlug("two-sum");
    expect(problem).toBeDefined();
    const storedCases = await repository.listTestCases(problem!.id);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", languageKey: "c", code: cNoOutput });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("WRONG_ANSWER");
    expect(detail.body.data.results.map((result: { testCaseId: string }) => result.testCaseId).sort()).toEqual(
      storedCases.map((testCase) => testCase.id).sort()
    );
    expect(
      detail.body.data.results.find(
        (result: { testCaseId: string }) => result.testCaseId === storedCases.find((testCase) => !testCase.isSample)?.id
      )
    ).toEqual(
      expect.objectContaining({
        actualOutput: "[hidden judge output]",
        expectedOutput: "[hidden judge output]",
        status: "WRONG_ANSWER"
      })
    );
  });

  it("creates a submission and processes the worker flow", async () => {
    const { app, queue } = makeTestApp();
    const token = await loginDemo(app);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    expect(submit.status).toBe(201);
    const submissionId = submit.body.data.submissionId as string;
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("ACCEPTED");
    expect(detail.body.data.results.length).toBeGreaterThan(0);
  });

  it("exposes only sample test cases publicly and keeps hidden stored cases private", async () => {
    const { app, repository } = makeTestApp();
    const problem = await repository.findProblemBySlug("two-sum");
    expect(problem).toBeDefined();
    const storedCases = await repository.listTestCases(problem!.id);
    const hiddenCase = storedCases.find((testCase) => !testCase.isSample);
    expect(hiddenCase).toBeDefined();

    const response = await request(app).get("/api/v1/problems/two-sum");

    expect(response.status).toBe(200);
    expect(response.body.data.sampleTestCases).toHaveLength(storedCases.filter((testCase) => testCase.isSample).length);
    expect(response.body.data.sampleTestCases.every((testCase: { isSample: boolean }) => testCase.isSample)).toBe(true);
    expect(JSON.stringify(response.body.data)).not.toContain(hiddenCase!.input);
    expect(JSON.stringify(response.body.data)).not.toContain(hiddenCase!.expectedOutput);
  });

  it("reuses the same persisted problem test cases for every user submission", async () => {
    const { app, repository, queue } = makeTestApp();
    const problem = await repository.findProblemBySlug("two-sum");
    expect(problem).toBeDefined();
    const storedBefore = await repository.listTestCases(problem!.id);
    expect(storedBefore.length).toBeGreaterThan(1);
    const storedCaseIds = storedBefore.map((testCase) => testCase.id).sort();
    const userToken = await loginDemo(app);
    const otherUser = await request(app).post("/api/v1/auth/register").send({
      email: "samecases@codearena.dev",
      username: "samecases",
      displayName: "Same Cases",
      password: "Password123!"
    });
    const otherToken = otherUser.body.data.tokens.accessToken as string;

    const firstSubmit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    const secondSubmit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    expect(firstSubmit.status).toBe(201);
    expect(secondSubmit.status).toBe(201);
    await queue.processPending?.();

    const storedAfter = await repository.listTestCases(problem!.id);
    expect(storedAfter.map((testCase) => testCase.id).sort()).toEqual(storedCaseIds);
    const firstDetail = await request(app)
      .get(`/api/v1/submissions/${firstSubmit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    const secondDetail = await request(app)
      .get(`/api/v1/submissions/${secondSubmit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(firstDetail.body.data.results.map((result: { testCaseId: string }) => result.testCaseId).sort()).toEqual(
      storedCaseIds
    );
    expect(secondDetail.body.data.results.map((result: { testCaseId: string }) => result.testCaseId).sort()).toEqual(
      storedCaseIds
    );
  });

  it("rejects LRU submissions that do not refresh recency on get", async () => {
    const { app, repository, queue } = makeTestApp(new LruGetDoesNotRefreshExecutor());
    const problem = await repository.findProblemBySlug("lru-cache");
    expect(problem).toBeDefined();
    const storedCases = await repository.listTestCases(problem!.id);
    expect(storedCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: "2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 1\nget 2",
          expectedOutput: "1 1 -1",
          isSample: false
        })
      ])
    );
    const token = await loginDemo(app);

    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "lru-cache", languageKey: "javascript", code: "MOCK_LRU_GET_DOES_NOT_REFRESH" });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("WRONG_ANSWER");
    expect(detail.body.data.results).toHaveLength(storedCases.length);
    expect(detail.body.data.results.map((result: { status: string }) => result.status)).toContain("WRONG_ANSWER");
  });

  it("streams the initial SSE status for a user's own submission without leaking code or hidden test data", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    const submissionId = submit.body.data.submissionId as string;

    const stream = await readSse(app, `/api/v1/submissions/${submissionId}/events`, token);
    const event = parseFirstSubmissionEvent(stream.body);
    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    expect(event).toEqual({
      submissionId,
      status: "PENDING",
      passedTestCases: 0,
      totalTestCases: expect.any(Number),
      runtime: null,
      memory: null,
      updatedAt: expect.any(String)
    });
    expect(Object.keys(event).sort()).toEqual(
      ["memory", "passedTestCases", "runtime", "status", "submissionId", "totalTestCases", "updatedAt"].sort()
    );
    expect(stream.body).not.toContain("# MOCK_FIXTURE_OUTPUT");
    expect(stream.body).not.toContain("2 7 11 15");
    expect(stream.body).not.toContain("expectedOutput");
  });

  it("rejects SSE subscriptions to another user's submission", async () => {
    const { app } = makeTestApp();
    const ownerToken = await loginDemo(app);
    const otherUser = await request(app).post("/api/v1/auth/register").send({
      email: "other@codearena.dev",
      username: "otheruser",
      displayName: "Other User",
      password: "Password123!"
    });
    const otherToken = otherUser.body.data.tokens.accessToken as string;
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });

    const denied = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}/events`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(denied.status).toBe(403);
  });

  it("allows admins to subscribe to any terminal submission and closes the SSE stream", async () => {
    const { app, queue } = makeTestApp();
    const userToken = await loginDemo(app);
    const adminToken = await loginAdmin(app);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    const submissionId = submit.body.data.submissionId as string;
    await queue.processPending?.();

    const stream = await readSse(app, `/api/v1/submissions/${submissionId}/events`, adminToken, "end");
    const event = parseFirstSubmissionEvent(stream.body);
    expect(stream.statusCode).toBe(200);
    expect(event.status).toBe("ACCEPTED");
    expect(stream.body.trim().endsWith("}")).toBe(true);
  });

  it("publishes RUNNING and final worker status events", async () => {
    const { app, queue, submissionEvents } = makeTestApp();
    const token = await loginDemo(app);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    const submissionId = submit.body.data.submissionId as string;
    const events: SubmissionStatusEvent[] = [];
    const unsubscribe = submissionEvents.subscribeToSubmission(submissionId, (event) => events.push(event));

    await queue.processPending?.();
    unsubscribe();

    expect(events.map((event) => event.status)).toContain("RUNNING");
    expect(events.at(-1)).toEqual(
      expect.objectContaining({ submissionId, status: "ACCEPTED", passedTestCases: expect.any(Number) })
    );
    expect(JSON.stringify(events)).not.toContain("# MOCK_FIXTURE_OUTPUT");
    expect(JSON.stringify(events)).not.toContain("expectedOutput");
  });

  it("keeps the polling detail endpoint available while live updates are unavailable", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("PENDING");
  });

  it("marks submissions as internal errors when the executor fails", async () => {
    const previousMode = env.EXECUTOR_MODE;
    env.EXECUTOR_MODE = "mock";
    try {
      const repository = new MemoryRepository(true);
      const languageRepository = new MemoryLanguageRepository(true);
      const executor: Executor = {
        execute: async () => {
          throw new Error("executor unavailable");
        }
      };
      const worker = new SubmissionWorker(repository, executor);
      const queue = new InMemorySubmissionQueue(worker, false);
      const app = createApp({ repository, languageRepository, executor, queue, autoProcessSubmissions: false });
      const token = await loginDemo(app);
      const submit = await request(app)
        .post("/api/v1/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });

      await queue.processPending?.();
      const detail = await request(app)
        .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.status).toBe("INTERNAL_ERROR");
      expect(detail.body.data.errorMessage).toContain("executor unavailable");
    } finally {
      env.EXECUTOR_MODE = previousMode;
    }
  });

  it("supports contest registration and leaderboard calculation", async () => {
    const { app, queue } = makeTestApp();
    const token = await loginDemo(app);
    const contests = await request(app).get("/api/v1/contests");
    const contestId = contests.body.data[0].id as string;

    const registration = await request(app)
      .post(`/api/v1/contests/${contestId}/register`)
      .set("Authorization", `Bearer ${token}`);
    expect(registration.status).toBe(201);

    const submit = await request(app)
      .post(`/api/v1/contests/${contestId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const leaderboard = await request(app).get(`/api/v1/contests/${contestId}/leaderboard`);
    expect(leaderboard.status).toBe(200);
    expect(leaderboard.body.data[0].solvedCount).toBeGreaterThanOrEqual(1);
  });

  it("supports general discussion CRUD, comments, and votes", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const created = await request(app)
      .post("/api/v1/discussions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "General DP thread", content: "How should I revise interval DP?", tags: ["dp"] });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const list = await request(app).get("/api/v1/discussions");
    expect(list.status).toBe(200);
    expect(list.body.data.some((item: { id: string }) => item.id === id)).toBe(true);

    const comment = await request(app)
      .post(`/api/v1/discussions/${id}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Start with small ranges." });
    expect(comment.status).toBe(201);
    const commentId = comment.body.data.id as string;

    const updatedComment = await request(app)
      .patch(`/api/v1/discussion-comments/${commentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Start with length-two ranges." });
    expect(updatedComment.status).toBe(200);

    const vote = await request(app)
      .post(`/api/v1/discussions/${id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ value: 1 });
    expect(vote.status).toBe(200);

    const detail = await request(app).get(`/api/v1/discussions/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.upvotes).toBe(1);
    expect(detail.body.data.comments[0].content).toContain("length-two");

    const updated = await request(app)
      .patch(`/api/v1/discussions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated DP thread" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("Updated DP thread");
  });

  it("supports admin user role and status management with self-protection", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const users = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${adminToken}`);
    expect(users.status).toBe(200);
    const demo = users.body.data.find((item: { username: string }) => item.username === "demo") as { id: string };
    const admin = users.body.data.find((item: { username: string }) => item.username === "admin") as { id: string };

    const role = await request(app)
      .patch(`/api/v1/admin/users/${demo.id}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "ADMIN" });
    expect(role.status).toBe(200);
    expect(role.body.data.role).toBe("ADMIN");

    const inactive = await request(app)
      .patch(`/api/v1/admin/users/${demo.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.data.status).toBe("INACTIVE");

    const selfDeactivate = await request(app)
      .patch(`/api/v1/admin/users/${admin.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });
    expect(selfDeactivate.status).toBe(400);
  });

  it("supports admin contest management", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const problems = await request(app).get("/api/v1/problems?limit=3");
    const ids = problems.body.data.map((problem: { id: string }) => problem.id) as string[];
    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const created = await request(app)
      .post("/api/v1/admin/contests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Admin Round",
        slug: "admin-round",
        description: "Admin managed contest",
        startTime,
        endTime,
        problemIds: [ids[0]]
      });
    expect(created.status).toBe(201);
    const contestId = created.body.data.id as string;

    const updated = await request(app)
      .patch(`/api/v1/admin/contests/${contestId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Admin Round Updated" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("Admin Round Updated");

    const add = await request(app)
      .post(`/api/v1/admin/contests/${contestId}/problems`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ problemId: ids[1], points: 200 });
    expect(add.status).toBe(201);

    const duplicate = await request(app)
      .post(`/api/v1/admin/contests/${contestId}/problems`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ problemId: ids[1] });
    expect(duplicate.status).toBe(409);
  });

  it("supports editorial draft and publish visibility", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const problems = await request(app).get("/api/v1/problems?limit=1");
    const problem = problems.body.data[0] as { id: string; slug: string };

    const draft = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/editorial`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Draft Editorial", content: "Draft content", isPublished: false });
    expect(draft.status).toBe(201);

    const hidden = await request(app).get(`/api/v1/problems/${problem.slug}/editorial`);
    expect(hidden.body.data).toBeNull();

    const published = await request(app)
      .patch(`/api/v1/admin/editorials/${draft.body.data.id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(published.status).toBe(200);

    const visible = await request(app).get(`/api/v1/problems/${problem.slug}/editorial`);
    expect(visible.body.data.content).toBe("Draft content");
  });

  it("returns real streak stats and custom input runs", async () => {
    const { app, queue } = makeTestApp();
    const token = await loginDemo(app);
    const problem = (await request(app).get("/api/v1/problems?limit=1")).body.data[0] as { id: string; slug: string };

    const custom = await request(app)
      .post("/api/v1/run/custom")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemId: problem.id, language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT", input: "2 7 11 15\n9" });
    expect(custom.status).toBe(200);
    expect(custom.body.data.status).toBe("ACCEPTED");
    expect(custom.body.data.stdout).toEqual(expect.any(String));

    await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: problem.slug, language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    await queue.processPending?.();

    const stats = await request(app).get("/api/v1/users/demo/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.data.currentStreak).toBeGreaterThanOrEqual(1);
    expect(stats.body.data.longestStreak).toBeGreaterThanOrEqual(1);
    expect(stats.body.data.submissionCalendar.length).toBeGreaterThanOrEqual(1);
  });

  it("calculates leaderboard rank movement from snapshots", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const token = await loginDemo(app);

    const snapshot = await request(app)
      .post("/api/v1/leaderboard/snapshot")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(snapshot.status).toBe(201);

    await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    await queue.processPending?.();

    const leaderboard = await request(app).get("/api/v1/leaderboard");
    expect(leaderboard.status).toBe(200);
    const demo = leaderboard.body.data.find((row: { user: { username: string } }) => row.user.username === "demo");
    expect(demo.rankMovementDirection).toMatch(/UP|SAME|NEW/);
    expect(demo.rankMovement).toEqual(expect.any(Number));
  });

  it("exposes context for worker-oriented tests", () => {
    const { app } = makeTestApp();
    expect(getAppContext(app).worker).toBeDefined();
  });

  it("lists active languages and problem-specific starter code", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const languages = await request(app).get("/api/v1/languages");
    expect(languages.status).toBe(200);
    expect(languages.body.data.length).toBeGreaterThan(20);

    const problem = (await request(app).get("/api/v1/problems?limit=1")).body.data[0] as { id: string; slug: string };
    const python = languages.body.data.find((item: { key: string }) => item.key === "python") as {
      id: string;
      versions: Array<{ id: string }>;
    };
    const rust = languages.body.data.find((item: { key: string }) => item.key === "rust") as {
      id: string;
      versions: Array<{ id: string }>;
    };
    const versionId = python.versions[0].id as string;
    const starter = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/starter-code`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ languageId: python.id, languageVersionId: versionId, code: "print('problem starter')" });
    expect(starter.status).toBe(201);
    const mismatchedStarter = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/starter-code`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ languageId: python.id, languageVersionId: rust.versions[0].id, code: "invalid" });
    expect(mismatchedStarter.status).toBe(400);

    const problemLanguages = await request(app).get(`/api/v1/problems/${problem.slug}/languages`);
    expect(problemLanguages.status).toBe(200);
    const pythonOption = problemLanguages.body.data.find(
      (item: { language: { key: string } }) => item.language.key === "python"
    );
    expect(pythonOption.starterCode).toContain("problem starter");
    const rustOption = problemLanguages.body.data.find(
      (item: { language: { key: string } }) => item.language.key === "rust"
    );
    expect(rustOption.starterCode).toEqual(expect.any(String));
  });

  it("enforces admin-only language routes and supports create/update/disable", async () => {
    const { app } = makeTestApp();
    const userToken = await loginDemo(app);
    const denied = await request(app).get("/api/v1/admin/languages").set("Authorization", `Bearer ${userToken}`);
    expect(denied.status).toBe(403);
    const deniedSync = await request(app)
      .post("/api/v1/admin/languages/sync/judge0")
      .set("Authorization", `Bearer ${userToken}`);
    expect(deniedSync.status).toBe(403);

    const adminToken = await loginAdmin(app);
    const created = await request(app)
      .post("/api/v1/admin/languages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "brainlang",
        displayName: "BrainLang",
        monacoId: "plaintext",
        fileExtension: "brain",
        category: "EDUCATIONAL",
        isCompiled: false,
        sortOrder: 999
      });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/v1/admin/languages/${created.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.isActive).toBe(false);
  });

  it("supports language version mutations and rejects disabled selections", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const problem = (await request(app).get("/api/v1/problems?limit=1")).body.data[0] as { id: string; slug: string };
    const languages = (await request(app).get("/api/v1/languages")).body.data as Array<{
      id: string;
      key: string;
      versions: Array<{ id: string }>;
    }>;
    const python = languages.find((language) => language.key === "python")!;

    const createdVersion = await request(app)
      .post(`/api/v1/admin/languages/${python.id}/versions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ version: "Python Disabled", label: "Python Disabled", sourceFileName: "main.py", isActive: false });
    expect(createdVersion.status).toBe(201);

    const disabledSubmit = await request(app).post("/api/v1/submit").set("Authorization", `Bearer ${userToken}`).send({
      problemSlug: problem.slug,
      languageId: python.id,
      languageVersionId: createdVersion.body.data.id,
      code: "# MOCK_FIXTURE_OUTPUT"
    });
    expect(disabledSubmit.status).toBe(400);

    await request(app)
      .patch(`/api/v1/admin/problems/${problem.id}/languages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ languages: [{ languageId: python.id, languageVersionId: python.versions[0].id, isEnabled: false }] });
    const disabledProblemRun = await request(app).post("/api/v1/run").set("Authorization", `Bearer ${userToken}`).send({
      problemSlug: problem.slug,
      languageId: python.id,
      languageVersionId: python.versions[0].id,
      code: "# MOCK_FIXTURE_OUTPUT"
    });
    expect(disabledProblemRun.status).toBe(400);
  });

  it("rejects globally disabled languages and missing active execution profiles on submit", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const languages = (await request(app).get("/api/v1/admin/languages").set("Authorization", `Bearer ${adminToken}`))
      .body.data as Array<{
      id: string;
      key: string;
      versions: Array<{ id: string }>;
    }>;
    const python = languages.find((language) => language.key === "python")!;
    const pypy = languages.find((language) => language.key === "pypy")!;

    const disabledLanguage = await request(app)
      .patch(`/api/v1/admin/languages/${python.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disabledLanguage.status).toBe(200);

    const globallyDisabledSubmit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        problemSlug: "two-sum",
        languageId: python.id,
        languageVersionId: python.versions[0].id,
        code: "# MOCK_FIXTURE_OUTPUT"
      });
    expect(globallyDisabledSubmit.status).toBe(400);

    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = "https://judge0.test";
    try {
      const missingProfileSubmit = await request(app)
        .post("/api/v1/submit")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          problemSlug: "two-sum",
          languageId: pypy.id,
          languageVersionId: pypy.versions[0].id,
          code: "# MOCK_FIXTURE_OUTPUT"
        });
      expect(missingProfileSubmit.status).toBe(400);
      expect(missingProfileSubmit.body.error.code).toBe("LANGUAGE_EXECUTOR_UNAVAILABLE");
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
    }
  });

  it("accepts dynamic language keys without a fixed run/submit enum", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const response = await request(app)
      .post("/api/v1/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "rust", code: "# MOCK_FIXTURE_OUTPUT" });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACCEPTED");
  });

  it("reports executor capabilities and protects admin capability endpoints", async () => {
    const { app } = makeTestApp();
    const userToken = await loginDemo(app);
    const adminToken = await loginAdmin(app);
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = undefined;
    try {
      const publicCapabilities = await request(app).get("/api/v1/executor/capabilities?problemSlug=two-sum");
      expect(publicCapabilities.status).toBe(200);
      expect(publicCapabilities.body.data.executorType).toBe("JUDGE0");
      expect(publicCapabilities.body.data.executorConfigured).toBe(false);
      expect(publicCapabilities.body.data.summary.unsupportedLanguageVersions).toBeGreaterThan(0);
      expect(publicCapabilities.body.data.languages.every((entry: { canRun: boolean }) => entry.canRun === false)).toBe(
        true
      );

      const denied = await request(app)
        .get("/api/v1/admin/executor/capabilities")
        .set("Authorization", `Bearer ${userToken}`);
      expect(denied.status).toBe(403);

      const adminCapabilities = await request(app)
        .get("/api/v1/admin/executor/capabilities")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminCapabilities.status).toBe(200);
      expect(adminCapabilities.body.data.executorConfigurationReason).toContain("JUDGE0_BASE_URL");

      const health = await request(app)
        .get("/api/v1/admin/executor/health")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(health.status).toBe(200);
      expect(health.body.data.executorConfigured).toBe(false);
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
    }
  });

  it("reports local Judge0 health and safe unreachable errors", async () => {
    const { app } = makeTestApp();
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousApiKey = env.JUDGE0_API_KEY;
    const previousFetch = global.fetch;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = "http://localhost:2358";
    env.JUDGE0_API_KEY = "secret-judge0-key";
    try {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockJudge0Response([{ id: 50, name: "C (GCC 9.2.0)" }])) as unknown as typeof fetch;
      const reachable = await request(app).get("/api/v1/executor/health");
      expect(reachable.status).toBe(200);
      expect(reachable.body.data).toEqual(
        expect.objectContaining({
          executorMode: "judge0",
          isProductionJudge: true,
          judge0Reachable: true,
          baseUrlConfigured: true
        })
      );
      expect(JSON.stringify(reachable.body)).not.toContain("secret-judge0-key");

      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
      const unreachable = await request(app).get("/api/v1/executor/health");
      expect(unreachable.status).toBe(400);
      expect(unreachable.body.message).toBe(
        "Judge0 is not reachable at http://localhost:2358. Start local Judge0 Docker services first."
      );
      expect(JSON.stringify(unreachable.body)).not.toContain("secret-judge0-key");
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
      env.JUDGE0_API_KEY = previousApiKey;
      global.fetch = previousFetch;
    }
  });

  it("requires JUDGE0_BASE_URL when EXECUTOR_MODE is judge0", async () => {
    const { app } = makeTestApp();
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = undefined;
    try {
      const health = await request(app).get("/api/v1/executor/health");
      expect(health.status).toBe(400);
      expect(health.body.message).toContain("JUDGE0_BASE_URL");
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
    }
  });

  it("rejects run and submit when the selected executor is unavailable", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = undefined;
    try {
      const run = await request(app)
        .post("/api/v1/run")
        .set("Authorization", `Bearer ${token}`)
        .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
      expect(run.status).toBe(400);
      expect(run.body.error.code).toBe("LANGUAGE_EXECUTOR_UNAVAILABLE");

      const submit = await request(app)
        .post("/api/v1/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ problemSlug: "two-sum", language: "pypy", code: "# MOCK_FIXTURE_OUTPUT" });
      expect(submit.status).toBe(400);
      expect(submit.body.error.code).toBe("LANGUAGE_EXECUTOR_UNAVAILABLE");
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
    }
  });

  it("protects judge queue and deep health admin endpoints", async () => {
    const { app } = makeTestApp();
    const userToken = await loginDemo(app);
    const adminToken = await loginAdmin(app);

    const deniedQueue = await request(app).get("/api/v1/admin/judge/queue").set("Authorization", `Bearer ${userToken}`);
    expect(deniedQueue.status).toBe(403);

    const queue = await request(app).get("/api/v1/admin/judge/queue").set("Authorization", `Bearer ${adminToken}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data).toEqual(
      expect.objectContaining({ driver: "memory", waiting: expect.any(Number), active: expect.any(Number) })
    );

    const deepHealth = await request(app).get("/api/v1/admin/health/deep").set("Authorization", `Bearer ${adminToken}`);
    expect(deepHealth.status).toBe(200);
    expect(deepHealth.body.data).toEqual(
      expect.objectContaining({
        database: expect.any(Object),
        executor: expect.any(Object),
        queue: expect.any(Object),
        testGenerationQueue: expect.any(Object)
      })
    );
  });

  it("protects test generation assets with admin RBAC", async () => {
    const { app } = makeTestApp();
    const userToken = await loginDemo(app);
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);

    const denied = await createGenerationAsset(app, userToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    expect(denied.status).toBe(403);

    const deniedAssets = await request(app)
      .get(`/api/v1/admin/problems/${problem.id}/assets`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(deniedAssets.status).toBe(403);

    const deniedPreview = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation/preview`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ seed: 1 });
    expect(deniedPreview.status).toBe(403);

    const deniedJob = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ batchName: "Denied", seedStart: 1, count: 1 });
    expect(deniedJob.status).toBe(403);

    const created = await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(
      expect.objectContaining({ problemId: problem.id, type: "GENERATOR", sourceCode: "# MOCK_GENERATOR" })
    );

    const assets = await request(app)
      .get(`/api/v1/admin/problems/${problem.id}/assets`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(assets.status).toBe(200);
    expect(assets.body.data.some((asset: { type: string }) => asset.type === "GENERATOR")).toBe(true);
  });

  it("keeps standard checker mode on normalized output comparison", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const problem = await createCheckerProblem(app, adminToken, "standard-checker-mode", "10\n");

    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: problem.slug, language: "PYTHON", code: "# MOCK_STDOUT: 10   \\n" });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("ACCEPTED");
  });

  it("protects checker mode and checker source with backend admin RBAC", async () => {
    const { app } = makeTestApp();
    const userToken = await loginDemo(app);
    const adminToken = await loginAdmin(app);
    const problem = await createCheckerProblem(app, adminToken, "checker-rbac");
    await createGenerationAsset(app, adminToken, problem.id, "CHECKER", "# MOCK_CHECKER_ANY_ORDER");

    const deniedMode = await request(app)
      .patch(`/api/v1/admin/problems/${problem.id}/checker-mode`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });
    expect(deniedMode.status).toBe(403);

    const deniedAssets = await request(app)
      .get(`/api/v1/admin/problems/${problem.id}/assets`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(deniedAssets.status).toBe(403);

    const updated = await request(app)
      .patch(`/api/v1/admin/problems/${problem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.checkerMode).toBe("CUSTOM_CHECKER");
  });

  it("previews custom checkers without saving test cases or leaking source", async () => {
    const { app, repository } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const problem = await createCheckerProblem(app, adminToken, "checker-preview");
    await createGenerationAsset(app, adminToken, problem.id, "CHECKER", "# MOCK_CHECKER_ANY_ORDER");
    const beforeCount = (await repository.listTestCases(problem.id)).length;

    const preview = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/checker/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ input: "1 2 3\n", expectedOutput: "1 2 3\n", actualOutput: "3 1 2\n" });

    expect(preview.status).toBe(200);
    expect(preview.body.data).toEqual(
      expect.objectContaining({ verdict: "ACCEPTED", runtimeMs: expect.any(Number), memoryKb: expect.any(Number) })
    );
    expect(JSON.stringify(preview.body.data)).not.toContain("MOCK_CHECKER_ANY_ORDER");
    expect((await repository.listTestCases(problem.id)).length).toBe(beforeCount);
  });

  it("uses custom checkers for official submissions and accepts alternate valid output", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const problem = await createCheckerProblem(app, adminToken, "custom-checker-accepts");
    await createGenerationAsset(app, adminToken, problem.id, "CHECKER", "# MOCK_CHECKER_ANY_ORDER");
    const mode = await request(app)
      .patch(`/api/v1/admin/problems/${problem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });
    expect(mode.status).toBe(200);

    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: problem.slug, language: "PYTHON", code: "# MOCK_STDOUT: 3 1 2\\n" });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("ACCEPTED");
  });

  it("rejects invalid custom checker output and redacts hidden testcase bodies", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const problem = await createCheckerProblem(app, adminToken, "custom-checker-rejects");
    await createGenerationAsset(app, adminToken, problem.id, "CHECKER", "# MOCK_CHECKER_ANY_ORDER");
    await request(app)
      .patch(`/api/v1/admin/problems/${problem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });

    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: problem.slug, language: "PYTHON", code: "# MOCK_STDOUT: 3 1 4\\n" });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("WRONG_ANSWER");
    expect(detail.body.data.results[0]).toEqual(
      expect.objectContaining({
        input: "[hidden judge test]",
        expectedOutput: "[hidden judge output]",
        actualOutput: "[hidden judge output]",
        stderr: null
      })
    );
  });

  it("does not let custom checkers accept empty output unless the checker explicitly accepts it", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const problem = await createCheckerProblem(app, adminToken, "custom-checker-empty-output");
    await createGenerationAsset(app, adminToken, problem.id, "CHECKER", "# MOCK_CHECKER_ANY_ORDER");
    await request(app)
      .patch(`/api/v1/admin/problems/${problem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });

    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: problem.slug, languageKey: "c", code: cNoOutput });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("WRONG_ANSWER");
  });

  it("fails safely when custom checker assets are missing, crash, or time out", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const userToken = await loginDemo(app);
    const missingCheckerProblem = await createCheckerProblem(app, adminToken, "missing-checker");
    const checker = await createGenerationAsset(
      app,
      adminToken,
      missingCheckerProblem.id,
      "CHECKER",
      "# MOCK_CHECKER_ANY_ORDER"
    );
    const missingMode = await request(app)
      .patch(`/api/v1/admin/problems/${missingCheckerProblem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });
    expect(missingMode.status).toBe(200);
    await request(app)
      .delete(`/api/v1/admin/problem-assets/${checker.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const missingSubmit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: missingCheckerProblem.slug, language: "PYTHON", code: "# MOCK_STDOUT: 1 2 3\\n" });
    expect(missingSubmit.status).toBe(201);
    await queue.processPending?.();
    const missingDetail = await request(app)
      .get(`/api/v1/submissions/${missingSubmit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(missingDetail.status).toBe(200);
    expect(missingDetail.body.data.status).toBe("INTERNAL_ERROR");
    expect(missingDetail.body.data.results[0]).toEqual(
      expect.objectContaining({
        input: "[hidden judge test]",
        expectedOutput: "[hidden judge output]",
        actualOutput: "[hidden judge output]",
        stderr: null
      })
    );

    const crashProblem = await createCheckerProblem(app, adminToken, "crashing-checker");
    await createGenerationAsset(app, adminToken, crashProblem.id, "CHECKER", "__RE__");
    await request(app)
      .patch(`/api/v1/admin/problems/${crashProblem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });
    const crashSubmit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: crashProblem.slug, language: "PYTHON", code: "# MOCK_STDOUT: 1 2 3\\n" });
    expect(crashSubmit.status).toBe(201);
    await queue.processPending?.();
    const crashDetail = await request(app)
      .get(`/api/v1/submissions/${crashSubmit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(crashDetail.body.data.status).toBe("INTERNAL_ERROR");

    const timeoutProblem = await createCheckerProblem(app, adminToken, "timeout-checker");
    await createGenerationAsset(app, adminToken, timeoutProblem.id, "CHECKER", "__TLE__");
    await request(app)
      .patch(`/api/v1/admin/problems/${timeoutProblem.id}/checker-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ checkerMode: "CUSTOM_CHECKER" });
    const timeoutSubmit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: timeoutProblem.slug, language: "PYTHON", code: "# MOCK_STDOUT: 1 2 3\\n" });
    expect(timeoutSubmit.status).toBe(201);
    await queue.processPending?.();
    const timeoutDetail = await request(app)
      .get(`/api/v1/submissions/${timeoutSubmit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(timeoutDetail.body.data.status).toBe("INTERNAL_ERROR");
  });

  it("previews generated inputs and expected outputs without leaking asset source", async () => {
    const { app, repository } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "# MOCK_REFERENCE");
    await createGenerationAsset(app, adminToken, problem.id, "VALIDATOR", "# MOCK_VALIDATOR");
    const beforeCount = (await repository.listTestCases(problem.id)).length;

    const preview = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ seed: 5, runValidator: true });

    expect(preview.status).toBe(200);
    expect(preview.body.data.generatedInput).toBe("5\n6\n");
    expect(preview.body.data.expectedOutput).toBe("11");
    expect(preview.body.data.inputHash).toEqual(expect.any(String));
    expect(JSON.stringify(preview.body.data)).not.toContain("MOCK_GENERATOR");
    expect((await repository.listTestCases(problem.id)).length).toBe(beforeCount);
  });

  it("queues generation jobs and persists hidden generated test cases", async () => {
    const { app, repository } = makeTestApp();
    const context = getAppContext(app);
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "# MOCK_REFERENCE");

    const queued = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchName: "Hidden generated tests", seedStart: 10, count: 3, visibility: "HIDDEN" });
    expect(queued.status).toBe(201);
    expect(queued.body.data.status).toBe("PENDING");

    await context.testCaseGenerationQueue.processPending?.();

    const job = await request(app)
      .get(`/api/v1/admin/test-generation-jobs/${queued.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(job.status).toBe(200);
    expect(job.body.data.status).toBe("COMPLETED");
    expect(job.body.data.generatedCases).toBe(3);

    const cases = await repository.listTestCases(problem.id);
    const generated = cases.filter((testCase) => testCase.generatedByJobId === queued.body.data.id);
    expect(generated).toHaveLength(3);
    expect(
      generated.every(
        (testCase) => testCase.isGenerated && !testCase.isSample && testCase.inputHash && testCase.outputHash
      )
    ).toBe(true);

    const publicProblem = await request(app).get(`/api/v1/problems/${problem.slug}`);
    expect(publicProblem.status).toBe(200);
    expect(JSON.stringify(publicProblem.body.data.sampleTestCases)).not.toContain("10\n11");

    const batches = await request(app)
      .get(`/api/v1/admin/problems/${problem.id}/testcase-batches`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(batches.status).toBe(200);
    expect(batches.body.data[0]).toEqual(
      expect.objectContaining({ name: "Hidden generated tests", generatedCases: 3 })
    );
    expect(JSON.stringify(batches.body.data)).not.toContain("10\n11");
  });

  it("redacts hidden generated testcase bodies from user submission details", async () => {
    const { app, repository, queue } = makeTestApp();
    const context = getAppContext(app);
    const userToken = await loginDemo(app);
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "# MOCK_REFERENCE");

    const queued = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchName: "Hidden generated tests", seedStart: 20, count: 1, visibility: "HIDDEN" });
    expect(queued.status).toBe(201);
    await context.testCaseGenerationQueue.processPending?.();

    const generated = (await repository.listTestCases(problem.id)).find(
      (testCase) => testCase.generatedByJobId === queued.body.data.id
    );
    expect(generated).toBeDefined();

    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ problemSlug: problem.slug, language: "PYTHON", code: "# MOCK_REFERENCE" });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    const userDetail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(userDetail.status).toBe(200);
    const userGeneratedResult = userDetail.body.data.results.find(
      (result: { testCaseId: string }) => result.testCaseId === generated!.id
    );
    expect(userGeneratedResult).toEqual(
      expect.objectContaining({
        input: "[hidden judge test]",
        expectedOutput: "[hidden judge output]",
        actualOutput: "[hidden judge output]",
        stderr: null
      })
    );

    const adminDetail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminDetail.status).toBe(200);
    const adminGeneratedResult = adminDetail.body.data.results.find(
      (result: { testCaseId: string }) => result.testCaseId === generated!.id
    );
    expect(adminGeneratedResult).toEqual(
      expect.objectContaining({
        input: generated!.input,
        expectedOutput: generated!.expectedOutput
      })
    );
  });

  it("marks generation jobs failed when required assets are missing", async () => {
    const { app } = makeTestApp();
    const context = getAppContext(app);
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");

    const queued = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchName: "Missing reference", seedStart: 1, count: 1 });
    expect(queued.status).toBe(201);

    await context.testCaseGenerationQueue.processPending?.();
    const job = await request(app)
      .get(`/api/v1/admin/test-generation-jobs/${queued.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(job.status).toBe(200);
    expect(job.body.data.status).toBe("FAILED");
    expect(job.body.data.errorMessage).toContain("reference solution asset is required");
    expect(job.body.data.completedAt).toEqual(expect.any(String));
    expect(JSON.stringify(job.body.data)).not.toContain("MOCK_GENERATOR");
  });

  it("fails generation jobs safely when assets crash and removes partial generated cases", async () => {
    const { app, repository } = makeTestApp();
    const context = getAppContext(app);
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_FAIL_ON_SEED_2_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "# MOCK_REFERENCE");

    const generatorFailure = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchName: "Generator failure", seedStart: 1, count: 2, skipDuplicates: false });
    expect(generatorFailure.status).toBe(201);
    await context.testCaseGenerationQueue.processPending?.();

    const failedGeneratorJob = await request(app)
      .get(`/api/v1/admin/test-generation-jobs/${generatorFailure.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(failedGeneratorJob.status).toBe(200);
    expect(failedGeneratorJob.body.data).toEqual(
      expect.objectContaining({
        status: "FAILED",
        generatedCases: 0,
        completedAt: expect.any(String)
      })
    );
    expect(failedGeneratorJob.body.data.errorMessage).toContain("generator failed with RUNTIME_ERROR");
    expect(JSON.stringify(failedGeneratorJob.body.data)).not.toContain("MOCK_FAIL_ON_SEED_2_GENERATOR");
    expect(
      (await repository.listTestCases(problem.id)).filter(
        (testCase) => testCase.generatedByJobId === generatorFailure.body.data.id
      )
    ).toHaveLength(0);

    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "__RE__");
    const referenceFailure = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchName: "Reference failure", seedStart: 1, count: 1 });
    expect(referenceFailure.status).toBe(201);
    await context.testCaseGenerationQueue.processPending?.();

    const failedReferenceJob = await request(app)
      .get(`/api/v1/admin/test-generation-jobs/${referenceFailure.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(failedReferenceJob.status).toBe(200);
    expect(failedReferenceJob.body.data.status).toBe("FAILED");
    expect(failedReferenceJob.body.data.errorMessage).toContain("reference solution failed with RUNTIME_ERROR");
    expect(
      (await repository.listTestCases(problem.id)).filter(
        (testCase) => testCase.generatedByJobId === referenceFailure.body.data.id
      )
    ).toHaveLength(0);
  });

  it("enforces generated input and output size limits", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "# MOCK_REFERENCE");
    const previousInputLimit = env.MAX_GENERATED_INPUT_BYTES;
    const previousOutputLimit = env.MAX_GENERATED_OUTPUT_BYTES;
    try {
      env.MAX_GENERATED_INPUT_BYTES = 2;
      const inputTooLarge = await request(app)
        .post(`/api/v1/admin/problems/${problem.id}/test-generation/preview`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ seed: 5 });
      expect(inputTooLarge.status).toBe(400);
      expect(inputTooLarge.body.message).toContain("Generated input is too large");

      env.MAX_GENERATED_INPUT_BYTES = previousInputLimit;
      env.MAX_GENERATED_OUTPUT_BYTES = 1;
      const outputTooLarge = await request(app)
        .post(`/api/v1/admin/problems/${problem.id}/test-generation/preview`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ seed: 5 });
      expect(outputTooLarge.status).toBe(400);
      expect(outputTooLarge.body.message).toContain("Generated output is too large");
    } finally {
      env.MAX_GENERATED_INPUT_BYTES = previousInputLimit;
      env.MAX_GENERATED_OUTPUT_BYTES = previousOutputLimit;
    }
  });

  it("deduplicates generated inputs when the generator repeats seeds", async () => {
    const { app, repository } = makeTestApp();
    const context = getAppContext(app);
    const adminToken = await loginAdmin(app);
    const problem = await firstProblem(app);
    await createGenerationAsset(app, adminToken, problem.id, "GENERATOR", "# MOCK_DUPLICATE_GENERATOR");
    await createGenerationAsset(app, adminToken, problem.id, "REFERENCE_SOLUTION", "# MOCK_REFERENCE");

    const queued = await request(app)
      .post(`/api/v1/admin/problems/${problem.id}/test-generation-jobs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchName: "Duplicate seeds", seedStart: 1, count: 4, skipDuplicates: true });
    expect(queued.status).toBe(201);

    await context.testCaseGenerationQueue.processPending?.();
    const job = await request(app)
      .get(`/api/v1/admin/test-generation-jobs/${queued.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(job.status).toBe(200);
    expect(job.body.data.status).toBe("COMPLETED");
    expect(job.body.data.generatedCases).toBe(1);

    const generated = (await repository.listTestCases(problem.id)).filter(
      (testCase) => testCase.generatedByJobId === queued.body.data.id
    );
    expect(generated).toHaveLength(1);
  });

  it("preserves admin language overrides during Judge0 sync", async () => {
    const { app } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const languages = (await request(app).get("/api/v1/admin/languages").set("Authorization", `Bearer ${adminToken}`))
      .body.data as Array<{
      id: string;
      key: string;
      versions: Array<{
        id: string;
        label: string;
        judge0Id: number | null;
        isActive: boolean;
        executionProfiles?: Array<{ executorType: string; isActive: boolean }>;
      }>;
    }>;
    const python = languages.find((language) => language.key === "python")!;
    const version = python.versions.find((item) => item.judge0Id === 71)!;

    const disabledProfile = await request(app)
      .patch(`/api/v1/admin/language-versions/${version.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        label: "Admin Python",
        isActive: false,
        executionProfiles: [{ executorType: "JUDGE0", judge0Id: 71, isActive: false }]
      });
    expect(disabledProfile.status).toBe(200);

    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.JUDGE0_BASE_URL = "https://judge0.test";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 71, name: "Python 3", is_archived: false }]
    } as Response);
    try {
      const sync = await request(app)
        .post("/api/v1/admin/languages/sync/judge0")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sync.status).toBe(200);
    } finally {
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }

    const versions = await request(app)
      .get(`/api/v1/admin/languages/${python.id}/versions`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(versions.status).toBe(200);
    const afterSync = versions.body.data.find((item: { id: string }) => item.id === version.id);
    expect(afterSync.label).toBe("Admin Python");
    expect(afterSync.isActive).toBe(false);
    expect(
      afterSync.executionProfiles.find((profile: { executorType: string }) => profile.executorType === "JUDGE0")
        .isActive
    ).toBe(false);
  });

  it("lets MockExecutor run every active seeded language", async () => {
    const { app } = makeTestApp();
    const token = await loginDemo(app);
    const problem = (await request(app).get("/api/v1/problems?limit=1")).body.data[0] as { slug: string };
    const languages = (await request(app).get(`/api/v1/problems/${problem.slug}/languages`)).body.data as Array<{
      language: { id: string; key: string };
      version: { id: string };
    }>;

    for (const option of languages) {
      const response = await request(app).post("/api/v1/run").set("Authorization", `Bearer ${token}`).send({
        problemSlug: problem.slug,
        languageId: option.language.id,
        languageVersionId: option.version.id,
        code: "# MOCK_FIXTURE_OUTPUT"
      });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("ACCEPTED");
    }
  });

  it("keeps language snapshots visible after a language is disabled", async () => {
    const { app, queue } = makeTestApp();
    const adminToken = await loginAdmin(app);
    const token = await loginDemo(app);
    const languages = (await request(app).get("/api/v1/languages")).body.data as Array<{
      id: string;
      key: string;
      versions: Array<{ id: string }>;
    }>;
    const python = languages.find((language) => language.key === "python")!;
    const submit = await request(app).post("/api/v1/submit").set("Authorization", `Bearer ${token}`).send({
      problemSlug: "two-sum",
      languageId: python.id,
      languageVersionId: python.versions[0].id,
      code: "# MOCK_FIXTURE_OUTPUT"
    });
    expect(submit.status).toBe(201);
    await queue.processPending?.();

    await request(app)
      .patch(`/api/v1/admin/languages/${python.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    const detail = await request(app)
      .get(`/api/v1/submissions/${submit.body.data.submissionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.languageKeySnapshot).toBe("python");
    expect(detail.body.data.languageNameSnapshot).toBe("Python");
  });

  it("skips duplicate worker processing for terminal submissions", async () => {
    const { app, queue } = makeTestApp();
    const token = await loginDemo(app);
    const submit = await request(app)
      .post("/api/v1/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ problemSlug: "two-sum", language: "PYTHON", code: "# MOCK_FIXTURE_OUTPUT" });
    expect(submit.status).toBe(201);
    const submissionId = submit.body.data.submissionId as string;
    await queue.processPending?.();

    const before = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(before.body.data.status).toBe("ACCEPTED");
    const resultCount = before.body.data.results.length;

    await getAppContext(app).worker.processSubmission(submissionId);
    const after = await request(app).get(`/api/v1/submissions/${submissionId}`).set("Authorization", `Bearer ${token}`);
    expect(after.body.data.status).toBe("ACCEPTED");
    expect(after.body.data.results.length).toBe(resultCount);
  });

  it("Judge0Executor sends source code and stdin and maps stdout as actual output", async () => {
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.JUDGE0_BASE_URL = "https://judge0.test";
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockJudge0Response({ token: "token-1" }))
      .mockResolvedValueOnce(
        mockJudge0Response({
          stdout: "actual stdout\n",
          stderr: null,
          compile_output: null,
          time: "0.02",
          memory: 2048,
          status: { id: 3, description: "Accepted" }
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const result = await new Judge0Executor().execute({
        problemSlug: "two-sum",
        language: "C 11",
        profile: judge0CProfile(),
        sourceCode: cNoOutput,
        stdin: "4\n2 7 11 15\n9",
        timeLimitMs: 1000,
        memoryLimitMb: 128
      });

      expect(result.status).toBe("ACCEPTED");
      expect(result.stdout).toBe("actual stdout\n");
      const createCall = fetchMock.mock.calls[0];
      expect(createCall[0]).toBe("https://judge0.test/submissions?base64_encoded=false&wait=false");
      const body = JSON.parse((createCall[1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body).toEqual(
        expect.objectContaining({
          language_id: 50,
          source_code: cNoOutput,
          stdin: "4\n2 7 11 15\n9"
        })
      );
      expect(body).not.toHaveProperty("expectedOutput");
      expect(body).not.toHaveProperty("expected_output");
    } finally {
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }
  });

  it("uses Judge0Executor, not MockExecutor, when EXECUTOR_MODE is judge0", () => {
    const previousMode = env.EXECUTOR_MODE;
    env.EXECUTOR_MODE = "judge0";
    try {
      expect(createExecutor()).toBeInstanceOf(Judge0Executor);
    } finally {
      env.EXECUTOR_MODE = previousMode;
    }
  });

  it("judges wrong C code through Judge0 stdout without using expected output as actual output", async () => {
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = "https://judge0.test";
    global.fetch = mockJudge0Execution("");
    try {
      const { app } = makeJudge0TestApp();
      const token = await loginDemo(app);
      const response = await request(app)
        .post("/api/v1/run")
        .set("Authorization", `Bearer ${token}`)
        .send({ problemSlug: "two-sum", language: "c", code: cNoOutput });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("WRONG_ANSWER");
      expect(response.body.data.results[0].expectedOutput).toBe("0 1");
      expect(response.body.data.results[0].actualOutput).toBe("");
      expect(response.body.data.results[0].status).toBe("WRONG_ANSWER");
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }
  });

  it("accepts C sample runs through Judge0 only when actual stdout matches expected output", async () => {
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = "https://judge0.test";
    global.fetch = mockJudge0Execution("0 1\n");
    try {
      const { app } = makeJudge0TestApp();
      const token = await loginDemo(app);
      const response = await request(app)
        .post("/api/v1/run")
        .set("Authorization", `Bearer ${token}`)
        .send({ problemSlug: "two-sum", language: "c", code: cCorrectSampleOutput });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("ACCEPTED");
      expect(response.body.data.results[0].actualOutput).toBe("0 1\n");
      expect(response.body.data.results[0].status).toBe("ACCEPTED");
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }
  });

  it("propagates Judge0 internal errors to the sample run verdict", async () => {
    const previousMode = env.EXECUTOR_MODE;
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.EXECUTOR_MODE = "judge0";
    env.JUDGE0_BASE_URL = "https://judge0.test";
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockJudge0Response({ token: "token-1" }))
      .mockResolvedValueOnce(
        mockJudge0Response({
          stdout: null,
          stderr: null,
          compile_output: null,
          message: "No such file or directory @ rb_sysopen - /box/main.c",
          time: null,
          memory: null,
          status: { id: 13, description: "Internal Error" }
        })
      ) as unknown as typeof fetch;
    try {
      const { app } = makeJudge0TestApp();
      const token = await loginDemo(app);
      const response = await request(app)
        .post("/api/v1/run")
        .set("Authorization", `Bearer ${token}`)
        .send({ problemSlug: "two-sum", language: "c", code: cNoOutput });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("INTERNAL_ERROR");
      expect(response.body.data.results[0]).toEqual(
        expect.objectContaining({
          status: "INTERNAL_ERROR",
          stderr: "No such file or directory @ rb_sysopen - /box/main.c"
        })
      );
    } finally {
      env.EXECUTOR_MODE = previousMode;
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }
  });

  it("maps Judge0 terminal statuses without executing code locally", async () => {
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.JUDGE0_BASE_URL = "https://judge0.test";
    const cases = [
      [3, "Accepted", "ACCEPTED"],
      [4, "Wrong Answer", "WRONG_ANSWER"],
      [5, "Time Limit Exceeded", "TIME_LIMIT_EXCEEDED"],
      [6, "Compilation Error", "COMPILATION_ERROR"],
      [7, "Runtime Error", "RUNTIME_ERROR"],
      [11, "Memory Limit Exceeded", "MEMORY_LIMIT_EXCEEDED"],
      [13, "Internal Error", "INTERNAL_ERROR"]
    ] as const;
    try {
      for (const [statusId, description, expected] of cases) {
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce(mockJudge0Response({ token: "token-1" }))
          .mockResolvedValueOnce(
            mockJudge0Response({
              stdout: statusId === 3 ? "ok\n" : "",
              stderr: statusId === 7 ? "runtime failed" : null,
              compile_output: statusId === 6 ? "compile failed" : null,
              time: "0.01",
              memory: 1024,
              status: { id: statusId, description }
            })
          ) as unknown as typeof fetch;
        const result = await new Judge0Executor().execute({
          problemSlug: "two-sum",
          language: "Python 3",
          profile: {
            languageId: "python",
            languageVersionId: "python-3",
            languageKey: "python",
            displayName: "Python",
            monacoId: "python",
            fileExtension: "py",
            version: "Python 3",
            label: "Python 3",
            sourceFileName: "main.py",
            isCompiled: false,
            timeLimitMultiplier: 1,
            memoryLimitMultiplier: 1,
            executorType: "JUDGE0",
            judge0Id: 71
          },
          sourceCode: "print('ok')",
          stdin: "",
          timeLimitMs: 1000,
          memoryLimitMb: 128
        });
        expect(result.status).toBe(expected);
      }
    } finally {
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }
  });

  it("preserves Judge0 internal error messages as safe diagnostics", async () => {
    const previousBaseUrl = env.JUDGE0_BASE_URL;
    const previousFetch = global.fetch;
    env.JUDGE0_BASE_URL = "https://judge0.test";
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockJudge0Response({ token: "token-1" }))
      .mockResolvedValueOnce(
        mockJudge0Response({
          stdout: null,
          stderr: null,
          compile_output: null,
          message: "No such file or directory @ rb_sysopen - /box/main.c",
          time: null,
          memory: null,
          status: { id: 13, description: "Internal Error" }
        })
      ) as unknown as typeof fetch;
    try {
      const result = await new Judge0Executor().execute({
        problemSlug: "two-sum",
        language: "C 11",
        profile: judge0CProfile(),
        sourceCode: cNoOutput,
        stdin: "4\n2 7 11 15\n9",
        timeLimitMs: 1000,
        memoryLimitMb: 128
      });

      expect(result.status).toBe("INTERNAL_ERROR");
      expect(result.stderr).toBe("No such file or directory @ rb_sysopen - /box/main.c");
      expect(result.stdout).toBe("");
    } finally {
      env.JUDGE0_BASE_URL = previousBaseUrl;
      global.fetch = previousFetch;
    }
  });

  it("executor implementations reject unsupported dynamic profiles cleanly", async () => {
    const judge0 = await new Judge0Executor().execute({
      problemSlug: "two-sum",
      language: "Experimental",
      sourceCode: "",
      stdin: "",
      timeLimitMs: 1000,
      memoryLimitMb: 128
    });
    expect(judge0.status).toBe("INTERNAL_ERROR");
    expect(judge0.stderr).toContain("Judge0 language id");

    const docker = await new DockerExecutor().execute({
      problemSlug: "two-sum",
      language: "Experimental",
      sourceCode: "",
      stdin: "",
      timeLimitMs: 1000,
      memoryLimitMb: 128
    });
    expect(docker.status).toBe("INTERNAL_ERROR");
    expect(docker.stderr).toContain("Docker execution profile");
  });
});

function mockJudge0Response(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function mockJudge0Execution(stdout: string): typeof fetch {
  let tokenIndex = 0;
  return jest.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("/submissions?")) {
      tokenIndex += 1;
      return mockJudge0Response({ token: `token-${tokenIndex}` });
    }
    return mockJudge0Response({
      stdout,
      stderr: null,
      compile_output: null,
      time: "0.01",
      memory: 1024,
      status: { id: 3, description: "Accepted" }
    });
  }) as unknown as typeof fetch;
}

function judge0CProfile() {
  return {
    languageId: "c",
    languageVersionId: "c-11",
    languageKey: "c",
    displayName: "C",
    monacoId: "c",
    fileExtension: "c",
    version: "C11",
    label: "C 11",
    sourceFileName: "main.c",
    executableFileName: "main",
    isCompiled: true,
    timeLimitMultiplier: 1,
    memoryLimitMultiplier: 1,
    executorType: "JUDGE0" as const,
    judge0Id: 50
  };
}
