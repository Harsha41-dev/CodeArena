export function HeatmapCalendar({
  activeDays = 0,
  calendar = []
}: {
  activeDays?: number;
  calendar?: Array<{ date: string; count: number }>;
}) {
  // map date string -> submission count
  const counts = new Map<string, number>();
  for (let i = 0; i < calendar.length; i++) {
    const day = calendar[i];
    const key = day.date.slice(0, 10);
    counts.set(key, day.count);
  }

  const today = new Date();
  const totalDays = 126;
  const days: number[] = [];

  for (let index = 0; index < totalDays; index++) {
    const date = new Date(today);
    // go backwards so the last cell is today
    date.setDate(today.getDate() - (totalDays - 1 - index));
    const key = date.toISOString().slice(0, 10);
    let count = counts.get(key) ?? 0;

    // if backend didn't send calendar data, fake some active days for demo
    if (calendar.length === 0 && index < activeDays) {
      count = 1;
    }

    days.push(count);
  }

  return (
    <div className="grid gap-1 overflow-x-auto" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
      {days.map((count, index) => {
        let intensity = 0;
        if (count >= 4) {
          intensity = 3;
        } else if (count >= 2) {
          intensity = 2;
        } else if (count >= 1) {
          intensity = 1;
        }

        let cls = "bg-slate-100 dark:bg-slate-800";
        if (intensity === 3) {
          cls = "bg-emerald-600";
        } else if (intensity === 2) {
          cls = "bg-emerald-400";
        } else if (intensity === 1) {
          cls = "bg-emerald-200 dark:bg-emerald-900";
        }

        return <span key={index} className={`h-3 w-3 rounded-sm ${cls}`} title={`${count} submissions`} />;
      })}
    </div>
  );
}
