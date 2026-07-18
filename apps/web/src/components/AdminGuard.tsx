import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function AdminGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/problems" replace />;
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/problems" replace />;
  }

  return <>{children}</>;
}
