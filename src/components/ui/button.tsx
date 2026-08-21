"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  outline: "btn border border-slate-300 bg-transparent text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-slate-400/30 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700",
  success: "btn bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus:ring-emerald-500/40",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
  icon: "h-9 w-9 p-0",
  "icon-sm": "h-8 w-8 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, leftIcon, rightIcon, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(variants[variant], sizes[size], "whitespace-nowrap", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});

export { variants as buttonVariants };