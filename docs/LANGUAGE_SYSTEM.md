# Dynamic Language System

CodeArena stores supported languages in the database instead of hardcoding the judge to a small enum.

## Data Model

- `Language`: stable language family such as `python`, `cpp`, or `rust`.
- `LanguageVersion`: selectable version such as Python 3.11, C++ 20, or Java 21.
- `ExecutionProfile`: executor-specific metadata for `MOCK`, `DOCKER`, or `JUDGE0`.
- `ProblemLanguage`: enables/disables a language for one problem and can optionally pin one version.
- `ProblemStarterCode`: problem-specific starter code for a language or exact language version.

Submissions keep `languageKeySnapshot`, `languageNameSnapshot`, and `languageVersionSnapshot` so history remains readable after admins rename or disable catalog entries.

## Runtime Flow

1. Frontend loads `GET /api/v1/problems/:slug/languages`.
2. User selects a language/version option.
3. Run or submit payload sends `languageVersionId`, `languageKey` plus `version`, or `language` as a dynamic key.
4. `LanguageResolver` validates active language, active version, problem availability, and executor profile compatibility.
5. API uses the resolved profile for sample/custom runs or stores snapshots on queued submissions.
6. Worker resolves the stored submission language and executes hidden tests through the configured executor.

## Executor Compatibility

- `MOCK`: every active seeded version has a profile for deterministic tests and demos.
- `JUDGE0`: requires `JUDGE0_BASE_URL` plus `judge0Id` on the selected version or profile.
- `DOCKER`: requires an image and compile/run command profile.

If a language is active but unsupported by the current executor mode, the API returns `400` with `LANGUAGE_EXECUTOR_UNAVAILABLE` before execution or queueing. `GET /api/v1/executor/capabilities` exposes the same compatibility decision to the frontend, including optional `problemSlug`/`problemId` filtering. The solve page can therefore work with newly added languages without rebuilding the web app.

## Admin Workflow

Admins can use `/admin/languages` in the web app to:

- Enable or disable languages.
- Add or disable versions.
- Mark a default version.
- Edit Judge0 id and Docker command metadata.
- Sync Judge0 language IDs from `JUDGE0_BASE_URL`.
- Choose exactly which languages are allowed for a problem and optionally pin a language to one version.
- Save starter code per problem and language/version.

The admin language page also shows executor capability badges. A language can be globally active and still display as not executable when the current executor mode lacks configuration for that version.

## Judge0 Sync

Run:

```bash
npm run judge0:health
npm run languages:sync:judge0
```

or call:

```text
POST /api/v1/admin/languages/sync/judge0
```

The sync imports recognized Judge0 languages and versions, upserts `JUDGE0` profiles, and does not delete local languages. For existing versions it preserves admin labels, disabled language/version state, and disabled profile state. Unknown names are skipped rather than guessed.

## Limitations

- The catalog can list more languages than a production executor supports. Only versions with an active profile for the current `EXECUTOR_MODE` can run.
- Docker profiles are metadata-driven, but Docker sandboxing still needs hardened hosts, image allowlists, runtime patching, and extra host-level isolation in production.
- Judge0 sync covers common language names; uncommon names may need manual admin mapping.
- Old submissions stay readable through language snapshots, but rejudging an old submission still requires the referenced language/version to be executable in the current environment.
