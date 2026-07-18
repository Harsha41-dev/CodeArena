import { Badge } from "./Badge";

export function TagBadge({ label }: { label: string }) {
  const className =
    "bg-slate-500/5 text-slate-600 border-slate-500/10 dark:bg-white/5 dark:text-slate-300 dark:border-white/10";
  return <Badge className={className}>{label}</Badge>;
}
