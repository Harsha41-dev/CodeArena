# API Spec

Base URL: `/api/v1`

Swagger UI is served at `/api-docs`.

Protected endpoints require `Authorization: Bearer <accessToken>`. Admin endpoints also require the backend `ADMIN` role.

All success responses follow:

```json
{
  "success": true,
  "message": "ok",
  "data": {},
  "meta": {}
}
```

All errors follow:

```json
{
  "success": false,
  "message": "Human-readable message",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Validation errors include field-level issues:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "BAD_REQUEST",
    "details": {
      "issues": [{ "path": "body.slug", "message": "Use a kebab-case slug" }]
    }
  }
}
```

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Users

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/:username`
- `GET /users/:username/stats`
- `GET /admin/users` - admin list with search, role, and status filters.
- `GET /admin/users/:id` - admin user detail.
- `PATCH /admin/users/:id` - admin profile/status update.
- `DELETE /admin/users/:id` - soft-delete user.
- `PATCH /admin/users/:id/role` - promote/demote user.
- `PATCH /admin/users/:id/status` - activate, deactivate, or delete user.

User stats include solved counts, attempts, acceptance rate, easy/medium/hard solved counts, real current and longest streaks, language stats, and submission calendar data.

## Problems

- `GET /problems`
- `GET /problems/:slug`
- `GET /problems/:slug/languages`
- `POST /problems`
- `PATCH /problems/:id`
- `DELETE /problems/:id`
- `GET /problems/:slug/submissions`
- `GET /problems/:slug/editorial`
- `GET /problems/:slug/discussions`

Public problem endpoints return only public problems. Admin problem routes can create private drafts and archive existing problems.

## Languages

- `GET /languages`
- `GET /languages/:key`
- `GET /problems/:slug/languages`
- `GET /admin/languages`
- `POST /admin/languages`
- `PATCH /admin/languages/:id`
- `DELETE /admin/languages/:id`
- `GET /admin/languages/:id/versions`
- `POST /admin/languages/:id/versions`
- `PATCH /admin/language-versions/:id`
- `DELETE /admin/language-versions/:id`
- `POST /admin/languages/sync/judge0`
- `GET /admin/problems/:problemId/languages`
- `PATCH /admin/problems/:problemId/languages`
- `POST /admin/problems/:problemId/starter-code`
- `PATCH /admin/problems/:problemId/starter-code/:starterCodeId`

Languages are stored in the database as `Language`, `LanguageVersion`, and `ExecutionProfile` rows. Public problem language options return active language/version combinations plus starter code fallback. Admins can enable or disable languages, create versions, choose which languages are allowed for each problem, pin a problem to one version, and sync Judge0 IDs from `JUDGE0_BASE_URL`. Judge0 sync is additive for existing rows and preserves admin labels, disabled states, and disabled profiles.

## Test Cases

- `POST /problems/:id/testcases`
- `PATCH /testcases/:id`
- `DELETE /testcases/:id`

## Test-Case Generation

All generation endpoints are admin-only and require backend `ADMIN` RBAC. Generation assets are problem-scoped and are executed by the configured executor; the API process does not run generator or reference code directly.

- `GET /admin/problems/:problemId/assets`
- `POST /admin/problems/:problemId/assets`
- `PATCH /admin/problem-assets/:assetId`
- `DELETE /admin/problem-assets/:assetId`
- `PATCH /admin/problems/:problemId/checker-mode`
- `POST /admin/problems/:problemId/checker/preview`
- `POST /admin/problems/:problemId/test-generation/preview`
- `POST /admin/problems/:problemId/test-generation-jobs`
- `GET /admin/problems/:problemId/test-generation-jobs`
- `GET /admin/test-generation-jobs/:jobId`
- `POST /admin/test-generation-jobs/:jobId/cancel`
- `GET /admin/problems/:problemId/testcase-batches`
- `DELETE /admin/testcase-batches/:batchId`

Asset types are `GENERATOR`, `REFERENCE_SOLUTION`, `VALIDATOR`, and `CHECKER`. A generation job requires an active generator and active reference solution. The validator is optional; when enabled, generated input is executed against it before the test case is saved. Problems default to `STANDARD` checker mode. Admins can switch to `CUSTOM_CHECKER` only when an active checker asset exists.

Create a generator asset:

```json
{
  "type": "GENERATOR",
  "languageKey": "python",
  "filename": "generator.py",
  "sourceCode": "..."
}
```

Create a job:

```json
{
  "batchName": "Generated hidden tests",
  "visibility": "HIDDEN",
  "seedStart": 1,
  "count": 50,
  "runValidator": true,
  "replaceExistingGenerated": false,
  "skipDuplicates": true
}
```

Set checker mode:

```json
{
  "checkerMode": "CUSTOM_CHECKER"
}
```

Preview a checker:

```json
{
  "input": "1 2 3\n",
  "expectedOutput": "1 2 3\n",
  "actualOutput": "3 2 1\n"
}
```

Checker preview returns a safe verdict object:

```json
{
  "verdict": "ACCEPTED",
  "message": "Checker accepted output",
  "runtimeMs": 3,
  "memoryKb": 512
}
```

Generated cases store seed, input hash, output hash, batch id, and generator job id. Preview responses are computed through the generator/reference path but are not persisted. Completed generation jobs save ordinary problem-scoped `TestCase` rows; those rows are reused by every user's future submissions until an admin changes or regenerates them. Public problem detail endpoints still expose only sample cases, so hidden generated inputs and expected outputs are not leaked. Batch list responses return counts and metadata, not full hidden testcase bodies. If a generation job fails or is cancelled after creating a batch, the worker removes that batch before marking the job terminal.

Official custom-checker judging executes user code first. If user execution succeeds, the worker runs the active checker through the safe executor with input, expected output, and actual output separated by `---EXPECTED---` and `---ACTUAL---`. Missing, crashing, timed-out, or unavailable checkers never accept submissions.

## Code Execution

- `GET /executor/capabilities`
- `GET /executor/health`
- `POST /run`
- `POST /run/custom`
- `POST /submit`
- `GET /submissions/:id`
- `GET /submissions/:id/events`
- `GET /submissions`

`/run` executes only saved sample cases. `/run/custom` executes a single custom input against the selected problem limits without creating a stored submission. `/submit` queues official judging against the problem's persisted sample, hidden, and generated judge cases; it never generates cases per user, login, or submission. `GET /submissions/:id` returns full sample result bodies, but normal users receive redacted bodies for non-sample judge cases; admins can inspect full hidden case result data.

Auth and code-execution routes have dedicated rate limits. Official submits create queued submission history; sample and custom runs do not create accepted submissions.

Code execution payloads must include `problemSlug` or `problemId`, `code`, and one language selector. Prefer `languageVersionId` when using frontend-provided options; `languageKey` plus `version` is useful for scripts. The `language` field accepts a dynamic language key such as `rust`; legacy values such as `PYTHON` are still accepted as aliases.

```json
{
  "problemSlug": "two-sum",
  "languageKey": "python",
  "version": "3.11",
  "code": "print('0 1')"
}
```

`GET /executor/capabilities` accepts optional `problemSlug` or `problemId` query params and returns the active language/version options with `canRun`, `canSubmit`, and a safe reason when unavailable. The frontend uses this endpoint so it does not need a hardcoded build-time language list. `GET /executor/health` reports the configured executor mode and, in Judge0 mode, verifies `JUDGE0_BASE_URL/languages` without exposing API keys. If local Judge0 is down, it returns `Judge0 is not reachable at http://localhost:2358. Start local Judge0 Docker services first.` If the current executor is not configured or a selected version has no compatible active profile, `/run` and `/submit` return `400` with `LANGUAGE_EXECUTOR_UNAVAILABLE` before execution or queueing.

