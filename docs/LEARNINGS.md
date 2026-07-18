# Learnings

These are some notes from things I learned while building CodeArena. I kept this file because a lot
of the project was about understanding how an online judge works internally, not only building pages.

## Queue and Worker

At first I thought submissions could be judged directly inside the API request. After testing the
flow, it was clear that this is not a good idea because code execution can take time and the API
request should not stay blocked.

The final flow is:

1. API creates a submission with `PENDING` status.
2. API adds a job to the queue.
3. Worker picks the job.
4. Worker runs the code and updates the verdict.

For tests and local fallback, I also added an in-memory queue.

## Judge0 on Windows

Judge0 was harder to run locally than I expected. On Windows with Docker Desktop/WSL, Judge0 could
list languages but real submissions were not reliable because of cgroup-related issues.

The setup that worked for me was:

1. Run Judge0 inside a Linux VM.
2. Expose Judge0 on port `2358`.
3. Set `JUDGE0_BASE_URL` in CodeArena to the VM URL.

The helper script is:

```bash
scripts/bootstrap-judge0-linux-vm.sh
```

## SSE and Polling

I used Server-Sent Events for live verdict updates. It fits the use case because the frontend mostly
needs one-way updates from the server after a submission.

I still kept polling as a fallback because streams can disconnect. This prevents the UI from getting
stuck on `RUNNING`.

## Hidden Test Cases

One important rule is that hidden test inputs and expected outputs should not be returned to normal
users. Admins can inspect them, but public APIs and normal submission details must redact them.

This affected how I designed DTOs and result mapping.

## Custom Checkers

Exact output comparison is not enough for all problems. Some problems may accept answers in any order
or need floating-point tolerance. For that I added custom checker support.

A checker crash or timeout should never become `ACCEPTED`. It should become `INTERNAL_ERROR`.

## Things Still Pending

- Better mobile layout for the solve workspace
- Plagiarism detection
- Multi-file submissions
- Redis pub/sub for live events in multi-instance deployment
- Hosted demo and screenshots

Overall, the biggest learning was that an online judge is mostly about safe execution boundaries,
queues, validation, and careful handling of hidden test data.
