import { CalendarClock, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import type { Contest } from "../types/api";
import { formatDateTime } from "../lib/derivedStats";
import { StatusBadge } from "./StatusBadge";
import { ContestTimer } from "./ContestTimer";

export function ContestCard({ contest }: { contest: Contest }) {
  // duration in hours (at least 1 so it doesn't show 0h)
  const startMs = new Date(contest.startTime).getTime();
  const endMs = new Date(contest.endTime).getTime();
  const durationHours = Math.max(1, Math.round((endMs - startMs) / 3600000));
  const problemCount = contest.problems.length;

  return (
    <Link to={`/contests/${contest.id}`} className="ca-panel block p-5 hover:border-accent-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="h-5 w-5 text-accent-600" />
            <h2 className="font-semibold">{contest.title}</h2>
            <StatusBadge status={contest.status} />
          </div>
          <p className="mt-2 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{contest.description}</p>
        </div>
        <ContestTimer startTime={contest.startTime} endTime={contest.endTime} />
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <Info label="Start" value={formatDateTime(contest.startTime)} />
        <Info label="Duration" value={`${durationHours}h`} />
        <Info label="Problems" value={`${problemCount}`} icon />
      </div>
    </Link>
  );
}

function Info({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="ca-muted-panel px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-1 font-medium">
        {icon ? <ListChecks className="h-3.5 w-3.5" /> : null}
        {value}
      </p>
    </div>
  );
}
