import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">That route does not exist (or I forgot to add it).</p>
      <Link className="mt-3 inline-flex text-emerald-600 hover:text-emerald-500" to="/problems">
        Back to problems
      </Link>
    </div>
  );
}
