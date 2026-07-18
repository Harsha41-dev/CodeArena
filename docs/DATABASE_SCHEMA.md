# Database Schema

CodeArena uses PostgreSQL with Prisma. The schema is implemented in `apps/api/prisma/schema.prisma`.

## Core Models

- `User`: account, role, status, country metadata, profile, password hash.
- `RefreshToken`: hashed refresh token storage and revocation.
- `Problem`: statement, slug, difficulty, visibility, limits, checker mode, editorial.
- `Tag` and `ProblemTag`: many-to-many problem taxonomy.
- `TestCase`: sample, hidden, and generated cases with optional batch/job/seed/hash metadata.
- `ProblemAsset`: executable generator, reference solution, validator, or checker source attached to a problem.
- `TestCaseGenerationJob`: queued deterministic generation request and status.
- `GeneratedTestCaseBatch`: group of generated testcase rows created by one job.
- `Language`: database catalog entry for a language family such as Python or C++.
- `LanguageVersion`: concrete selectable version such as Python 3.11 or C++ 20.
- `ProblemLanguage`: problem-level language availability and optional version pinning.
- `ProblemStarterCode`: starter code override per problem and language/version.
- `ExecutionProfile`: executor-specific metadata for Mock, Docker, or Judge0.
- `Submission`: user code and aggregate verdict.
- `SubmissionTestCaseResult`: per-test verdict, stdout, expected output, runtime, memory.
- `ProblemSolvedStatus`: user/problem attempted and solved status.
- `Contest`, `ContestProblem`, `ContestRegistration`, `ContestSubmission`: contest model.
- `Discussion`, `DiscussionComment`, `DiscussionVote`: general and problem discussion threads.
- `Bookmark`, `ProblemList`, `ProblemListItem`, `Note`, `Editorial`: learning tools.
- `UserRankSnapshot`: daily leaderboard rank history for movement indicators.

## Enums

- `Role`: `USER`, `ADMIN`
- `UserStatus`: `ACTIVE`, `INACTIVE`, `DELETED`
- `Difficulty`: `EASY`, `MEDIUM`, `HARD`
- `SubmissionStatus`: `PENDING`, `RUNNING`, `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, `COMPILATION_ERROR`, `INTERNAL_ERROR`
- `LegacyLanguage`: `CPP`, `JAVA`, `PYTHON`, `JAVASCRIPT` for backwards-compatible submission storage.
- `ExecutorType`: `MOCK`, `DOCKER`, `JUDGE0`
- `LanguageCategory`: `GENERAL_PURPOSE`, `SYSTEMS`, `SCRIPTING`, `FUNCTIONAL`, `JVM`, `DOTNET`, `DATABASE`, `SHELL`, `EDUCATIONAL`, `OTHER`
- `ProblemVisibility`: `PUBLIC`, `PRIVATE`, `ARCHIVED`
- `CheckerMode`: `STANDARD`, `CUSTOM_CHECKER`
- `ContestStatus`: `UPCOMING`, `LIVE`, `ENDED`
- `ProblemAssetType`: `GENERATOR`, `REFERENCE_SOLUTION`, `VALIDATOR`, `CHECKER`
- `GenerationJobStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`

## Important Indexes

- `User.email` unique, `User.username` unique.
- `Problem.slug` unique, plus indexes on difficulty, title, createdAt, visibility, and visibility/difficulty/createdAt filters.
- `ProblemTag.tagId` supports tag-filtered problem lists.
- `TestCase.problemId/isSample/order` supports sample display and hidden judge ordering.
- `TestCase.generatedByJobId`, `TestCase.batchId`, and `TestCase.problemId/inputHash` support generated batch cleanup, job audits, and duplicate detection.
- `ProblemAsset.problemId/type` supports active asset lookup for generation.
- `ProblemAsset.languageId` and `ProblemAsset.languageVersionId` preserve which executable profile should run an asset.
- `TestCaseGenerationJob.problemId/status` supports admin job lists and operational status checks.
- `GeneratedTestCaseBatch.problemId/createdAt` supports admin generated-batch history.
- `Language.key` is unique and supports stable API selectors.
- `LanguageVersion.languageId/version` is unique and supports version lookup.
- `LanguageVersion.languageId/isDefault` helps choose a fallback version.
- `ProblemLanguage.problemId/languageId` controls problem-level availability.
- `ProblemStarterCode.problemId/languageId/languageVersionId` supports starter override lookup.
- `ExecutionProfile.languageVersionId/executorType` is unique so each version has one profile per executor mode.
- `Submission.userId/status/createdAt` supports personal history; `problemId/status/runtimeMs` supports problem leaderboards.
- `Submission.languageVersionId` and language snapshot fields preserve historical display after catalog edits.
- `ProblemSolvedStatus.problemId/solved` supports aggregate solved metrics.
- `Contest.status/startTime`, `ContestProblem.contestId/order`, `ContestRegistration.userId`, and `ContestSubmission.contestId/status/submittedAt` support contest listings and standings.
- `Contest.visibility/status` supports public contest listing while preserving admin draft/archive operations.
- `User.role/status` and `User.country` support admin filters and country-aware leaderboard/profile display.
- `Discussion.problemId/createdAt`, `Discussion.contestId/createdAt`, `Discussion.authorId`, and `DiscussionVote.discussionId/userId` support scoped threads and one vote per user.
- `Editorial.problemId/isPublished` supports draft and published editorial lookups.
- `UserRankSnapshot.userId/snapshotDate` supports daily leaderboard rank movement and prevents duplicate snapshots per user/day.
- Social indexes cover discussion/comment listing, bookmarks, lists, and notes by user or problem.

## Data Retention

Submissions and per-test results are append-heavy and should be retained for auditability. Refresh tokens expire and can be removed by a scheduled cleanup.

Language catalog rows are soft-disabled with `isActive` instead of deleted so older submissions, starter code, and problem settings remain auditable.

Generated test cases are normal `TestCase` rows with extra metadata. Deleting a generated batch removes the batch's generated test cases, while manually created sample/hidden cases remain untouched.
