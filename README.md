# CodeArena

CodeArena is a full-stack online judge project I built as a learning project during B.Tech.
It is inspired by platforms like LeetCode and Codeforces, but the goal was not to clone them.
I wanted to understand how the main pieces of an online judge work together: problem statements,
code editor, submissions, queues, workers, test cases, contests, and verdicts.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, Monaco Editor
- Backend: Node.js, Express, TypeScript, Prisma
- Database: PostgreSQL
- Queue: Redis with BullMQ
- Code execution: Judge0, Docker executor, and mock executor for tests
- Other: JWT auth, Zod validation, Swagger docs, Pino logs

## Features Implemented

- User register, login, refresh token, and logout
- Problem list with filters, tags, difficulty, and status
- Problem stats with acceptance rate, solved count, submission count, and richer sorting
- Daily challenge, curated practice sets, and next-problem recommendation
- Study plans with ordered problems, daily unlock metadata, badges, and revision queue
- Problem workspace with statement, resizable panels, Monaco editor, sample run, custom input, and submit
- Editor settings for theme, font size, tab size, word wrap, minimap, reset code, and visible autosave
- Workspace tabs for description, editorial, submissions, solutions, discussions, and notes
- Editorials unlock after a logged-in user attempts the problem, while admins can still preview drafts
- Active sample test-case runs from the workspace
- Queued submissions with `PENDING`, `RUNNING`, and final verdict states
- Live submission status using Server-Sent Events, with polling fallback
- Redis pub/sub-backed live submission events when `REDIS_URL` is configured
- Submission history filters for problem, verdict, language, and date range
- Submission detail comparison with a previous attempt and approximate runtime/memory percentile
- Accepted submission sharing into persisted problem solution posts with visibility controls and voting
- Multiple language support from database catalog
- Judge0 language sync support
- Admin problem creation with sample and hidden test cases
- Admin problem catalog includes public, private draft, and archived states
- Custom checkers for problems where exact output matching is not enough
- Test-case generation using generator and reference solution scripts
- Contests, contest registration, upsolve behavior, leaderboard, and clarification threads
- Contest submissions are accepted only during the live contest window
- Virtual contest and mock interview practice pages with topic/company filters and local reports
- Global leaderboard and problem leaderboard
- Public/profile pages, badges, country/global rank signals, rating history, topic strength views, linked submission calendar, activity feed, and persistent follow state
- Persistent notifications for follows, solution votes, and report updates
- Discussions, comments, votes, markdown rendering, sorting, report flow, bookmarks, notes, and editorials
- Admin user, language, contest, problem preview, testcase validation, and monitoring pages
- Admin launch analytics for sampled submissions, accepted rate, judge errors, API abuse/rate patterns, and suspicious actors
- Admin moderation/report queues, audit logs, backup runs, production health snapshots, and contest rating publishing
- Configurable API telemetry retention for abuse analytics
- Admin rejudge controls for one submission or filtered error batches
- Swagger API docs at `/api-docs`
- Docker compose setup for local services

## Judge Modes

| Mode     | Use case                                                            |
| -------- | ------------------------------------------------------------------- |
| `mock`   | Used in tests and demo paths. It does not really execute user code. |
| `docker` | Runs code locally inside Docker containers.                         |
| `judge0` | Runs code through Judge0. This is the main real-execution mode.     |

## Project Structure

```text
apps/api      Express API, Prisma, queues, workers, executors
apps/web      React frontend
docs/         Notes about architecture, setup, testing, and API behavior
docker/       API and web Dockerfiles
examples/     Example generator, checker, and reference scripts
scripts/      Local Judge0 helper scripts
```

Backend flow:

```text
routes -> controllers -> services -> repositories
```

Frontend flow:

```text
pages/features -> components -> API services -> backend
```

## Running Locally

Requirements:

- Node.js 20+
- PostgreSQL
- Redis
- Judge0 only if you want real code execution

Setup:

```bash
npm install
cp .env.example .env
```

Update `.env` with at least:

```text
DATABASE_URL=...
REDIS_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```

Then run:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Local URLs:

- Web: http://localhost:5173
- API: http://localhost:4000
- Swagger: http://localhost:4000/api-docs

## Demo Accounts

Seed data includes demo accounts.

