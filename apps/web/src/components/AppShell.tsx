import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Code2,
  Compass,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Trophy,
  UserRound,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "./Button";
import { useAuthStore } from "../stores/authStore";
import { useUiStore } from "../stores/uiStore";

const navLinks = [
  { href: "/problems", label: "Problems", icon: BookOpen },
  { href: "/contests", label: "Contests", icon: Trophy },
  { href: "/practice", label: "Practice", icon: Compass },
  { href: "/leaderboard", label: "Leaderboard", icon: UsersRound },
  { href: "/discuss", label: "Discuss", icon: ListChecks },
  { href: "/submissions", label: "Submissions", icon: Code2 },
  { href: "/profile", label: "Profile", icon: UserRound }
];

const sidebarLinks = [{ href: "/", label: "Home", icon: Home }, ...navLinks];

export function AppShell() {
  const { user, logout } = useAuthStore();
  const { toggleDarkMode } = useUiStore();
  const navigate = useNavigate();

  const isAdmin = user?.role === "ADMIN";
  const initials = user ? user.displayName.slice(0, 2).toUpperCase() : "";

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    const value = event.currentTarget.value.trim();
    if (!value) {
      return;
    }
    navigate(`/problems?search=${encodeURIComponent(value)}`);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors duration-200 dark:bg-[#09090b] dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#09090b]/80">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link to="/" className="flex min-w-fit items-center gap-2 font-semibold tracking-tight">
            <img src="/codearena-mark.svg" alt="" className="h-7 w-7" />
            <span>CodeArena</span>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex ml-4">
            {navLinks.map((link) => (
              <TopNavLink key={link.href} {...link} />
            ))}
            {isAdmin ? <TopNavLink href="/admin" label="Admin" icon={Shield} /> : null}
            {isAdmin ? <TopNavLink href="/admin/languages" label="Languages" icon={Code2} /> : null}
          </nav>

          <div className="ml-auto hidden min-w-72 max-w-md flex-1 items-center lg:flex">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="ca-input w-full rounded-full pl-9 bg-slate-100/50 dark:bg-white/5"
                placeholder="Search problems, contests, users"
                onKeyDown={handleSearchKeyDown}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" aria-label="Notifications" className="rounded-full h-9 w-9 p-0">
              <Bell className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              aria-label="Toggle theme"
              onClick={toggleDarkMode}
              className="rounded-full h-9 w-9 p-0"
            >
              <Moon className="h-4 w-4" />
            </Button>

            {user ? (
              <details className="relative">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full px-2 py-1 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent hover:border-slate-200 dark:hover:border-white/10">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    {initials}
                  </span>
                  <span className="hidden pr-1 font-medium sm:block">{user.username}</span>
                </summary>
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200/80 bg-white p-2 shadow-card dark:border-white/10 dark:bg-[#111113]">
                  <Link
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                    to="/profile"
                  >
                    <UserRound className="h-4 w-4" /> Profile
                  </Link>
                  {isAdmin ? (
                    <Link
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                      to="/admin"
                    >
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  ) : null}
                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              </details>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => navigate("/login")}>
                  Login
                </Button>
                <Button onClick={() => navigate("/register")}>Register</Button>
              </div>
            )}

            <Button variant="ghost" className="lg:hidden rounded-full h-9 w-9 p-0" aria-label="Menu">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[13rem_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] border-r border-slate-200/80 px-3 py-4 dark:border-white/10 lg:block">
          <nav className="space-y-1">
            {sidebarLinks.map((link) => (
              <SideNavLink key={link.href} {...link} />
            ))}
            {isAdmin ? <SideNavLink href="/admin" label="Admin" icon={Shield} /> : null}
            {isAdmin ? <SideNavLink href="/admin/languages" label="Languages" icon={Code2} /> : null}
          </nav>
        </aside>

        <main className="min-w-0 px-3 py-4 sm:px-4 lg:px-6 xl:px-8">
          <Outlet />
        </main>
      </div>

      {/* mobile bottom nav — only first 5 links so it fits */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe lg:hidden dark:border-white/10 dark:bg-[#09090b]/95">
        {navLinks.slice(0, 5).map((link) => (
          <NavLink
            key={link.href}
            to={link.href}
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )
            }
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TopNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        clsx(
          "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

function SideNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        clsx(
          "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
