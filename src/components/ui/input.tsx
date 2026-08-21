"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: ReactNode;
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leftIcon, label, error, hint, required, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <div className={cn("relative", leftIcon && "[&>input]:pl-9")}>
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">
          {leftIcon}
        </span>
      )}
      <input ref={ref} id={label ? inputId : id} className={cn("input", error && "border-red-300 focus:border-red-400 focus:ring-red-100", className)} {...props} />
    </div>
  );
  if (!label) return input;
  return (
    <FormField label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      {input}
    </FormField>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, hint, required, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const textarea = (
    <textarea ref={ref} id={label ? inputId : id} className={cn("input min-h-[90px] resize-y", error && "border-red-300 focus:border-red-400 focus:ring-red-100", className)} {...props} />
  );
  if (!label) return textarea;
  return (
    <FormField label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      {textarea}
    </FormField>
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, label, error, hint, required, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const select = (
    <div className="relative">
      <select
        ref={ref}
        id={label ? inputId : id}
        className={cn("input appearance-none pr-9", error && "border-red-300 focus:border-red-400 focus:ring-red-100", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
  if (!label) return select;
  return (
    <FormField label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      {select}
    </FormField>
  );
});

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
      <AlertCircle className="h-3.5 w-3.5" /> {error}
    </p>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  return (
    <div className={cn("space-y-0", className)}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 accent-brand-600 focus:ring-brand-500"
        {...props}
      />
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-slate-700">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-1 disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}