### Submission Events

`GET /submissions/:id/events` opens an authenticated `text/event-stream` for live verdict updates. The same ownership policy as `GET /submissions/:id` applies: a user can subscribe only to their own submission; admins can subscribe to any submission.

The stream sends the current status immediately, sends heartbeat events every 20 seconds, and closes after a terminal verdict. Events intentionally omit source code, hidden inputs, expected outputs, executor secrets, and internal stack traces.

```json
{
  "submissionId": "sub_123",
  "status": "RUNNING",
  "passedTestCases": 1,
  "totalTestCases": 12,
  "runtime": null,
  "memory": null,
  "updatedAt": "2026-07-03T07:50:00.000Z"
}
```

Clients should use SSE for live updates and keep `GET /submissions/:id` polling as a fallback. Native browser `EventSource` cannot attach bearer headers, so the frontend uses `fetch` streaming against this SSE endpoint.

## Leaderboard

- `GET /leaderboard`
- `POST /leaderboard/snapshot` - admin endpoint to persist daily ranks for movement indicators.
- `GET /problems/:slug/leaderboard`

Global leaderboard rows include solved count, accepted submissions, acceptance rate, country metadata, current rank, previous rank, movement amount, and movement direction.

## Contests

- `GET /contests`
- `GET /contests/:id`
- `POST /contests`
- `GET /admin/contests`
- `GET /admin/contests/:id`
- `POST /admin/contests`
- `PATCH /admin/contests/:id`
- `DELETE /admin/contests/:id`
- `POST /admin/contests/:id/problems`
- `DELETE /admin/contests/:id/problems/:problemId`
- `POST /contests/:id/register`
- `GET /contests/:id/leaderboard`
- `POST /contests/:id/submit`

Public contest endpoints return public contests only. Admin contest endpoints can access draft/private contests and all contest mutations require the `ADMIN` role.

## Discussions

- `GET /discussions`
- `POST /discussions`
- `GET /discussions/:id`
- `POST /problems/:slug/discussions`
- `POST /discussions/:id/comments`
- `PATCH /discussions/:id`
- `DELETE /discussions/:id`
- `PATCH /discussion-comments/:id`
- `DELETE /discussion-comments/:id`
- `POST /discussions/:id/vote`

General discussions persist with title, content, tags, author, vote counts, and comments. Problem discussions use the same model scoped by `problemId`.

## Editorials

- `GET /problems/:slug/editorial`
- `POST /admin/problems/:problemId/editorial`
- `PATCH /admin/editorials/:id`
- `DELETE /admin/editorials/:id`
- `PATCH /admin/editorials/:id/publish`
- `PATCH /admin/editorials/:id/unpublish`

Public users only receive published editorials. Admins can request drafts with `includeDraft=true`.

## Bookmarks

- `POST /problems/:slug/bookmark`
- `DELETE /problems/:slug/bookmark`
- `GET /bookmarks`

## Notes

- `GET /problems/:slug/notes`
- `POST /problems/:slug/notes`
- `PATCH /notes/:id`
- `DELETE /notes/:id`

## Health

- `GET /ping`
- `GET /health` returns uptime, executor mode, repository driver, queue driver, pending jobs, active jobs, failed jobs, and timestamp.
- `GET /admin/executor/capabilities` returns admin diagnostics for language/version executor support.
- `GET /admin/executor/health` returns configured executor mode, Judge0 reachability metadata, and support counts.
- `GET /admin/judge/queue` returns queue driver, waiting, active, delayed, failed, completed, and worker status.
- `GET /admin/health/deep` returns API, database, submission queue, test-generation queue, Redis, and executor health in one admin-only response.
- `GET /api-docs`
