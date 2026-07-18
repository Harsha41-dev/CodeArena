# Judge — how submissions get graded

This was the hardest part of the project for me.

## Goals

- Never run user code inside the API request handler
- Support mock (tests), docker (local), and Judge0 (real runs)
- Languages come from DB so I'm not hardcoding forever
- Save per-test results so WA/TLE/etc. are visible

## Executor Contract

Executors receive language snapshots, source code, stdin, limits, problem metadata, and the selected version's execution profile. They return stdout, stderr, compile output, status, runtime, and memory usage.

## Language Resolution

Languages are not hardcoded in the judge path. The API resolves `languageVersionId`, `languageId`, `languageKey`/`version`, dynamic `language` keys, or legacy aliases against database rows:

1. `Language` must be active.
2. `LanguageVersion` must be active.
3. The problem must allow the language.
4. The configured executor mode must have an active `ExecutionProfile`.
5. Judge0 mode requires a Judge0 language id; Docker mode requires image and command metadata.
6. Judge0 mode also requires `JUDGE0_BASE_URL`; otherwise every run/submit request fails with `LANGUAGE_EXECUTOR_UNAVAILABLE` before execution or queueing.

The resolved language name/version is copied into each submission so historical submissions still display correctly after an admin renames or disables a language.

The frontend and admin UI read `GET /api/v1/executor/capabilities` instead of embedding a fixed language list. Capability responses include `canRun`, `canSubmit`, and admin-only diagnostics, so the solve page can default to the first executable version and disable versions unsupported by the current judge mode.

## Mock Mode

`EXECUTOR_MODE=mock` never executes user code. It is used for deterministic automated tests. It simulates stdout only from explicit deterministic markers or simple literal print statements, which keeps API and worker tests repeatable without Docker, Redis, or a hosted judge. It must not be treated as real judging.

Mock mode does not copy expected output into actual output. Empty starter code produces empty stdout and is judged `WRONG_ANSWER` when expected output is non-empty. Outside `NODE_ENV=test`, `EXECUTOR_MODE=mock` is rejected unless `ALLOW_MOCK_EXECUTOR=true`; in production it is also rejected unless `ALLOW_MOCK_EXECUTOR_IN_PRODUCTION=true`.

All seeded active language versions receive a mock profile, so tests can verify language-selection behavior across the full catalog without requiring compilers.

## Docker Mode

`EXECUTOR_MODE=docker` runs short-lived containers with memory, CPU, PID, disabled network, dropped capabilities, no-new-privileges, read-only root filesystem, writable `/tmp`, and command timeouts. Docker image and compile/run commands come from the selected version's execution profile. The API host must still be hardened because Docker alone is not a complete sandbox for hostile code.

Docker mode is documented as a local or controlled-environment option. A production sandbox fleet should also enforce host isolation, image allowlists, container runtime patching, seccomp/AppArmor profiles, log limits, and per-tenant quotas.

## Judge0 Mode

`EXECUTOR_MODE=judge0` delegates execution to a Judge0-compatible service using the selected version's Judge0 id. This is the recommended low-cost deployment option when running untrusted code. `npm run languages:sync:judge0` or `POST /api/v1/admin/languages/sync/judge0` can import supported Judge0 ids.

Judge0 submission creation and polling use timeouts. Compilation errors, runtime errors, time limit, memory limit, wrong answer, accepted, and internal Judge0 statuses are mapped into CodeArena verdicts without exposing raw infrastructure details to normal users.

For local self-hosted Judge0, run Judge0 outside the CodeArena API process and set `EXECUTOR_MODE=judge0` plus `JUDGE0_BASE_URL`. On Windows, use a separate Linux VM with native Docker Engine, for example `JUDGE0_BASE_URL=http://<VM_IP>:2358`; Windows Docker Desktop/WSL can list languages while failing real submissions because Judge0 `v1.13.1` depends on cgroup behavior that is not available there. Verify with `GET /api/v1/executor/health` or `npm run judge0:health`.

## Verdict Calculation

Official submissions move through `PENDING -> RUNNING -> terminal status`. The worker loads the problem's persisted `TestCase` rows and reuses that same stored judge set for every user. It stops on compile error, runtime error, time limit, memory limit, or internal error. For `STANDARD` problems it compares normalized actual executor stdout against expected output and returns `ACCEPTED` only when every stored judge case passes. Expected output is never used as actual output.

For `CUSTOM_CHECKER` problems, the worker first executes the user's code. If user execution succeeds, it runs the problem's active `CHECKER` asset through the executor abstraction with stdin containing original input, expected output, and actual output separated by `---EXPECTED---` and `---ACTUAL---`. Accepted checker results accept the testcase; rejected checker results become `WRONG_ANSWER`; missing checkers, checker crashes, compile errors, timeouts, memory-limit failures, unavailable execution profiles, or executor failures become `INTERNAL_ERROR` and never accept a submission.

