import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const baseClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

function variantClass(variant: Variant): string {
  if (variant === "primary") {
    return "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-400 hover:to-emerald-500 border border-emerald-600/50";
  }
  if (variant === "secondary") {
    return "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10";
  }
  if (variant === "danger") {
    return "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-sm hover:from-rose-400 hover:to-rose-500 border border-rose-600/50";
  }
  // ghost
  return "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10";
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>) {
  return (
    <button className={clsx(baseClass, variantClass(variant), className)} {...props}>
      {children}
    </button>
  );
}
