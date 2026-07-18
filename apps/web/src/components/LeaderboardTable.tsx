import type { LeaderboardRow } from "../types/api";

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="ca-table-head">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Solved</th>
            <th className="px-4 py-3">Accepted</th>
            <th className="px-4 py-3">Country</th>
            <th className="px-4 py-3">Move</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const initials = row.user.displayName.slice(0, 2).toUpperCase();
            const countryLabel = getCountryLabel(row);
            const movementText = formatMovement(row.rankMovementDirection, row.rankMovement);
            let movementClass = "text-slate-500";
            if (row.rankMovementDirection === "DOWN") {
              movementClass = "text-rose-600";
            } else if (row.rankMovementDirection === "UP") {
              movementClass = "text-emerald-600";
            }

            return (
              <tr key={row.user.id} className="ca-table-row">
                <td className="px-4 py-3 text-lg font-semibold text-slate-400">#{row.rank}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                      {initials}
                    </span>
                    <div>
                      <p className="font-medium">{row.user.displayName}</p>
                      <p className="text-xs text-slate-500">@{row.user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{row.solvedCount}</td>
                <td className="px-4 py-3">{row.acceptedSubmissions}</td>
                <td className="px-4 py-3">{countryLabel}</td>
                <td className={`px-4 py-3 ${movementClass}`}>{movementText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getCountryLabel(row: LeaderboardRow): string {
  if (row.user.countryCode) {
    return `${row.user.countryCode} - ${row.user.country ?? ""}`;
  }
  if (row.user.country) {
    return row.user.country;
  }
  return "Unspecified";
}

function formatMovement(direction?: LeaderboardRow["rankMovementDirection"], movement = 0) {
  if (direction === "NEW") {
    return "new";
  }
  if (direction === "UP") {
    return `+${movement}`;
  }
  if (direction === "DOWN") {
    return `-${movement}`;
  }
  return "same";
}
