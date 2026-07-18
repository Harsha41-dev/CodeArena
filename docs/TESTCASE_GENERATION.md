# Test-Case Generation

Admins can generate test cases for a problem instead of typing every I/O pair by hand. Uses a generator script + trusted reference solution (and optional validator/checker).

## Asset Model

Each problem can have active assets:

- `GENERATOR`: creates one input from a deterministic seed.
- `REFERENCE_SOLUTION`: creates expected output for generated input.
- `VALIDATOR`: optional input validator.
- `CHECKER`: optional custom checker used by official judging when the problem is in `CUSTOM_CHECKER` mode.

Assets store source code, filename, language, and language version. The language/version must have an active execution profile for the current executor mode.

## Custom Checker Flow

Problems default to `STANDARD` checker mode, which compares normalized expected output. Admins can switch a problem to `CUSTOM_CHECKER` only after an active `CHECKER` asset exists. Official judging first executes the user's solution. If user execution succeeds, the worker runs the checker through the same executor abstraction with stdin:

```text
[input]
---EXPECTED---
[expectedOutput]
---ACTUAL---
[actualOutput]
```

Checker exit/status `ACCEPTED` means the testcase is accepted. `WRONG_ANSWER` rejects the testcase. Missing checker assets, checker compile errors, runtime errors, timeouts, memory-limit failures, executor failures, or unavailable checker profiles become a safe judge-side error and never accept a submission.

## Generation Flow

1. Admin uploads or edits assets in the admin dashboard.
2. Admin previews one seed to inspect generated input and expected output.
3. Admin queues a batch with seed start, count, visibility, duplicate handling, and validator options.
4. Worker runs generator, optional validator, and reference solution through the executor abstraction.
5. Generated input/output are size-limited, normalized, hashed, and deduplicated.
6. Worker saves generated `TestCase` rows with `batchId`, `generatedByJobId`, `generatorSeed`, `inputHash`, `outputHash`, and `isGenerated`.
7. Job becomes `COMPLETED`, `FAILED`, or `CANCELLED`. If a running job fails or is cancelled after creating a batch, that batch is removed so partial generated cases do not become official judge data.

Preview runs one seed through the same generator/reference path, but it does not create `TestCase` rows or generated batches.

## APIs

- `GET /api/v1/admin/problems/:problemId/assets`
- `POST /api/v1/admin/problems/:problemId/assets`
- `PATCH /api/v1/admin/problem-assets/:assetId`
- `DELETE /api/v1/admin/problem-assets/:assetId`
- `PATCH /api/v1/admin/problems/:problemId/checker-mode`
- `POST /api/v1/admin/problems/:problemId/checker/preview`
- `POST /api/v1/admin/problems/:problemId/test-generation/preview`
- `POST /api/v1/admin/problems/:problemId/test-generation-jobs`
- `GET /api/v1/admin/problems/:problemId/test-generation-jobs`
- `GET /api/v1/admin/test-generation-jobs/:jobId`
- `POST /api/v1/admin/test-generation-jobs/:jobId/cancel`
- `GET /api/v1/admin/problems/:problemId/testcase-batches`
- `DELETE /api/v1/admin/testcase-batches/:batchId`

All endpoints require backend admin RBAC.

## Safety Limits

Environment variables:

```text
MAX_GENERATED_CASES_PER_JOB=100
MAX_GENERATED_INPUT_BYTES=65536
MAX_GENERATED_OUTPUT_BYTES=65536
MAX_GENERATION_JOB_RUNTIME_MS=120000
```

The worker never returns hidden generated inputs or expected outputs through public problem APIs. Batch summary responses return metadata and counts, not full hidden testcase bodies. Submission detail responses redact non-sample judge input, expected output, actual output, and stderr for normal users; admins can inspect full per-case details for debugging.

## Deployment Notes

Local/test mode uses `InMemoryTestCaseGenerationQueue`. Redis-backed deployments use BullMQ queue name `test-case-generation`. Production should run generation workers separately from the HTTP API and execute generation assets in the same hardened sandbox used for submissions. `MockExecutor` is for deterministic tests only, and Docker mode is a local/demo integration unless the host, images, network, filesystem, CPU, memory, and process isolation are hardened.

Example files live in `examples/testcase-generation/`.
