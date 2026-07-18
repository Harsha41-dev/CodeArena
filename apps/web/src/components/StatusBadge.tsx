import { Badge } from "./Badge";

// styles for contest status and problem solve status
const styles = {
  LIVE: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  UPCOMING: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400",
  ENDED: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
  SOLVED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  ATTEMPTED: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  NOT_ATTEMPTED: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300"
} as const;

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  const className = styles[status];
  // show nicer label without underscores
  const label = status.replace(/_/g, " ");
  return <Badge className={className}>{label}</Badge>;
}
