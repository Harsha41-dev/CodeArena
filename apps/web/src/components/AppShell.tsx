import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  Building2,
  Code2,
  Compass,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Target,
  Trophy,
  UserRound,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "./Button";
import { notificationsApi } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useUiStore } from "../stores/uiStore";

const navLinks = [
  { href: "/problems", label: "Problems", icon: BookOpen },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contests", label: "Contests", icon: Trophy },
  { href: "/virtual-contest", label: "Virtual", icon: Trophy },
  { href: "/practice", label: "Practice", icon: Compass },
  { href: "/interview", label: "Interview", icon: Target },
  { href: "/leaderboard", label: "Ranks", icon: UsersRound },
  { href: "/discuss", label: "Discuss", icon: ListChecks },
  { href: "/submissions", label: "Submissions", icon: Code2 },
  { href: "/profile", label: "Profile", icon: UserRound }
];

const sidebarLinks = [{ href: "/", label: "Home", icon: Home }, ...navLinks];

export function AppShell() {
  const { user, logout } = useAuthStore();
  const { toggleDarkMode } = useUiStore();
  const navigate = useNavigate();
  const unreadNotifications = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.list({ unreadOnly: "true", limit: "10" }),
    enabled: Boolean(user),
    staleTime: 30_000
  });

  const isAdmin = user?.role === "ADMIN";
  const initials = user ? user.displayName.slice(0, 2).toUpperCase() : "";
  const unreadCount = unreadNotifications.data?.length ?? 0;

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
    <div className="min-h-screen bg-[#07080a] text-[#e8eaee]">
      <header className="sticky top-0 z-40 border-b border-[#252a32] bg-[#07080a]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
          <Link to="/" className="flex min-w-fit items-center gap-2 font-medium tracking-tight">
            <img src="/codearena-mark.svg" alt="" className="h-7 w-7" />
            <span>CodeArena</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 xl:flex">
            {navLinks.slice(0, 6).map((link) => (
              <TopNavLink key={link.href} {...link} />
            ))}
            {isAdmin ? <TopNavLink href="/admin" label="Admin" icon={Shield} /> : null}
          </nav>

          <div className="ml-auto hidden min-w-72 max-w-md flex-1 items-center lg:flex">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#9aa1ac]" />
              <input
                className="ca-input w-full pl-9"
                placeholder="Search problems, contests, users"
                onKeyDown={handleSearchKeyDown}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              aria-label="Notifications"
              className="relative h-9 w-9 rounded-full p-0"
              onClick={() => navigate("/profile?tab=notifications")}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#7dcfb6] px-1 text-[10px] font-bold leading-none text-[#06211b]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
            <Button
              variant="ghost"
              aria-label="Toggle theme"
              onClick={toggleDarkMode}
              className="h-9 w-9 rounded-full p-0"
            >
              <Moon className="h-4 w-4" />
            </Button>

            {user ? (
              <details className="relative">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-[#252a32] px-2 py-1 text-sm">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#14332c] text-[10px] font-semibold text-[#7dcfb6]">
                    {initials}
                  </span>
                  <span className="hidden pr-1 sm:block">{user.username}</span>
                </summary>
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#252a32] bg-[#101216] p-2">
                  <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#181c22]" to="/profile">
                    <UserRound className="h-4 w-4" /> Profile
                  </Link>
                  {isAdmin ? (
                    <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#181c22]" to="/admin">
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  ) : null}
                  <div className="my-1 border-t border-[#252a32]" />
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#c97a72] hover:bg-[#181c22]"
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

            <Button variant="ghost" className="h-9 w-9 rounded-full p-0 lg:hidden" aria-label="Menu">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[13rem_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] border-r border-[#252a32] px-3 py-4 lg:block">
          <nav className="space-y-1">
            {sidebarLinks.map((link) => (
              <SideNavLink key={link.href} {...link} />
            ))}
            {isAdmin ? <SideNavLink href="/admin" label="Admin" icon={Shield} /> : null}
            {isAdmin ? <SideNavLink href="/admin/languages" label="Languages" icon={Code2} /> : null}
          </nav>
        </aside>

        <main className="min-w-0 px-3 py-6 sm:px-4 lg:px-6 xl:px-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-[#252a32] bg-[#07080a]/95 backdrop-blur-md pb-safe lg:hidden">
        {navLinks.slice(0, 5).map((link) => (
          <NavLink
            key={link.href}
            to={link.href}
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
                isActive ? "text-[#7dcfb6]" : "text-[#9aa1ac] hover:text-[#e8eaee]"
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

function TopNavLink({ href, label }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        clsx(
          "inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors",
          isActive ? "bg-[#e8eaee] text-[#07080a]" : "text-[#9aa1ac] hover:bg-[#181c22] hover:text-[#e8eaee]"
        )
      }
    >
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
          "flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
          isActive ? "bg-[#e8eaee] text-[#07080a]" : "text-[#9aa1ac] hover:bg-[#181c22] hover:text-[#e8eaee]"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
