import type { LucideIcon } from "lucide-react";

export function StatsCard({
  label,
  value,
  hint,
  icon: Icon
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="ca-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-accent-600" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
