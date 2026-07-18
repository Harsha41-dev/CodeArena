# Testing

## What Is Covered

- Auth register and login.
- Problem listing and pagination/filtering.
- Admin-only problem creation.
- Sample code run through `MockExecutor`.
- Custom-input execution through `MockExecutor`.
- Submission creation and worker processing.
- RBAC denial cases.
- Contest registration.
- Admin contest creation and mutation flow.
- Admin user role/status management and self-protection.
- Persisted general discussions, comments, and voting.
- Editorial draft/publish visibility.
- Private problem and private contest visibility boundaries.
- Real user streak and acceptance stats.
- Leaderboard calculation.
- Leaderboard snapshot movement.
- Public language catalog and problem language options.
- Admin language/version mutations, disabled language rejection, and starter-code persistence.
- Mock executor support across every active seeded language version.
- Executor compatibility failures for missing Docker/Judge0 profile metadata.
- Executor capability endpoint behavior and admin-only capability/health routes.
- Clean `LANGUAGE_EXECUTOR_UNAVAILABLE` failures when Judge0 mode is selected but not configured.
- Queue metrics RBAC and deep health response shape.
- Admin test-generation asset RBAC.
- Generated testcase preview with deterministic mock generator/reference assets.
- Queued generation job processing, hidden generated-case persistence, hash metadata, and public visibility boundaries.
- Judge correctness regressions where empty C starter code and wrong stdout must be `WRONG_ANSWER`.
- Custom-checker regressions where empty actual output is rejected unless the checker explicitly accepts it.
- Failed generation jobs when required assets are missing.
- Duplicate generated input handling.
- Worker idempotency for duplicate terminal jobs.
- Judge0 terminal verdict mapping through mocked HTTP calls.
- Local Judge0 health success/failure through mocked `/languages` calls.
- Judge0 executor request-shape tests that verify source code and stdin are sent and expected output is never sent as actual output.
- Judge0-mode C sample regressions for empty stdout `WRONG_ANSWER` and matching stdout `ACCEPTED`.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Test Strategy

Tests use in-memory repositories, the in-memory language catalog, and the mock executor for most route coverage, so they do not require PostgreSQL, Redis, Docker, or external judge APIs. Judge0 behavior is tested with mocked `fetch` responses, including health checks and run verdicts. This keeps the suite deterministic while still exercising controller, service, repository, language resolver, queue, worker, executor, RBAC, and visibility boundaries.

`MockExecutor` is deterministic test/demo infrastructure, not real judging. It must not copy expected output into actual output. Accepted verdicts require actual stdout from the executor path or explicit checker acceptance. Empty starter code produces empty stdout and must fail when expected output is non-empty.

The API suite currently covers the main route/service flows with Supertest and mocked executor integrations.

Prisma seed data is intended for local/demo databases and includes demo credentials, sample submissions, contest standings, discussions, editorials, bookmarks, notes, and rank snapshots.
