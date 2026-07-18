import type { PropsWithChildren } from "react";
import { clsx } from "clsx";

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  const classes = clsx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border", className);

  return <span className={classes}>{children}</span>;
}
