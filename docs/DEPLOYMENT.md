# Deployment Notes

I have not fully deployed CodeArena as a production app yet. This file is a deployment checklist and
notes for how I would deploy it.

## Possible Hosting Setup

- Web app: Vercel, Netlify, or any static hosting provider
- API: Render, Railway, Fly.io, or a VPS
- Worker: same API image, but started with the worker command
- Database: Neon, Supabase, Railway Postgres, or any PostgreSQL instance
- Queue: Redis, for example Upstash Redis
- Code execution: Judge0-compatible service

I would not run untrusted user code directly on the API server.

## Required Environment Variables

The full local template is in `.env.example`.

For API and worker:

```text
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
NODE_ENV=production
CORS_ORIGIN=https://your-web-origin.example
EXECUTOR_MODE=judge0
ALLOW_MOCK_EXECUTOR_IN_PRODUCTION=false
JUDGE0_BASE_URL=https://...
JUDGE0_API_KEY=...
```

For the frontend build:

```text
VITE_API_URL=https://your-api-origin.example/api/v1
```

## Deployment Steps

1. Create PostgreSQL database.
2. Create Redis instance.
3. Set all API and worker environment variables.
4. Generate Prisma client with `npm run db:generate`.
5. Build API with `npm run build -w apps/api`.
6. Run migrations with `npm run db:migrate`.
7. Seed only if it is a demo or staging environment.
8. Sync Judge0 languages if using Judge0.
9. Start API with `npm run start -w apps/api`.
10. Start worker separately with `npm run worker -w apps/api`.
11. Build and deploy frontend with correct `VITE_API_URL`.
12. Set `CORS_ORIGIN` to the deployed web URL.
13. Check `/health`, `/api-docs`, login, problem list, run, submit, and final verdict update.

## Docker Compose

For local container demo:

```bash
docker compose up --build
```

Then run migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

Docker compose starts local services, but migrations are still manual right now.

## Judge0 Notes

For real code execution, I use Judge0. On Windows, the most reliable local setup for me was running
Judge0 in a Linux VM and setting:

```text
JUDGE0_BASE_URL=http://<VM_IP>:2358
```

Mock executor is only for tests and controlled demos. In production, the app should use Judge0 or a
proper sandboxed execution service.

## Operational Checks

Before considering the deployment working, I would verify:

- API starts successfully.
- Worker starts successfully.
- Database migrations are applied.
- Redis queue is connected.
- `/health` returns healthy or clear degraded status.
- `/api/v1/executor/health` can reach Judge0.
- Admin deep health works for admin users.
- A sample run works.
- A queued submission reaches a terminal verdict.
- Hidden test data is not returned to normal users.

## Production Notes

- API and worker should be separate processes.
- Redis-backed BullMQ should be used in deployment.
- API and worker must use the same `EXECUTOR_MODE`.
- JWT secrets should be strong and stored only in the hosting provider.
- `CORS_ORIGIN` should not be `*` in production.
- Run leaderboard snapshot on a schedule if rank movement is needed.
- Logs should not include user source code or secrets.

## Code Execution Warning

Running random user code is risky. For a real production app, Judge0 or another hardened sandbox is
safer than running code directly on the API host.

The Docker executor in this repo is useful for local experiments, but I would not treat it as a full
multi-tenant production sandbox without extra host-level hardening.
