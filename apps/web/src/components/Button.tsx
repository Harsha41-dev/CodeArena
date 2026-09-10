import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const baseClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7dcfb6]/50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]";

function variantClass(variant: Variant): string {
  if (variant === "primary") {
    return "bg-[#7dcfb6] text-[#06211b] hover:bg-[#7dcfb6]/90";
  }
  if (variant === "secondary") {
    return "border border-[#252a32] bg-transparent text-[#e8eaee] hover:bg-[#181c22]";
  }
  if (variant === "danger") {
    return "bg-[#c97a72] text-white hover:bg-[#c97a72]/90";
  }
  return "text-[#9aa1ac] hover:bg-[#181c22] hover:text-[#e8eaee]";
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
