import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, Trophy } from "lucide-react";
import { adminApi } from "../../services/api";
import type { Contest } from "../../types/api";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/State";
import { PanelTitle, TextArea, TextInput } from "./formFields";

interface ContestManagementSectionProps {
  onToast: (message: string) => void;
}

export function ContestManagementSection({ onToast }: ContestManagementSectionProps) {
  const [contestForm, setContestForm] = useState({
    title: "",
    slug: "",
    description: "",
    startTime: "",
    endTime: "",
    problemIds: ""
  });
  const [contestProblemInputs, setContestProblemInputs] = useState<Record<string, string>>({});

  const contests = useQuery({
    queryKey: ["admin-contests"],
    queryFn: adminApi.contests
  });

  const createContest = useMutation({
    mutationFn: () => {
      const problemIds = contestForm.problemIds
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return adminApi.createContest({
        ...contestForm,
        startTime: new Date(contestForm.startTime).toISOString(),
        endTime: new Date(contestForm.endTime).toISOString(),
        problemIds,
        visibility: "PUBLIC"
      });
    },
    onSuccess: () => {
      onToast("Contest created");
      void contests.refetch();
    }
  });

  const updateContest = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Pick<Contest, "status" | "visibility">> }) =>
      adminApi.updateContest(id, payload),
    onSuccess: () => {
      onToast("Contest updated");
      void contests.refetch();
    }
  });

  const archiveContest = useMutation({
    mutationFn: (id: string) => adminApi.deleteContest(id),
    onSuccess: () => {
      onToast("Contest archived");
      void contests.refetch();
    }
  });

  const addContestProblem = useMutation({
    mutationFn: ({ contestId, problemId }: { contestId: string; problemId: string }) =>
      adminApi.addContestProblem(contestId, { problemId }),
    onSuccess: (_, variables) => {
      onToast("Contest problem assigned");
      setContestProblemInputs((current) => ({ ...current, [variables.contestId]: "" }));
      void contests.refetch();
    }
  });

  const removeContestProblem = useMutation({
    mutationFn: ({ contestId, problemId }: { contestId: string; problemId: string }) =>
      adminApi.removeContestProblem(contestId, problemId),
    onSuccess: () => {
      onToast("Contest problem removed");
      void contests.refetch();
    }
  });

  return (
    <div className="ca-panel p-5">
      <PanelTitle icon={Trophy} title="Create Contest" />
      <div className="mt-4 grid gap-3">
        <TextInput
          label="Title"
          value={contestForm.title}
          onChange={(value) => setContestForm((current) => ({ ...current, title: value }))}
        />
        <TextInput
          label="Slug"
          value={contestForm.slug}
          onChange={(value) => setContestForm((current) => ({ ...current, slug: value }))}
        />
        <TextArea
          label="Description"
          value={contestForm.description}
          onChange={(value) => setContestForm((current) => ({ ...current, description: value }))}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Start time"
            value={contestForm.startTime}
            onChange={(value) => setContestForm((current) => ({ ...current, startTime: value }))}
          />
          <TextInput
            label="End time"
            value={contestForm.endTime}
            onChange={(value) => setContestForm((current) => ({ ...current, endTime: value }))}
          />
        </div>
        <TextInput
          label="Problem IDs"
          value={contestForm.problemIds}
          onChange={(value) => setContestForm((current) => ({ ...current, problemIds: value }))}
        />
        <Button disabled={createContest.isPending} onClick={() => createContest.mutate()}>
          <Send className="h-4 w-4" /> Create Contest
        </Button>
        {createContest.isError ? <ErrorState title="Contest creation failed" error={createContest.error} /> : null}
      </div>
      <div className="mt-5 space-y-3">
        {(contests.data ?? []).map((contest) => (
          <div key={contest.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{contest.title}</p>
                <p className="text-xs text-slate-500">
                  {contest.slug} - {new Date(contest.startTime).toLocaleString()} to{" "}
                  {new Date(contest.endTime).toLocaleString()}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={archiveContest.isPending}
                onClick={() => {
                  if (window.confirm(`Archive ${contest.title}?`)) {
                    archiveContest.mutate(contest.id);
                  }
                }}
              >
                Archive
              </Button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <select
                className="ca-input"
                value={contest.status}
                onChange={(event) =>
                  updateContest.mutate({
                    id: contest.id,
                    payload: { status: event.target.value as Contest["status"] }
                  })
                }
              >
                <option value="UPCOMING">UPCOMING</option>
                <option value="LIVE">LIVE</option>
                <option value="ENDED">ENDED</option>
              </select>
              <select
                className="ca-input"
                value={contest.visibility ?? "PUBLIC"}
                onChange={(event) =>
                  updateContest.mutate({
                    id: contest.id,
                    payload: { visibility: event.target.value as NonNullable<Contest["visibility"]> }
                  })
                }
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="PRIVATE">PRIVATE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="ca-input min-w-0 flex-1"
                placeholder="Problem ID"
                value={contestProblemInputs[contest.id] ?? ""}
                onChange={(event) =>
                  setContestProblemInputs((current) => ({
                    ...current,
                    [contest.id]: event.target.value
                  }))
                }
              />
              <Button
                variant="secondary"
                disabled={addContestProblem.isPending || !contestProblemInputs[contest.id]?.trim()}
                onClick={() =>
                  addContestProblem.mutate({
                    contestId: contest.id,
                    problemId: contestProblemInputs[contest.id].trim()
                  })
                }
              >
                Assign
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {contest.problems.map((problem) => (
                <button
                  key={problem.problemId}
                  type="button"
                  className="rounded-md bg-white px-2 py-1 text-xs text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300"
                  onClick={() => {
                    if (window.confirm(`Remove problem ${problem.problemId} from ${contest.title}?`)) {
                      removeContestProblem.mutate({
                        contestId: contest.id,
                        problemId: problem.problemId
                      });
                    }
                  }}
                >
                  {problem.problemId.slice(0, 8)} - remove
                </button>
              ))}
              {!contest.problems.length ? <span className="text-xs text-slate-500">No problems assigned.</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
