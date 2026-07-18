# High Level Design

This document explains the main design of CodeArena at a high level. I wrote it to keep track of how
the backend, frontend, queue, database, and judge system fit together.

## Project Goal

CodeArena is a small online judge platform. The main user flow is:

1. User logs in.
2. User opens a coding problem.
3. User writes code in the editor.
4. User runs sample tests or custom input.
5. User submits the solution.
6. Worker judges the code and stores the verdict.
7. Frontend shows live status and final result.

Apart from this, the app also has contests, leaderboards, discussions, notes, editorials, and admin
tools.

## Main Requirements

- User authentication and role-based access.
- Public problem list and problem detail pages.
- Admin problem creation and test-case management.
- Code run and submit flow.
- Queue-based judging instead of judging inside the API request.
- Hidden test cases should not leak to normal users.
- Multiple languages should come from database configuration.
- Support Judge0 and Docker-style executors.
- Store submission history and per-test results.
- Provide basic observability through health endpoints and logs.

## System Overview

```text
React frontend
    |
    v
Express API
    |
    +-- Controllers
    +-- Services
    +-- Repositories
    +-- Prisma / PostgreSQL
    +-- Redis / BullMQ queue
            |
            v
        Worker process
            |
            v
        Executor interface
            +-- Mock executor
            +-- Docker executor
            +-- Judge0 executor
```

The API handles HTTP requests and validation. The worker handles longer-running code execution jobs.

## Backend Layers

### Routes

Routes are split by domain, for example auth, users, problems, submissions, languages, contests,
leaderboard, social, executor, and test generation.

### Controllers

Controllers only handle HTTP input/output. They call services and send standard API responses.

### Services

Services contain most of the business logic:

- `AuthService`: register, login, refresh, logout.
- `ProblemService`: problem list, problem detail, admin CRUD, test cases.
- `SubmissionService`: sample run, custom run, submit, submission detail.
- `SubmissionWorker`: actual official judging workflow.
- `LanguageService`: language catalog and problem language settings.
- `LanguageResolver`: resolves selected language/version/executor profile.
- `ContestService`: contest management, registration, and standings.
- `LeaderboardService`: global and problem leaderboard.
- `SocialService`: discussions, comments, bookmarks, notes, editorials.
- `TestCaseGenerationService`: generator, reference solution, validator, and checker flow.

### Repositories

Services depend on repository interfaces. There are two main repository implementations:

- Prisma repository for real database usage.
- In-memory repository for tests.

This made testing easier because API tests can run without PostgreSQL.

## Database

PostgreSQL stores:

- Users and refresh tokens
- Problems, tags, and test cases
- Language catalog, versions, and execution profiles
- Problem starter code
- Submissions and per-test results
- Solved status and stats
- Contests and contest submissions
- Discussions, comments, votes
- Bookmarks, notes, editorials
- Leaderboard rank snapshots
- Test-case generation jobs and generated batches

More details are in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## Code Execution Design

The API does not execute user code directly. It only validates the request and creates/queues the
work.

For sample run and custom input, the API calls the executor through the service layer. For official
submissions, the API creates a submission and queues the submission id. The worker later loads the
submission and test cases, executes them, and saves the result.

The executor interface has three implementations:

- `MockExecutor`: deterministic test/demo executor.
- `DockerExecutor`: local container-based execution.
- `Judge0Executor`: real execution using Judge0-compatible API.

## Submission Flow

```text
User submits code
    -> API validates problem, user, language, executor support
    -> API creates PENDING submission
    -> API adds job to queue
    -> Worker marks RUNNING
    -> Worker runs judge cases
    -> Worker compares output or runs custom checker
    -> Worker stores per-case results
    -> Worker updates final verdict
    -> Frontend receives SSE/polling update
```

## Hidden Test Safety

Public problem APIs return only sample test cases. Hidden cases stay in the database and are used only
by the worker.

For normal users, submission detail redacts hidden input, expected output, actual output, and stderr.
Admins can inspect full results for debugging.

## Test-Case Generation

Admins can attach scripts to a problem:

- Generator: creates input from a seed.
- Reference solution: creates expected output.
- Validator: optional input validation.
- Checker: optional custom output checker.

Generation jobs run through the executor boundary, not inside the API process. Generated cases are
saved as normal sample or hidden test cases and reused for future submissions.

## Live Updates

The frontend uses Server-Sent Events for submission updates. The stream sends:

- Submission id
- Status
- Passed and total test count
- Runtime
- Memory
- Updated time

It does not send source code or hidden test data. Polling is used as a fallback.

## Security Points

- Passwords are bcrypt hashed.
- Refresh tokens are hashed in the database.
- Admin APIs are protected by backend RBAC.
- Helmet, CORS, and rate limits are enabled.
- User code is executed outside the API request process.
- Hidden test data is redacted for normal users.
- Logs should not contain source code or secrets.

## Scaling Notes

For a real deployment:

- API can run as one or more HTTP instances.
- Worker can scale separately based on queue size.
- Redis-backed BullMQ should be used instead of in-memory queue.
- PostgreSQL indexes support common lookups.
- Live event bus should move to Redis pub/sub if API and worker run on different instances.

## Current Limitations

- No plagiarism detection.
- No multi-file submissions.
- Docker compose does not auto-run migrations.
- Some frontend pages can still be split more.
- Live events currently use in-memory bus for local mode.

## Future Ideas

- Hosted demo.
- Better mobile solve workspace.
- Redis pub/sub event bus.
- More frontend tests.
- Plagiarism checker.
- Curated problem sheets.
