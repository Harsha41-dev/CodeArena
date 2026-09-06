import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import { problemsApi } from "../services/api";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { ProblemTable } from "../components/ProblemTable";

export function CompanySheetsPage() {
  const { slug } = useParams();

  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: problemsApi.companies
  });

  const allProblems = useQuery({
    queryKey: ["company-sheet-problem-counts"],
    queryFn: () => problemsApi.list({ limit: "100", sort: "frequency" }),
    enabled: !slug
  });

  const companyProblems = useQuery({
    queryKey: ["company-sheet", slug],
    queryFn: () => problemsApi.list({ company: slug!, limit: "100", sort: "frequency" }),
    enabled: Boolean(slug)
  });

  const selectedCompany = useMemo(
    () => companies.data?.find((company) => company.slug === slug),
    [companies.data, slug]
  );

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const problem of allProblems.data ?? []) {
      for (const entry of problem.companies ?? []) {
        counts.set(entry.company.slug, (counts.get(entry.company.slug) ?? 0) + 1);
      }
    }
    return counts;
  }, [allProblems.data]);

  if (companies.isLoading || allProblems.isLoading || companyProblems.isLoading) {
    return <LoadingState label="Loading company sheets" />;
  }

  if (companies.isError || allProblems.isError || companyProblems.isError) {
    return (
      <ErrorState
        title="Could not load company sheets"
        error={companies.error ?? allProblems.error ?? companyProblems.error}
      />
    );
  }

  if (slug) {
    const problems = companyProblems.data ?? [];
    return (
      <div className="space-y-5">
        <section className="ca-panel p-6">
          <Link to="/companies" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
            All companies
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {selectedCompany?.name ?? slug}
                </h1>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Problems tagged for this company, sorted by frequency.
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {problems.length} problems
            </span>
          </div>
        </section>

        <section className="ca-panel overflow-hidden">
          {problems.length ? (
            <ProblemTable problems={problems} />
          ) : (
            <div className="p-5">
              <EmptyState title="No company problems yet" />
            </div>
          )}
        </section>
      </div>
    );
  }

  const companyItems = companies.data ?? [];
  return (
    <section className="ca-panel overflow-hidden">
      <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Company Sheets</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Browse company-focused problem lists built from persisted company frequency metadata.
        </p>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {companyItems.map((company) => (
          <Link
            key={company.id}
            to={`/companies/${company.slug}`}
            className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 transition-colors hover:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/30"
          >
            <div className="flex items-center justify-between gap-3">
              <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-500 dark:bg-black/20">
                {companyCounts.get(company.slug) ?? 0}
              </span>
            </div>
            <p className="mt-3 font-semibold text-slate-900 dark:text-white">{company.name}</p>
            <p className="mt-1 text-xs text-slate-500">{company.slug}</p>
          </Link>
        ))}
        {!companyItems.length ? (
          <div className="sm:col-span-2 xl:col-span-4">
            <EmptyState title="No companies yet" body="Add company tags while creating or editing problems." />
          </div>
        ) : null}
        {!companyItems.length && !allProblems.data?.length ? null : (
          <Link
            to="/problems"
            className="rounded-lg border border-slate-200/80 bg-white p-4 transition-colors hover:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/30"
          >
            <Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 font-semibold text-slate-900 dark:text-white">All Problems</p>
            <p className="mt-1 text-xs text-slate-500">Return to the full problemset.</p>
          </Link>
        )}
      </div>
    </section>
  );
}
