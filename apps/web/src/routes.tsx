import { lazy, Suspense, type ReactElement } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/State";
import { NotFoundPage } from "./pages/NotFoundPage";

const AdminDashboardPage = lazy(() =>
  import("./pages/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage }))
);
const AdminLanguagesPage = lazy(() =>
  import("./pages/AdminLanguagesPage").then((module) => ({ default: module.AdminLanguagesPage }))
);
const CompanySheetsPage = lazy(() =>
  import("./pages/CompanySheetsPage").then((module) => ({ default: module.CompanySheetsPage }))
);
const ContestDetailPage = lazy(() =>
  import("./pages/ContestDetailPage").then((module) => ({ default: module.ContestDetailPage }))
);
const ContestsPage = lazy(() => import("./pages/ContestsPage").then((module) => ({ default: module.ContestsPage })));
const DiscussionDetailPage = lazy(() =>
  import("./pages/DiscussionDetailPage").then((module) => ({ default: module.DiscussionDetailPage }))
);
const DiscussionsPage = lazy(() =>
  import("./pages/DiscussionsPage").then((module) => ({ default: module.DiscussionsPage }))
);
const InterviewPage = lazy(() => import("./pages/InterviewPage").then((module) => ({ default: module.InterviewPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage }))
);
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const ProblemWorkspacePage = lazy(() =>
  import("./pages/ProblemWorkspacePage").then((module) => ({ default: module.ProblemWorkspacePage }))
);
const ProblemSetPage = lazy(() =>
  import("./pages/ProblemSetPage").then((module) => ({ default: module.ProblemSetPage }))
);
const ProblemsPage = lazy(() => import("./pages/ProblemsPage").then((module) => ({ default: module.ProblemsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const PublicProfilePage = lazy(() =>
  import("./pages/PublicProfilePage").then((module) => ({ default: module.PublicProfilePage }))
);
const PracticePage = lazy(() => import("./pages/PracticePage").then((module) => ({ default: module.PracticePage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const SubmissionDetailPage = lazy(() =>
  import("./pages/SubmissionDetailPage").then((module) => ({ default: module.SubmissionDetailPage }))
);
const SubmissionsPage = lazy(() =>
  import("./pages/SubmissionsPage").then((module) => ({ default: module.SubmissionsPage }))
);
const StudyPlanPage = lazy(() => import("./pages/StudyPlanPage").then((module) => ({ default: module.StudyPlanPage })));
const VirtualContestPage = lazy(() =>
  import("./pages/VirtualContestPage").then((module) => ({ default: module.VirtualContestPage }))
);

function page(element: ReactElement) {
  return <Suspense fallback={<LoadingState label="Loading page" />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: page(<LandingPage />) },
      { path: "login", element: page(<LoginPage />) },
      { path: "register", element: page(<RegisterPage />) },
      { path: "problems", element: page(<ProblemsPage />) },
      { path: "companies", element: page(<CompanySheetsPage />) },
      { path: "companies/:slug", element: page(<CompanySheetsPage />) },
      { path: "problems/:slug", element: page(<ProblemWorkspacePage />) },
      { path: "problems/:slug/editor", element: page(<ProblemWorkspacePage />) },
      { path: "problems/:slug/discussions", element: page(<DiscussionsPage />) },
      { path: "practice", element: page(<PracticePage />) },
      { path: "sets/:slug", element: page(<ProblemSetPage />) },
      { path: "study/:slug", element: page(<StudyPlanPage />) },
      { path: "interview", element: page(<InterviewPage />) },
      { path: "discuss", element: page(<DiscussionsPage />) },
      { path: "discuss/:id", element: page(<DiscussionDetailPage />) },
      { path: "submissions", element: page(<SubmissionsPage />) },
      { path: "submissions/:id", element: page(<SubmissionDetailPage />) },
      { path: "profile", element: page(<ProfilePage />) },
      { path: "u/:username", element: page(<PublicProfilePage />) },
      { path: "leaderboard", element: page(<LeaderboardPage />) },
      { path: "contests", element: page(<ContestsPage />) },
      { path: "virtual-contest", element: page(<VirtualContestPage />) },
      { path: "contests/:id/discussions", element: page(<DiscussionsPage />) },
      { path: "contests/:id", element: page(<ContestDetailPage />) },
      { path: "contests/:id/leaderboard", element: page(<ContestDetailPage />) },
      { path: "contests/:id/problems/:slug", element: page(<ProblemWorkspacePage />) },
      { path: "admin", element: page(<AdminDashboardPage />) },
      { path: "admin/languages", element: page(<AdminLanguagesPage />) },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
