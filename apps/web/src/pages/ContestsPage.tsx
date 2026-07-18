import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { contestsApi } from "../services/api";
import type { Contest } from "../types/api";
import { ContestCard } from "../components/ContestCard";
import { EmptyState, ErrorState, LoadingState } from "../components/State";

export function ContestsPage() {
  const contests = useQuery({
    queryKey: ["contests"],
    queryFn: contestsApi.list
  });

  // split into live / upcoming / past
  const grouped = useMemo(() => {
    const list = contests.data ?? [];
    const live: Contest[] = [];
    const upcoming: Contest[] = [];
    const past: Contest[] = [];

    for (let i = 0; i < list.length; i++) {
      const contest = list[i];
      if (contest.status === "LIVE") {
        live.push(contest);
      } else if (contest.status === "UPCOMING") {
        upcoming.push(contest);
      } else if (contest.status === "ENDED") {
        past.push(contest);
      }
    }

    return { live, upcoming, past };
  }, [contests.data]);

  if (contests.isLoading) {
    return <LoadingState label="Loading contests" />;
  }

  if (contests.isError) {
    return <ErrorState title="Could not load contests" error={contests.error} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Contests</h1>
        <p className="mt-1 text-base text-slate-500">Live rounds, upcoming contests, and past standings.</p>
      </div>
      <ContestSection title="Live Contests" contests={grouped.live} empty="No live contests right now." />
      <ContestSection title="Upcoming Contests" contests={grouped.upcoming} empty="No upcoming contests scheduled." />
      <ContestSection title="Past Contests" contests={grouped.past} empty="No past contests yet." />
    </div>
  );
}

function ContestSection({ title, contests, empty }: { title: string; contests: Contest[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {contests.map((contest) => (
          <ContestCard key={contest.id} contest={contest} />
        ))}
      </div>
      {!contests.length ? <EmptyState title={empty} /> : null}
    </section>
  );
}
