import { useEffect, useMemo, useState } from "react";

export function ContestTimer({ startTime, endTime }: { startTime: string; endTime: string }) {
  // just a tick counter so the label re-renders every second
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  const label = useMemo(() => {
    const now = Date.now();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    // already over
    if (now >= end) {
      return "Ended";
    }

    let prefix = "Ends in";
    let target = end;

    // hasn't started yet
    if (now < start) {
      prefix = "Starts in";
      target = start;
    }

    const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${prefix} ${hours}h ${minutes}m ${seconds}s`;
  }, [startTime, endTime]);

  return <span className="font-mono text-sm text-slate-600 dark:text-slate-300">{label}</span>;
}
