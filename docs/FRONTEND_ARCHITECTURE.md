# Frontend Architecture

This file gives a simple overview of how I organized the React frontend. The main goal was to make
the app feel like a usable coding platform and not only a set of separate pages.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Zustand
- Monaco Editor
- Lucide icons

## Folder Structure

```text
apps/web/src/pages        Route-level pages
apps/web/src/components   Reusable UI components
apps/web/src/features     Larger feature sections split from pages
apps/web/src/services     API client wrappers
apps/web/src/stores       Zustand stores
apps/web/src/hooks        Custom React hooks
apps/web/src/lib          Small helper functions
apps/web/src/types        Shared frontend API types
```

Routes are defined in `apps/web/src/routes.tsx`. `App.tsx` only mounts the router.

## Main Pages

- `LandingPage`: overview, popular problems, upcoming contests, and leaderboard preview.
- `ProblemsPage`: problem list with search, filters, tags, difficulty, and status.
- `ProblemWorkspacePage`: problem statement, editor, run samples, custom input, submit, notes, discussions, and results.
- `ContestsPage`: live, upcoming, and past contests.
- `ContestDetailPage`: contest details, registration, problems, and standings.
- `PracticePage`: practice dashboard and progress sections.
- `LeaderboardPage`: leaderboard filters and ranking table.
- `ProfilePage`: user profile, stats, heatmap, language stats, and activity.
- `SubmissionsPage`: user submission history.
- `SubmissionDetailPage`: submitted code, verdict, runtime, memory, and test results.
- `DiscussionsPage`: general and problem discussions.
- `DiscussionDetailPage`: comments and voting.
- `AdminDashboardPage`: problem creation, users, contests, editorials, and monitoring.
- `AdminLanguagesPage`: language catalog, versions, execution profiles, and starter code settings.

## Feature Modules

Some admin dashboard sections were moved into `features/admin` so the dashboard page does not hold
everything directly.

Current admin feature files include:

- `CreateProblemSection`
- `UserManagementSection`
- `ContestManagementSection`
- `TestGenerationPanel`
- `MonitoringSidebar`
- Shared helper files for form fields, starter code, and test-generation asset defaults

The solve workspace and admin language page are still bigger than I want. They can be split more
later into smaller hooks and panels.

## Reusable Components

Common components are kept in `components`.

Examples:

- Layout and guards: `AppShell`, `AuthGuard`, `AdminGuard`
- Tables: `ProblemTable`, `LeaderboardTable`, `SubmissionTable`
- Judge UI: `CodeEditor`, `ProblemStatement`, `TestCasePanel`, `ResultPanel`
- Badges: `VerdictBadge`, `DifficultyBadge`, `StatusBadge`, `TagBadge`
- General UI: `Button`, `Card`, `SearchInput`, `FilterBar`, `Pagination`
- States: `LoadingState`, `EmptyState`, `ErrorState`, `LoadingSkeleton`
- Profile UI: `HeatmapCalendar`, `ProgressRing`

## Data Fetching

The frontend uses TanStack Query for most API data:

- Problems and problem details
- Languages and executor capabilities
- Run, custom run, and submit flows
- Submissions and live status refresh
- Leaderboards and contests
- Discussions, bookmarks, notes, and editorials
- Admin users, contests, languages, and test-generation assets

Axios is wrapped in `services/api.ts`. It also handles attaching the access token and refreshing the
session when possible.

## State Management

I used Zustand for small global state:

- Auth state and tokens
- User data
- UI preferences like theme

Problem-specific editor drafts are stored in `localStorage` using a key based on problem and language.

## Solve Workspace Flow

1. Load problem details.
2. Load languages allowed for the problem.
3. Load executor capability status.
4. Pick the first runnable language by default.
5. Load starter code or saved draft.
6. User runs samples or custom input.
7. User submits official solution.
8. Submission status updates through SSE, with polling fallback.
9. Result panel shows verdict and per-test information.

## Admin Flow

The admin pages let an admin:

- Create and update problems
- Add sample and hidden test cases
- Manage languages and versions
- Configure starter code
- Create contests
- Manage users
- Create editorials
- Configure test-generation assets
- Preview custom checkers and generated test cases

Backend RBAC is still the main security layer. Frontend admin guards only hide routes from normal users.

## Responsive UI Notes

- The app has a desktop sidebar and mobile bottom navigation.
- Tables use horizontal scrolling on smaller screens.
- The solve workspace stacks panels on small screens.
- The editor has a fullscreen mode.

## Remaining Frontend Improvements

- Split `ProblemWorkspacePage` into smaller panels and hooks.
- Split `AdminLanguagesPage` into smaller feature modules.
- Improve mobile layout for the editor/testcase area.
- Add more frontend tests for important flows.
