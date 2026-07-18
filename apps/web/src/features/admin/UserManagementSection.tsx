import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { adminApi } from "../../services/api";
import type { User } from "../../types/api";
import { Button } from "../../components/Button";
import { PanelTitle, TextInput } from "./formFields";

type RoleFilter = "ALL" | User["role"];
type StatusFilter = "ALL" | NonNullable<User["status"]>;

interface UserManagementSectionProps {
  currentUserId?: string;
  onToast: (message: string) => void;
}

export function UserManagementSection({ currentUserId, onToast }: UserManagementSectionProps) {
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState<RoleFilter>("ALL");
  const [userStatus, setUserStatus] = useState<StatusFilter>("ALL");

  const users = useQuery({
    queryKey: ["admin-users", userSearch, userRole, userStatus],
    queryFn: () => {
      const params: Record<string, string> = { limit: "100" };
      if (userSearch.trim()) {
        params.search = userSearch.trim();
      }
      if (userRole !== "ALL") {
        params.role = userRole;
      }
      if (userStatus !== "ALL") {
        params.status = userStatus;
      }
      return adminApi.users(params);
    }
  });

  const updateUserStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: NonNullable<User["status"]> }) =>
      adminApi.updateUserStatus(id, status),
    onSuccess: () => {
      onToast("User status updated");
      void users.refetch();
    }
  });

  const updateUserRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: User["role"] }) => adminApi.updateUserRole(id, role),
    onSuccess: () => {
      onToast("User role updated");
      void users.refetch();
    }
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      onToast("User deleted");
      void users.refetch();
    }
  });

  return (
    <div className="ca-panel p-5">
      <PanelTitle icon={UsersRound} title="User Management" />
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <TextInput label="Search" value={userSearch} onChange={setUserSearch} />
        <label className="block text-sm">
          <span className="font-medium">Role</span>
          <select
            className="ca-input mt-1 w-full"
            value={userRole}
            onChange={(event) => setUserRole(event.target.value as RoleFilter)}
          >
            <option value="ALL">All roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select
            className="ca-input mt-1 w-full"
            value={userStatus}
            onChange={(event) => setUserStatus(event.target.value as StatusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="DELETED">DELETED</option>
          </select>
        </label>
      </div>
      <div className="mt-4 space-y-2">
        {(users.data ?? []).map((item) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
          >
            <div>
              <p className="font-medium">
                {item.displayName} <span className="text-xs text-slate-500">@{item.username}</span>
              </p>
              <p className="text-xs text-slate-500">
                {item.email} - {item.countryCode ?? "country unset"}
              </p>
            </div>
            <select
              className="ca-input"
              value={item.role}
              onChange={(event) => {
                const role = event.target.value as User["role"];
                if (window.confirm(`Change ${item.username} role to ${role}?`)) {
                  updateUserRole.mutate({ id: item.id, role });
                }
              }}
              disabled={item.id === currentUserId}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <select
              className="ca-input"
              value={item.status ?? "ACTIVE"}
              onChange={(event) => {
                const status = event.target.value as NonNullable<User["status"]>;
                if (window.confirm(`Change ${item.username} status to ${status}?`)) {
                  updateUserStatus.mutate({ id: item.id, status });
                }
              }}
              disabled={item.id === currentUserId}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DELETED">DELETED</option>
            </select>
            <Button
              variant="secondary"
              disabled={item.id === currentUserId || deleteUser.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${item.username}?`)) {
                  deleteUser.mutate(item.id);
                }
              }}
            >
              Delete
            </Button>
          </div>
        ))}
        {!users.data?.length ? <p className="text-sm text-slate-500">No users match the current filters.</p> : null}
      </div>
    </div>
  );
}
