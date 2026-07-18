# CodeArena — code structure notes

Rough map of the API so I can find things faster.

## Folders

```text
apps/api/src/
  config/       env + logger
  constants/    defaults / fixtures
  controllers/  route handlers
  services/     actual logic
  repositories/ DB access
  events/       SSE status events for submissions
  routes/
  middlewares/  auth, rbac, zod validation, errors
  validators/
  workers/      judge + test generation
  executors/    mock / docker / judge0
  queue/
  utils/
  errors/
  types/
```

## Who does what

- **Auth** — passwords, JWT, refresh rotation
- **Problems** — list/filter/CRUD, test cases
- **Languages** — catalog, problem enablement, Judge0 sync
- **Submissions** — run samples, custom run, enqueue submit
- **Worker** — PENDING → RUNNING → verdict
- **Test gen** — generator / reference / checker assets + batch jobs
- **Contests** — register, standings, penalty
- **Social** — discussions, comments, bookmarks, notes, editorials

## Controllers

Controllers call Zod-validated services and return a standard response:

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": {}
}
```

## Services

Services enforce business rules such as:

- Duplicate email and username checks.
- Admin-only problem, test case, user, contest, editorial, leaderboard snapshot, and moderation operations.
- Sample-only code runs.
- Custom-input code runs that do not persist submissions.
- Test generation previews and jobs that require active generator and reference-solution assets, plus checker previews that require an active checker asset.
- Generated testcase safety limits, duplicate input detection, and hidden-test public visibility rules.
- Language/version resolution, disabled language rejection, and executor-profile compatibility checks.
- Executor-mode configuration checks such as rejecting Judge0 execution when `JUDGE0_BASE_URL` is missing.
- Public executor health checks that call `JUDGE0_BASE_URL/languages` in Judge0 mode and return safe setup errors without exposing API keys.
- Submission ownership rules.
- Contest registration and time-window validation.

## Repositories

Repository interfaces make persistence swappable:

- `MemoryRepository` and `MemoryLanguageRepository` support tests and fast demos.
- `PrismaRepository` and `PrismaLanguageRepository` support PostgreSQL in production.

## Middlewares

- `authenticate`: validates JWT access token and attaches `req.user`.
- `requireRole`: enforces RBAC.
- `validate`: applies Zod schema to body/query/params and returns field-level validation issue paths.
- Route-specific rate limiters protect auth, code execution, and test-generation endpoints in addition to the global limiter.
- `errorHandler`: maps domain errors to JSON.

## Validators and DTOs

Zod schemas live beside route handlers and define request DTOs for auth, users, problems, languages, test cases, generated testcase assets/jobs, sample runs, custom runs, submissions, contests, editorials, and social actions. Run and submit DTOs require a problem selector, code, and one language selector.

## Error Handling

Throw `ApiError` from services for expected failures. Unknown errors become `500 INTERNAL_ERROR` responses and are logged.

## Submission Queue Worker

`SubmissionWorker` receives a `submissionId`, loads the problem's persisted judge test cases, marks the submission `RUNNING`, executes those stored cases through the configured executor, records results, and writes the final status. Test cases are not generated per user, login, or submission; they are created by seed data, admin problem editing, manual upload, or explicit admin generation jobs.

For `STANDARD` problems, per-case success uses normalized expected-output comparison. For `CUSTOM_CHECKER` problems, user code must first return `ACCEPTED`; then the worker runs the active checker asset through `TestCaseGenerationService.runChecker`. Checker stdin is original input plus expected and actual output separated by `---EXPECTED---` and `---ACTUAL---`. Checker `ACCEPTED` accepts the case, checker `WRONG_ANSWER` rejects the case, and missing/crashing/timed-out/unavailable checkers become `INTERNAL_ERROR`.

If an executor or repository operation fails during judging, the worker catches the failure, logs the submission id, marks the submission `INTERNAL_ERROR`, stores the error message, and mirrors that status to any contest submission row.

The worker is idempotent for duplicate jobs: terminal submissions are skipped, and already-running submissions are not rejudged by a second worker attempt.

The worker publishes safe status events when a submission becomes `RUNNING` and when it reaches a terminal verdict. Events include only submission id, status, testcase counts, runtime, memory, and update time.

## Test-Case Generation Worker

`TestCaseGenerationWorker` receives a generation job id from `TestCaseGenerationQueue`. It skips terminal jobs, marks active work `RUNNING`, creates a `GeneratedTestCaseBatch`, and executes the problem's active generator, optional validator, and reference solution through the same executor abstraction used by submissions.

The same service stores checker assets and exposes admin-only checker preview. Enabling `CUSTOM_CHECKER` requires an active checker asset. Preview executes the checker without saving any test cases.

For each seed it stores a problem-scoped `TestCase` row with `isGenerated`, `generatedByJobId`, `batchId`, `generatorSeed`, `inputHash`, and `outputHash`. The worker can replace previously generated cases, skip duplicate generated input hashes, or fail the job when duplicates are not allowed. Saved rows become part of the reusable judge set for that problem. Preview runs use the same generation path without persisting rows. Worker failures and cancellations clean up the newly-created batch before becoming terminal jobs with truncated safe messages.

`InMemoryTestCaseGenerationQueue` supports tests and single-process demos. `BullMqTestCaseGenerationQueue` uses the `test-case-generation` queue for Redis-backed deployments, with a separate worker entrypoint available for production process separation.

## Submission Events

`SubmissionEventBus` has publisher and subscriber interfaces. `InMemorySubmissionEventBus` is used for local tests and single-process demos. `RedisSubmissionEventBus` documents the production adapter shape for multi-instance deployments.

`GET /api/v1/submissions/:id/events` opens an authenticated SSE stream. The controller first authorizes access through the submission service, sends the current status immediately, subscribes to future events, emits heartbeat frames every 20 seconds, and cleans up listeners on disconnect or terminal status.

## Executor Interface

```ts
execute(request): Promise<ExecutionResult>
```

All executors receive source code, stdin, limits, problem metadata, and an optional execution profile. They return status, stdout, stderr, compile output, runtime, and memory usage.

## Docker Executor

Runs code in a short-lived Docker container with memory, CPU, PID, network, read-only filesystem, dropped capabilities, no-new-privileges, and timeout limits. It is suitable for local demos but still requires host hardening.

## Judge0 Executor

Calls a Judge0-compatible API using the selected version's `ExecutionProfile.judge0Id`, creates a remote submission, polls with timeouts, and returns normalized execution results. Judge0 accepted, wrong answer, compilation error, runtime error, time limit, memory limit, and internal statuses map to CodeArena verdicts.

Local Judge0 health uses the same base URL configuration and verifies `/languages` through `GET /api/v1/executor/health` and `npm run judge0:health`.

## Mock Executor

Deterministic non-executing executor used by tests and local demos. Every active seeded language version gets a `MOCK` execution profile, which allows end-to-end judge flow testing without executing arbitrary code.

## Dynamic Language Resolution

`LanguageResolver` accepts legacy `language`, `languageId`, `languageVersionId`, dynamic language keys, or `languageKey` plus `version`. It loads problem language options, rejects disabled language/version rows, checks whether the configured executor mode is configured and has an active profile, calculates effective limits with version multipliers, and returns immutable language snapshots for the submission row.

`ExecutorCapabilityService` shares those compatibility rules through `/executor/capabilities` and admin diagnostics. Public responses include safe `canRun`/`canSubmit` flags; admin responses add missing profile/config details for operations.

## Test-Case Comparison Logic

- Normalize CRLF to LF.
- Trim trailing whitespace on every line.
- Trim trailing blank lines.
- Strict mode can compare normalized output exactly.
- Custom checker support extends `compareOutput` only for problems explicitly configured as `CUSTOM_CHECKER`; standard problems keep normalized output comparison.

## Leaderboard Calculation Logic

- Global leaderboard ranks users by distinct solved problems, then accepted submission count.
- Daily rank snapshots store previous global ranks so the frontend can show movement without recalculating historical standings at request time.
- Problem leaderboard ranks fastest accepted submissions per user.
- Contest leaderboard ranks by solved count, then stored penalty minutes. Worker-created contest accepted rows carry the calculated penalty value.

## Frontend State Design

- Query pages render loading, error, empty, and data states.
- The admin builder creates the problem first, then attaches sample and hidden tests using admin-only APIs.
- The admin dashboard manages generation assets, checker mode, checker previews, deterministic seed previews, queued generated testcase batches, job status, and generated batch deletion without exposing this workflow to normal users.
- Admin user management calls role/status APIs and protects the current admin from self-demotion/deletion server-side.
- Admin contest management creates contests and can assign/remove problems through dedicated contest endpoints.
- Admin editorial publishing creates drafts with problems and toggles public visibility through editorial endpoints.
- Admin language management lists languages, toggles availability, creates versions, edits executor profile metadata, syncs Judge0, manages problem language availability, shows executor capability badges, and saves starter code per language/version.
- The workspace uses authenticated SSE for queued submission updates, then falls back to polling if streaming is unavailable.
- API error messages preserve backend validation details so forms show actionable failures.
- Problem editor drafts are keyed by problem slug, language id, and version id in `localStorage`.
- The solve page separates statement tabs, editor controls, result polling, sample cases, custom-input execution, and notes persistence.
- Problemset filters are kept in URL query parameters for shareable search state.
- General discussions, admin user management, contest creation/editing, editorial publishing, streak/country stats, and rank movement call real backend endpoints.

## Frontend Component Boundaries

- `AppShell` owns global navigation, theme toggle, auth menu, search routing, admin link visibility, sidebar, and mobile nav.
- `ProblemTable`, `LeaderboardTable`, and `SubmissionTable` keep dense CP table rendering out of page containers.
- `ProblemStatement`, `CodeEditor`, `TestCasePanel`, and `ResultPanel` isolate the solve workspace into reviewable units.
- Badge components normalize difficulty, problem status, and verdict styling.
- `StatsCard`, `HeatmapCalendar`, and `ProgressRing` provide reusable profile/admin/practice dashboard primitives.