| Role  | Email             | Password |
| ----- | ----------------- | -------- |
| Admin | admin@example.com | password |
| User  | user@example.com  | password |

Some older seed data also uses:

- `admin@codearena.dev` / `Password123!`
- `demo@codearena.dev` / `Password123!`

## Docker Compose

For local container setup:

```bash
docker compose up --build
```

Migrations and seed are still manual:

```bash
npm run db:migrate
npm run db:seed
```

## Judge0 Setup

For real submissions, I use Judge0. Mock mode is only for tests and controlled demos.

On my Windows machine, running Judge0 through Docker Desktop/WSL caused issues, so I used a Linux VM
and pointed the app to that VM.

Inside the Linux VM:

```bash
chmod +x scripts/bootstrap-judge0-linux-vm.sh
./scripts/bootstrap-judge0-linux-vm.sh
```

From Windows:

```powershell
npm run judge0:local:connect -- -Judge0BaseUrl http://<VM_IP>:2358
npm run dev
```

More notes are in [docs/LOCAL_JUDGE0_SETUP.md](docs/LOCAL_JUDGE0_SETUP.md).

## Useful Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run db:migrate:deploy
npm run db:seed
npm run judge0:health
npm run languages:sync:judge0
npm run leaderboard:snapshot
```

## How Submission Works

1. User submits code from the problem workspace.
2. API validates auth, problem, language, and executor support.
3. API creates a submission with `PENDING` status.
4. Submission id is added to the queue.
5. Worker picks the job and marks it `RUNNING`.
6. Worker runs the saved judge test cases using Judge0 or Docker.
7. Output is compared with expected output, or a custom checker is used.
8. Final verdict is saved.
9. Frontend receives updates through SSE or polling.

User code is never executed inside the Express request handler.

## Testing

The API tests use in-memory repositories and a mock executor, so tests do not need PostgreSQL,
Redis, Docker, or Judge0.

```bash
npm run lint
npm run typecheck
npm test
```

Current test coverage includes auth, problem APIs, submissions, queue/worker flow, contests,
leaderboards, discussions, language selection, Judge0 mapping, custom checkers, test-case generation,
solution sharing, follows, notifications, reports, audit logs, monitoring, backups, and ratings.

## Docs

| File                                                           | Content                                           |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [docs/API_SPEC.md](docs/API_SPEC.md)                           | API routes and response shape                     |
| [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md)                         | JWT and refresh-token flow                        |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)             | Prisma models and indexes                         |
| [docs/HLD.md](docs/HLD.md)                                     | High-level design notes                           |
| [docs/LLD.md](docs/LLD.md)                                     | Low-level design notes                            |
| [docs/JUDGE_ARCHITECTURE.md](docs/JUDGE_ARCHITECTURE.md)       | Judge, executor, and verdict flow                 |
| [docs/LANGUAGE_SYSTEM.md](docs/LANGUAGE_SYSTEM.md)             | Language catalog and execution profiles           |
| [docs/TESTCASE_GENERATION.md](docs/TESTCASE_GENERATION.md)     | Generator, reference, validator, and checker flow |
| [docs/LOCAL_JUDGE0_SETUP.md](docs/LOCAL_JUDGE0_SETUP.md)       | Local Judge0 setup notes                          |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                       | Deployment checklist and production notes         |
| [docs/TESTING.md](docs/TESTING.md)                             | Test strategy                                     |
| [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | Frontend pages and component structure            |
| [docs/FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md)             | Live-launch feature roadmap                       |
| [docs/LEARNINGS.md](docs/LEARNINGS.md)                         | Things I learned while building this              |

## Current Limitations

- No plagiarism detection yet
- Multi-file submissions are not supported
- Virtual contest history and mock interview reports are browser-local until backed by database models
- Helpful comment markers are browser-local until backed by moderation/community tables
- Frozen contest standings are still roadmap items
- Docker compose does not auto-run migrations
- Local/test live events use the in-memory event bus; deployed Redis mode should run API and worker with the same `REDIS_URL`
- Some large frontend pages can still be split further
- Screenshots and hosted demo are still pending

## Why I Built This

I built this project to go beyond a normal CRUD app and learn how systems like online judges work.
The main focus was on backend flow, code execution safety boundaries, queues, validation, hidden tests,
and making the frontend usable enough to demonstrate the complete flow.
