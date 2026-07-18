import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminLanguagesPage } from "./pages/AdminLanguagesPage";
import { ContestDetailPage } from "./pages/ContestDetailPage";
import { ContestsPage } from "./pages/ContestsPage";
import { DiscussionDetailPage } from "./pages/DiscussionDetailPage";
import { DiscussionsPage } from "./pages/DiscussionsPage";
import { LandingPage } from "./pages/LandingPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProblemWorkspacePage } from "./pages/ProblemWorkspacePage";
import { ProblemsPage } from "./pages/ProblemsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PracticePage } from "./pages/PracticePage";
import { RegisterPage } from "./pages/RegisterPage";
import { SubmissionDetailPage } from "./pages/SubmissionDetailPage";
import { SubmissionsPage } from "./pages/SubmissionsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "problems", element: <ProblemsPage /> },
      { path: "problems/:slug", element: <ProblemWorkspacePage /> },
      { path: "problems/:slug/editor", element: <ProblemWorkspacePage /> },
      { path: "problems/:slug/discussions", element: <DiscussionsPage /> },
      { path: "practice", element: <PracticePage /> },
      { path: "discuss", element: <DiscussionsPage /> },
      { path: "discuss/:id", element: <DiscussionDetailPage /> },
      { path: "submissions", element: <SubmissionsPage /> },
      { path: "submissions/:id", element: <SubmissionDetailPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "leaderboard", element: <LeaderboardPage /> },
      { path: "contests", element: <ContestsPage /> },
      { path: "contests/:id", element: <ContestDetailPage /> },
      { path: "contests/:id/leaderboard", element: <ContestDetailPage /> },
      { path: "contests/:id/problems/:slug", element: <ProblemWorkspacePage /> },
      { path: "admin", element: <AdminDashboardPage /> },
      { path: "admin/languages", element: <AdminLanguagesPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