If the executor throws or the problem has no configured judge cases, the worker records `INTERNAL_ERROR` so operators can see that the platform failed rather than the user's code.

Output comparison normalizes CRLF/LF differences and trailing whitespace before checking expected output.

Duplicate worker jobs are idempotent: terminal submissions are skipped, and already-running submissions are not rejudged by a second worker attempt.

## Test-Case Generation

Admins can attach problem assets for generated tests:

- `GENERATOR`: receives a seed and emits deterministic stdin for one testcase.
- `REFERENCE_SOLUTION`: receives generated stdin and emits the expected output.
- `VALIDATOR`: optionally rejects malformed generated stdin.
- `CHECKER`: optional custom checker used by official judging when the problem is set to `CUSTOM_CHECKER`.

Generation previews and jobs execute these assets through the configured executor profile. This keeps generation consistent with the judge boundary: even trusted admin assets are not executed inside the HTTP request process. A generation job creates a batch, iterates a seed range, runs generator, validator, and reference solution, enforces input/output byte limits, normalizes expected output, detects duplicate generated input hashes, and saves sample or hidden `TestCase` rows with seed/hash/job/batch metadata. Once saved, generated cases are ordinary problem-scoped judge cases reused by every future submission. Preview runs do not persist test cases. Checker preview runs execute only the checker against admin-provided input/expected/actual text and do not save test cases.

Generation jobs use `PENDING -> RUNNING -> COMPLETED/FAILED/CANCELLED`. Failed and cancelled jobs clean up the batch they created before becoming terminal, so partial generated cases do not affect official judging. Failed jobs store a short safe message and do not expose asset source, generated hidden input, expected output, executor secrets, or stack traces. Public problem APIs still return only sample cases, and normal submission detail responses redact non-sample judge result bodies.

Local/test mode uses an in-memory generation queue. Redis-backed deployments use BullMQ queue name `test-case-generation`; production should run generation workers as a separate process and apply the same sandbox, timeout, and resource-limit policy used for submissions.

## Live Status Updates

Submission status updates are delivered over Server-Sent Events at `GET /api/v1/submissions/:id/events`. SSE is used instead of WebSockets because the flow is mostly server-to-client: after a submit, the browser needs to observe `PENDING -> RUNNING -> terminal verdict`.

The SSE controller enforces the same auth and ownership policy as submission detail reads. Users can subscribe only to their own submissions; admins can subscribe to any submission. The event payload contains only safe verdict metadata: submission id, status, passed and total testcase counts, runtime, memory, and update time. It never includes source code, hidden testcase input, expected output, executor secrets, or stack traces.

The API sends the current status immediately, sends heartbeat events every 20 seconds, and closes the stream after a terminal verdict. The frontend reconnects on page refresh and falls back to `GET /api/v1/submissions/:id` polling if streaming fails.

`InMemorySubmissionEventBus` is used for local single-process demos and tests. Production deployments with separate API and worker instances should use Redis pub/sub or another shared event backend so worker-published events are visible to every API instance.

## API Flows

- `POST /api/v1/run` executes the submitted code against saved sample cases and returns per-case output without creating a submission.
- `POST /api/v1/run/custom` executes a single user-provided stdin value with the selected problem limits and returns stdout, stderr, compile output, runtime, memory, and executor status without creating a submission.
- `POST /api/v1/submit` creates a `PENDING` submission, enqueues the id, and lets the worker run the problem's stored judge cases asynchronously.
- `GET /api/v1/submissions/:id/events` streams safe submission status changes to the submitting user or an admin.
- `PATCH /api/v1/admin/problems/:problemId/checker-mode` changes a problem between standard comparison and custom-checker judging.
- `POST /api/v1/admin/problems/:problemId/checker/preview` executes the active checker against supplied input/expected/actual text for admin validation.
- `POST /api/v1/admin/problems/:problemId/test-generation/preview` runs one seed through the generation asset chain and returns safe preview output to an admin.
- `POST /api/v1/admin/problems/:problemId/test-generation-jobs` queues deterministic generated sample or hidden testcase batches.

Custom-input execution is useful for local debugging, but it is still routed through the executor abstraction and the code-execution rate limiter. It must not bypass sandboxing in Docker or Judge0 modes.

## Observability

- `/health` exposes database, queue, executor, and uptime status for lightweight checks.
- Admin `/api/v1/admin/judge/queue` exposes queue depth and worker status.
- Admin `/api/v1/admin/health/deep` combines database, Redis/queue, submission queue, test-generation queue, and executor health.
- The API logs run, custom run, submit enqueue, worker pickup, per-test execution start/finish, verdict calculation, and executor failures without logging user source code.
- Submission status event publishing logs only submission ids and verdict metadata.
