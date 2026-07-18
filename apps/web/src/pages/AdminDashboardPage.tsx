import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, FileCode2, ShieldCheck, Trophy, UsersRound } from "lucide-react";
import { adminApi, problemsApi, submissionsApi } from "../services/api";
import { ErrorState } from "../components/State";
import { StatsCard } from "../components/StatsCard";
import { useAuthStore } from "../stores/authStore";
import { ContestManagementSection } from "../features/admin/ContestManagementSection";
import { CreateProblemSection } from "../features/admin/CreateProblemSection";
import { MonitoringSidebar } from "../features/admin/MonitoringSidebar";
import { TestGenerationPanel } from "../features/admin/TestGenerationPanel";
import { UserManagementSection } from "../features/admin/UserManagementSection";
import { activeStarterLanguages } from "../features/admin/starterCode";

export function AdminDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [toast, setToast] = useState("");
  const isAdmin = user?.role === "ADMIN";

  const problems = useQuery({
    queryKey: ["admin-problems"],
    queryFn: () => problemsApi.list({ limit: "100" }),
    enabled: isAdmin
  });

  const adminLanguages = useQuery({
    queryKey: ["admin-languages", "dashboard"],
    queryFn: adminApi.languages,
    enabled: isAdmin
  });

  const contests = useQuery({
    queryKey: ["admin-contests"],
    queryFn: adminApi.contests,
    enabled: isAdmin
  });

  const submissions = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: submissionsApi.list,
    enabled: isAdmin
  });

  const users = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: () => adminApi.users({ limit: "100" }),
    enabled: isAdmin
  });

  const starterLanguages = activeStarterLanguages(adminLanguages.data ?? []);

  if (!isAdmin) {
    return (
      <ErrorState
        title="Admin access required"
        error={new Error("Login with an ADMIN account to create problems and manage platform content.")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Admin Dashboard</h1>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create problems, attach tests, and monitor contest-platform activity from one operational screen.
            </p>
          </div>
          {toast ? (
            <span className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {toast}
            </span>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            icon={UsersRound}
            label="Total Users"
            value={users.data?.length ?? 0}
            hint="admin user management"
          />
          <StatsCard icon={FileCode2} label="Problems" value={problems.data?.length ?? 0} hint="visible problem list" />
          <StatsCard
            icon={Activity}
            label="Submissions"
            value={submissions.data?.length ?? 0}
            hint="visible to current admin context"
          />
          <StatsCard icon={Trophy} label="Contests" value={contests.data?.length ?? 0} hint="contest catalog" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <CreateProblemSection
          languages={starterLanguages}
          languagesLoading={adminLanguages.isLoading}
          languagesError={adminLanguages.error}
          onCreated={(title) => {
            setToast(`Problem saved: ${title}`);
            void problems.refetch();
          }}
        />
        <MonitoringSidebar
          problems={problems.data ?? []}
          submissions={submissions.data ?? []}
          contestCount={contests.data?.length ?? 0}
          userCount={users.data?.length ?? 0}
        />
      </section>

      <TestGenerationPanel
        problems={problems.data ?? []}
        languages={starterLanguages}
        onRefreshProblems={() => {
          void problems.refetch();
        }}
        onToast={setToast}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <UserManagementSection currentUserId={user?.id} onToast={setToast} />
        <ContestManagementSection onToast={setToast} />
      </section>
    </div>
  );
}
