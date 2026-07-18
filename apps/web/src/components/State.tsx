import { AlertCircle, FileQuestion, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
      <div className="mb-4 rounded-full bg-slate-100 p-3 dark:bg-white/5">
        <FileQuestion className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{body}</p> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", error }: { title?: string; error?: unknown }) {
  let message = "Please try again.";
  if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/60 bg-rose-50/50 p-6 text-center text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
      <div className="mb-3 rounded-full bg-rose-100 p-2 dark:bg-rose-900/30">
        <AlertCircle className="h-5 w-5 text-rose-500" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm">{message}</p>
    </div>
  );
}
