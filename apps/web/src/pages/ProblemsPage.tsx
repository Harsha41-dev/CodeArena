import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { problemsApi } from "../services/api";
import type { Difficulty, Problem } from "../types/api";
import { EmptyState, ErrorState } from "../components/State";
import { FilterBar, SelectFilter } from "../components/FilterBar";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Pagination } from "../components/Pagination";
import { ProblemTable } from "../components/ProblemTable";
import { SearchInput } from "../components/SearchInput";

const PAGE_SIZE = 12;

export function ProblemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [difficulty, setDifficulty] = useState(searchParams.get("difficulty") ?? "");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [sort, setSort] = useState("latest");

  // build query params for the API (skip empty filters)
  const queryParams: Record<string, string> = {};
  if (search) queryParams.search = search;
  if (difficulty) queryParams.difficulty = difficulty;
  if (tag) queryParams.tag = tag;
  if (status) queryParams.status = status;
  // fetch a bigger chunk and paginate client-side for now
  queryParams.limit = "100";

  const problems = useQuery({
    queryKey: ["problems", search, difficulty, tag, status],
    queryFn: () => problemsApi.list(queryParams)
  });

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: problemsApi.tags
  });

  const sorted = useMemo(() => {
    const list = problems.data ? [...problems.data] : [];
    return sortProblems(list, sort);
  }, [problems.data, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  function updateFilters(next: { search?: string; difficulty?: string; tag?: string; status?: string }) {
    const params: Record<string, string> = {};
    const s = next.search !== undefined ? next.search : search;
    const d = next.difficulty !== undefined ? next.difficulty : difficulty;
    const t = next.tag !== undefined ? next.tag : tag;
    const st = next.status !== undefined ? next.status : status;

    if (s) params.search = s;
    if (d) params.difficulty = d;
    if (t) params.tag = t;
    if (st) params.status = st;

    setSearchParams(params);
    setPage(1);
  }

  return (
    <section className="ca-panel overflow-hidden">
      <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Problems</h1>
            <p className="mt-1 text-sm text-slate-500">Filter by topic, difficulty, and solve status.</p>
          </div>

          <FilterBar>
            <SearchInput
              value={search}
              placeholder="Search problems"
              onChange={(value) => {
                setSearch(value);
                updateFilters({ search: value });
              }}
            />
            <SelectFilter
              label="Difficulty"
              value={difficulty}
              onChange={(value) => {
                setDifficulty(value);
                updateFilters({ difficulty: value });
              }}
              options={[
                { value: "", label: "All difficulty" },
                { value: "EASY", label: "Easy" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HARD", label: "Hard" }
              ]}
            />
            <SelectFilter
              label="Tag"
              value={tag}
              onChange={(value) => {
                setTag(value);
                updateFilters({ tag: value });
              }}
              options={[
                { value: "", label: "All tags" },
                ...(tags.data ?? []).map((item) => ({ value: item.slug, label: item.name }))
              ]}
            />
            <SelectFilter
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                updateFilters({ status: value });
              }}
              options={[
                { value: "", label: "All status" },
                { value: "SOLVED", label: "Solved" },
                { value: "ATTEMPTED", label: "Attempted" },
                { value: "NOT_ATTEMPTED", label: "Unsolved" }
              ]}
            />
            <SelectFilter
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: "latest", label: "Latest" },
                { value: "difficulty", label: "Difficulty" },
                { value: "title", label: "Title" }
              ]}
            />
          </FilterBar>
        </div>
      </div>

      {problems.isLoading ? <LoadingSkeleton rows={10} /> : null}

      {problems.isError ? (
        <div className="p-5">
          <ErrorState title="Could not load problems" error={problems.error} />
        </div>
      ) : null}

      {!problems.isLoading && !problems.isError && pageItems.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No problems found" body="Try a different filter combination." />
        </div>
      ) : null}

      {!problems.isLoading && !problems.isError && pageItems.length > 0 ? (
        <ProblemTable problems={pageItems} offset={start} />
      ) : null}

      {!problems.isLoading && !problems.isError && pageItems.length > 0 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </section>
  );
}

function sortProblems(items: Problem[], sort: string): Problem[] {
  const difficultyOrder: Record<Difficulty, number> = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3
  };

  const copy = items.slice();

  if (sort === "difficulty") {
    copy.sort((a, b) => {
      const diff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });
    return copy;
  }

  if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
    return copy;
  }

  // latest = keep API order
  return copy;
}
