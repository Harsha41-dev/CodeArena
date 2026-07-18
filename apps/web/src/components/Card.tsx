import type { HTMLAttributes, PropsWithChildren } from "react";
import { clsx } from "clsx";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={clsx("ca-panel", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={clsx("flex flex-col space-y-1.5 p-5 border-b border-slate-100 dark:border-white/5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h3
      className={clsx("font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={clsx("p-5", className)} {...props}>
      {children}
    </div>
  );
}
